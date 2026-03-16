import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-device-id",
};

const SYSTEM_PROMPT = `You are GamerLingo Reply Generator. Given a gaming chat message and its translation, suggest 3 short reply options in the user's language.

Rules:
1. Each reply should be 1 line, casual gaming chat style
2. Reply 1: Friendly/positive response
3. Reply 2: Playful trash talk / banter
4. Reply 3: Short and neutral
5. Use natural gaming slang for the target language
6. Return ONLY a JSON array of 3 strings, nothing else. Example: ["reply1", "reply2", "reply3"]`;

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalText, translatedText, deviceId, targetLang } = await req.json();

    if (!originalText || !translatedText || !deviceId || !targetLang) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Supabaseクライアント初期化
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pro会員チェック
    const { data: proData } = await supabase
      .from("pro_members")
      .select("status, expires_at")
      .eq("device_id", deviceId)
      .eq("status", "active")
      .single();

    const isPro = proData && (!proData.expires_at || new Date(proData.expires_at) > new Date());

    if (!isPro) {
      return new Response(
        JSON.stringify({ error: "Pro subscription required", proOnly: true }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Claude API呼び出し
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Original message: ${originalText}\nTranslation: ${translatedText}\nReply language: ${targetLang}`;

    const apiResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!apiResponse.ok) {
      const err = await apiResponse.json();
      return new Response(
        JSON.stringify({ error: `Reply generation failed: ${err.error?.message || "Unknown error"}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await apiResponse.json();
    const rawText = data.content?.[0]?.text?.trim() || "[]";

    // JSONパース
    let replies: string[];
    try {
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 5 || !parsed.every((r: unknown) => typeof r === "string")) {
        throw new Error("Invalid reply format");
      }
      replies = parsed;
    } catch {
      // フォールバック: JSON配列を抽出
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length >= 1 && parsed.length <= 5 && parsed.every((r: unknown) => typeof r === "string")) {
          replies = parsed;
        } else {
          return new Response(
            JSON.stringify({ error: "Failed to parse reply suggestions" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Failed to parse reply suggestions" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ replies }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Server error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
