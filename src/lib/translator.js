import { buildSlangContext } from './slang-dictionary.js'

const SYSTEM_PROMPT = `You are GamerLingo, a specialized translator for gaming communities.

## Rules
1. Translate the ENTIRE sentence as one natural message — do NOT translate word by word
2. Use the gaming slang dictionary to understand meaning, then write a natural sentence in the target language that a real gamer would actually say
3. Preserve the emotional tone (friendly banter, trash talk, serious callout)
4. NEVER mix languages in the output — write everything in the target language
5. When translating to Japanese, write EVERYTHING in Japanese. Zero English words allowed in the output. "noob" → "雑魚", "GG" → "おつ", "EZ" → "楽勝", "get rekt" → "ボコボコだな"
6. If translating to Japanese, use casual/colloquial Japanese that gamers actually use in chat (e.g. 草、乙、雑魚、ボコボコにした)
7. If the text is already in the target language, return it as-is
8. Return ONLY the translated text as a single line. No explanations, no notes, no quotation marks, no parenthetical alternatives, no "or more literally" notes.

## Examples (EN → JA)
- "GG EZ noob get rekt" → "おつ、楽勝だったわ　雑魚すぎボコボコだなｗ"
- "nice clutch bro, wp" → "逆転うまいな、ナイスプレイ"
- "stop feeding, you're so bad" → "キル献上やめろって、下手すぎ"
- "I'm tilted, gonna take a break" → "メンタルやられたわ、ちょっと休憩する"
- "that character is so OP, needs a nerf" → "あのキャラぶっ壊れだわ、弱体化しろ"
- "lol you're such a noob" → "草、お前雑魚すぎ"
- "ez clap, gg no re" → "楽勝、おつ、再戦なしな"
- "bro stop camping" → "おい待ち伏せやめろ"

## Examples (JA → EN)
- "草、味方ガチャ外れすぎ" → "lmao, my teammates are so bad"
- "このキャラ人権だわ" → "this character is a must-have"
- "沼ってるわ、全然勝てん" → "I'm so hardstuck, can't win at all"
- "芋砂うざすぎ" → "camper snipers are so annoying"
- "おつ、楽勝だったわ雑魚すぎ" → "gg ez, you guys were so bad lol"`

/**
 * Detect if text is primarily Japanese or English
 */
export function detectLanguage(text) {
  const jaPattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/
  const jaChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || []).length
  const totalChars = text.replace(/\s/g, '').length

  if (totalChars === 0) return 'en'
  return jaChars / totalChars > 0.3 ? 'ja' : 'en'
}

/**
 * Build the full translation prompt
 */
function buildPrompt(text, sourceLang, targetLang, context) {
  const slangContext = buildSlangContext(sourceLang, targetLang)
  const targetName = targetLang === 'ja' ? 'Japanese' : 'English'
  const sourceName = sourceLang === 'ja' ? 'Japanese' : 'English'

  return `Translate from ${sourceName} to ${targetName}.
Context: ${context || 'gaming chat'}

## Gaming Slang Reference (${sourceName} → ${targetName})
${slangContext}

Text to translate:
${text}`
}

/**
 * Call the translation API via background service worker
 */
export async function translate(text, options = {}) {
  const sourceLang = options.sourceLang || detectLanguage(text)
  const targetLang = sourceLang === 'ja' ? 'en' : 'ja'
  const context = options.context || detectContext()

  const prompt = buildPrompt(text, sourceLang, targetLang, context)

  // Send to background service worker for API call
  const response = await chrome.runtime.sendMessage({
    type: 'TRANSLATE',
    payload: {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: prompt,
      text,
      sourceLang,
      targetLang,
    },
  })

  if (response.error) {
    throw new Error(response.error)
  }

  return {
    original: text,
    translated: response.translated,
    sourceLang,
    targetLang,
  }
}

/**
 * Generate a reply in the target language (Pro feature)
 */
export async function generateReply(originalMessage, userIntent, options = {}) {
  const targetLang = options.targetLang || detectLanguage(originalMessage)
  const targetName = targetLang === 'ja' ? 'Japanese' : 'English'

  const prompt = `You are GamerLingo Reply Assistant.
Write a natural gaming chat reply in ${targetName}.

Original message: ${originalMessage}
User wants to say: ${userIntent}
Context: ${options.context || 'gaming chat'}
Tone: ${options.tone || 'friendly'}

Write ONLY the reply. Keep it short and natural for chat. Use appropriate gaming slang.`

  const response = await chrome.runtime.sendMessage({
    type: 'TRANSLATE',
    payload: {
      systemPrompt: 'You write natural gaming chat replies in any language.',
      userPrompt: prompt,
    },
  })

  if (response.error) {
    throw new Error(response.error)
  }

  return response.translated
}

/**
 * Detect which site we're on for context
 */
function detectContext() {
  const host = window.location.hostname
  if (host.includes('discord.com')) return 'Discord gaming chat'
  if (host.includes('steampowered.com') || host.includes('steamcommunity.com')) return 'Steam game review/forum'
  if (host.includes('twitch.tv')) return 'Twitch live stream chat'
  return 'gaming chat'
}
