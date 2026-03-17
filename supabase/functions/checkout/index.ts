import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deviceId, plan } = await req.json();

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: "Missing deviceId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
    });

    // 月額 or 年額のprice IDを選択
    const priceId = plan === "yearly"
      ? Deno.env.get("STRIPE_YEARLY_PRICE_ID") || Deno.env.get("STRIPE_PRICE_ID")!
      : Deno.env.get("STRIPE_PRICE_ID")!;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        device_id: deviceId,
      },
      subscription_data: {
        metadata: {
          device_id: deviceId,
        },
        trial_period_days: 3,
      },
      success_url: "https://qpmayo-x.github.io/gamerlingo/store/success.html",
      cancel_url: "https://qpmayo-x.github.io/gamerlingo/store/cancel.html",
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Checkout failed: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
