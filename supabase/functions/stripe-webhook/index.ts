import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(",").reduce((acc: Record<string, string>, part) => {
    const [key, value] = part.split("=");
    acc[key.trim()] = value;
    return acc;
  }, {});

  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;

  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expected === v1;
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (webhookSecret) {
      if (!sig) {
        return new Response(
          JSON.stringify({ error: "Missing stripe-signature header" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      const valid = await verifyStripeSignature(body, sig, webhookSecret);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const event = JSON.parse(body);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (event.type) {
      // チェックアウト完了 → Pro会員登録
      case "checkout.session.completed": {
        const session = event.data.object;
        const deviceId = session.metadata?.device_id;

        if (deviceId && session.subscription) {
          // Stripe APIからサブスク詳細を取得してexpires_atを設定
          let expiresAt: string | null = null;
          try {
            const stripeRes = await fetch(
              `https://api.stripe.com/v1/subscriptions/${session.subscription}`,
              {
                headers: {
                  Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
                },
              }
            );
            const sub = await stripeRes.json();
            if (sub.current_period_end) {
              expiresAt = new Date(sub.current_period_end * 1000).toISOString();
            }
          } catch {
            // expires_at取得失敗しても会員登録は続行
          }

          await supabase.from("pro_members").upsert(
            {
              device_id: deviceId,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              status: "active",
              expires_at: expiresAt,
            },
            { onConflict: "device_id" }
          );
        }
        break;
      }

      // 定期課金成功 → expires_at更新 + ステータス復活
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
          const updateData: Record<string, unknown> = { status: "active" };
          if (periodEnd) {
            updateData.expires_at = new Date(periodEnd * 1000).toISOString();
          }

          // subscription metadataからdevice_idを取得して更新
          const deviceId = await getDeviceIdFromSubscription(
            supabase,
            invoice.subscription
          );
          if (deviceId) {
            await supabase
              .from("pro_members")
              .update(updateData)
              .eq("device_id", deviceId);
          } else {
            // device_id不明の場合はsubscription_idで更新
            await supabase
              .from("pro_members")
              .update(updateData)
              .eq("stripe_subscription_id", invoice.subscription);
          }
        }
        break;
      }

      // 課金失敗 → past_dueに変更（即座にProを停止しない）
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await supabase
            .from("pro_members")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", invoice.subscription);
        }
        break;
      }

      // サブスク更新（プラン変更、ステータス変更など）
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const deviceId = subscription.metadata?.device_id;
        const periodEnd = subscription.current_period_end;

        const updateData: Record<string, unknown> = {
          status: subscription.status === "active" ? "active" : subscription.status,
        };
        if (periodEnd) {
          updateData.expires_at = new Date(periodEnd * 1000).toISOString();
        }

        if (deviceId) {
          await supabase
            .from("pro_members")
            .update(updateData)
            .eq("device_id", deviceId);
        } else {
          await supabase
            .from("pro_members")
            .update(updateData)
            .eq("stripe_subscription_id", subscription.id);
        }
        break;
      }

      // サブスク削除（完全キャンセル）
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const deviceId = subscription.metadata?.device_id;

        if (deviceId) {
          await supabase
            .from("pro_members")
            .update({ status: "canceled" })
            .eq("device_id", deviceId);
        } else {
          await supabase
            .from("pro_members")
            .update({ status: "canceled" })
            .eq("stripe_customer_id", subscription.customer);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});

// subscription_idからdevice_idを取得するヘルパー
async function getDeviceIdFromSubscription(
  supabase: ReturnType<typeof createClient>,
  subscriptionId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("pro_members")
    .select("device_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();
  return data?.device_id || null;
}
