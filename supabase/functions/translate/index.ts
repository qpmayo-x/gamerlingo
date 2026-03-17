import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const FREE_DAILY_LIMIT = 10;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-device-id",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { systemPrompt, userPrompt, deviceId } = await req.json();

    if (!userPrompt || !deviceId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userPrompt.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Input text too long (max 2000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Supabaseクライアント初期化
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pro会員チェック（activeまたはpast_due=猶予期間中はPro扱い）
    const { data: proData } = await supabase
      .from("pro_members")
      .select("status, expires_at")
      .eq("device_id", deviceId)
      .in("status", ["active", "past_due"])
      .single();

    const isPro = proData && (!proData.expires_at || new Date(proData.expires_at) > new Date());

    // 使用量チェック（Proでなければ）
    if (!isPro) {
      const today = new Date().toISOString().split("T")[0];

      // 原子的にインクリメントして現在のカウントを取得（レースコンディション防止）
      // まず行が存在するか確認し、なければ初期化
      const { data: existingUsage } = await supabase
        .from("usage_tracking")
        .select("count")
        .eq("device_id", deviceId)
        .eq("date", today)
        .single();

      if (!existingUsage) {
        // 初回: 行を作成
        await supabase
          .from("usage_tracking")
          .insert({
            device_id: deviceId,
            date: today,
            count: 0,
            is_pro: false,
          });
      }

      // 原子的インクリメント（RPC経由）— countをDB側で+1して返す
      const { data: updated, error: rpcError } = await supabase
        .rpc("increment_usage", {
          p_device_id: deviceId,
          p_date: today,
          p_limit: FREE_DAILY_LIMIT,
        });

      if (rpcError || !updated) {
        // RPC未設定の場合はフォールバック（従来方式）
        const currentCount = existingUsage?.count || 0;

        if (currentCount >= FREE_DAILY_LIMIT) {
          return new Response(
            JSON.stringify({
              error: `Daily limit reached (${FREE_DAILY_LIMIT}/${FREE_DAILY_LIMIT}). Upgrade to Pro for unlimited translations.`,
              limitReached: true,
              count: currentCount,
              limit: FREE_DAILY_LIMIT,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase
          .from("usage_tracking")
          .upsert(
            {
              device_id: deviceId,
              date: today,
              count: currentCount + 1,
              is_pro: false,
            },
            { onConflict: "device_id,date" }
          );
      } else if (updated.limit_reached) {
        return new Response(
          JSON.stringify({
            error: `Daily limit reached (${FREE_DAILY_LIMIT}/${FREE_DAILY_LIMIT}). Upgrade to Pro for unlimited translations.`,
            limitReached: true,
            count: updated.new_count,
            limit: FREE_DAILY_LIMIT,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Claude API呼び出し
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!apiResponse.ok) {
      const err = await apiResponse.json();
      return new Response(
        JSON.stringify({ error: `Translation failed: ${err.error?.message || "Unknown error"}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await apiResponse.json();
    const translated = data.content?.[0]?.text?.trim() || "";

    // 使用量情報も返す
    const today = new Date().toISOString().split("T")[0];
    const { data: updatedUsage } = await supabase
      .from("usage_tracking")
      .select("count")
      .eq("device_id", deviceId)
      .eq("date", today)
      .single();

    return new Response(
      JSON.stringify({
        translated,
        usage: {
          count: updatedUsage?.count || 0,
          limit: isPro ? null : FREE_DAILY_LIMIT,
          isPro,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Server error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
