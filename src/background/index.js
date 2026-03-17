// Background Service Worker — Supabase Edge Function経由で翻訳

import { buildSlangContext } from '../lib/slang-dictionary.js'

const SUPABASE_URL = 'https://jetdhwpzinghzvobfgnv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpldGRod3B6aW5naHp2b2JmZ252Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyOTMxODUsImV4cCI6MjA4ODg2OTE4NX0.j1hjNh653YYaY8Lj5PvTsj_j6Rl9OzjvOkC9aKXWRkw'
const TRANSLATE_URL = `${SUPABASE_URL}/functions/v1/translate`
const GENERATE_REPLY_URL = `${SUPABASE_URL}/functions/v1/generate-reply`

// ===== 対応言語 =====
const LANGUAGES = {
  en: 'English',
  ja: 'Japanese',
  zh: 'Chinese (Simplified)',
  ko: 'Korean',
  es: 'Spanish',
  pt: 'Portuguese (Brazilian)',
  ru: 'Russian',
  de: 'German',
  fr: 'French',
  hi: 'Hindi',
}

// ===== システムプロンプト =====
const SYSTEM_PROMPT = `You are GamerLingo, a specialized translator for gaming communities.
You translate between these languages: English, Japanese, Chinese (Simplified), Korean, Spanish, Portuguese (Brazilian), Russian, German, French, Hindi.

## Rules
1. Translate the ENTIRE sentence as one natural message. Do NOT translate word by word.
2. Use the gaming slang dictionary to understand meaning, then write a natural sentence in the target language that a real gamer would actually say.
3. Preserve the emotional tone (friendly banter, trash talk, serious callout).
4. NEVER mix languages in the output. Write everything in the target language.
5. When translating to Japanese, write EVERYTHING in Japanese. Zero English words allowed. "noob" must become "雑魚", "GG" must become "おつ", "EZ" must become "楽勝", "get rekt" must become "ボコボコだな".
6. When translating to Japanese, use casual/colloquial Japanese that gamers actually use in chat (e.g. 草, 乙, 雑魚, ボコボコにした).
7. When translating to Korean, use natural Korean gaming slang (e.g. ㅋㅋ, ㄱㄱ, 노답, 캐리, 트롤).
8. When translating to Chinese, use natural Chinese gaming slang (e.g. 666, 菜鸟, 带飞, 挂机, 坑).
9. When translating to English, use real gamer slang (e.g. lol, gg, noob, rekt).
10. When translating to Spanish, use Latin American gaming slang where appropriate (e.g. manco, tryhard, campero).
11. When translating to Portuguese, use Brazilian gaming slang where appropriate (e.g. rusha, noob, carrega).
12. When translating to Russian, use natural Russian gaming slang (e.g. gg, нуб, раш, кемпер, тащить, слив, имба).
13. When translating to German, use natural German gaming slang (e.g. gg, Noob, rushen, campen, overpowered, nerfen).
14. When translating to French, use natural French gaming slang (e.g. gg, noob, rush, feed, tryhard, broken, nerf).
15. When translating to Hindi, use natural Hindi gaming chat style mixing Hindi and common English gaming terms.
16. If the text is already in the target language, return it as-is.
17. Return ONLY the translated text as a single line. No explanations. No notes. No quotation marks. No parenthetical alternatives. Just the translation and nothing else.

## Examples (EN to JA)
- "GG EZ noob get rekt" translates to "おつ、楽勝だったわ　雑魚すぎボコボコだなｗ"
- "nice clutch bro, wp" translates to "逆転うまいな、ナイスプレイ"
- "stop feeding, you're so bad" translates to "キル献上やめろって、下手すぎ"
- "lol you're such a noob" translates to "草、お前雑魚すぎ"

## Examples (JA to EN)
- "草、味方ガチャ外れすぎ" translates to "lmao, my teammates are so bad"
- "このキャラ人権だわ" translates to "this character is a must-have"
- "芋砂うざすぎ" translates to "camper snipers are so annoying"

## Examples (KO to EN)
- "ㅋㅋㅋ 트롤 개노답" translates to "lol that troll is so bad"

## Examples (EN to KO)
- "GG EZ noob" translates to "지지 이지 뉴비 ㅋㅋ"

## Examples (ZH to EN)
- "666 这个太强了" translates to "nice, that was insane"

## Examples (EN to ZH)
- "GG EZ noob" translates to "GG 轻松 菜鸟"

## Examples (EN to RU)
- "GG EZ noob get rekt" translates to "гг изи, нуб, получай"

## Examples (EN to DE)
- "stop camping noob" translates to "hör auf zu campen, Noob"

## Examples (EN to FR)
- "nice clutch bro" translates to "beau clutch mec"`

// ===== デバイスID管理 =====
async function getDeviceId() {
  const result = await chrome.storage.local.get(['deviceId'])
  if (result.deviceId) return result.deviceId

  // 初回のみランダムIDを生成
  const id = 'gl_' + crypto.randomUUID()
  await chrome.storage.local.set({ deviceId: id })
  return id
}

// ===== 言語検出 =====
function detectLanguage(text) {
  const cleaned = text.replace(/\s/g, '')
  if (cleaned.length === 0) return 'en'

  const jaKana = (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length
  const ko = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length
  const cjk = (text.match(/[\u4E00-\u9FFF]/g) || []).length
  const ru = (text.match(/[\u0400-\u04FF]/g) || []).length
  const hi = (text.match(/[\u0900-\u097F]/g) || []).length
  const espt = (text.match(/[áéíóúñãõçê¿¡]/gi) || []).length
  const de = (text.match(/[äöüßÄÖÜ]/g) || []).length
  const fr = (text.match(/[àâèêëîïôùûüÿœæç]/gi) || []).length

  const total = cleaned.length

  if (ko / total > 0.3) return 'ko'
  if (jaKana / total > 0.1) return 'ja'
  if (cjk / total > 0.3 && jaKana === 0) return 'zh'
  if (ru / total > 0.3) return 'ru'
  if (hi / total > 0.3) return 'hi'
  if (de > 0) return 'de'
  if (fr > 0) return 'fr'
  if (espt > 0) return 'es'
  return 'en'
}

// ===== コンテキストメニュー =====
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'gamerlingo-translate',
    title: 'GamerLingo: Translate',
    contexts: ['selection'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'gamerlingo-translate' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'CONTEXT_MENU_TRANSLATE',
      text: info.selectionText,
    })
  }
})

// ===== キーボードショートカット =====
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'translate-selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHORTCUT_TRANSLATE' })
    }
  }
})

// ===== メッセージ処理 =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSLATE_TEXT') {
    handleTranslateText(message.text, message.context).then(sendResponse)
    return true
  }
  if (message.type === 'CHECK_USAGE') {
    handleCheckUsage().then(sendResponse)
    return true
  }
  if (message.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse)
    return true
  }
  if (message.type === 'GET_HISTORY') {
    chrome.storage.local.get(['translationHistory'], (result) => {
      sendResponse(result.translationHistory || [])
    })
    return true
  }
  if (message.type === 'CREATE_CHECKOUT') {
    handleCreateCheckout(message.plan).then(sendResponse)
    return true
  }
  if (message.type === 'GENERATE_REPLY') {
    handleGenerateReply(message.originalText, message.translatedText, message.context).then(sendResponse)
    return true
  }
  if (message.type === 'SAVE_WORD') {
    saveToWordBook(message.original, message.translated).then(sendResponse)
    return true
  }
  if (message.type === 'GET_WORD_BOOK') {
    chrome.storage.local.get(['wordBook'], (result) => {
      sendResponse(result.wordBook || [])
    })
    return true
  }
  if (message.type === 'DELETE_WORD') {
    deleteFromWordBook(message.savedAt).then(sendResponse)
    return true
  }
  if (message.type === 'MANAGE_SUBSCRIPTION') {
    handleManageSubscription().then(sendResponse)
    return true
  }
})

/**
 * Edge Function経由で翻訳
 */
async function handleTranslateText(text, context) {
  try {
    const deviceId = await getDeviceId()
    const settings = await getSettings()

    const sourceLang = detectLanguage(text)
    let targetLang = settings.targetLang || 'ja'
    if (targetLang === sourceLang) {
      targetLang = sourceLang === 'en' ? 'ja' : 'en'
    }

    const sourceName = LANGUAGES[sourceLang] || 'English'
    const targetName = LANGUAGES[targetLang] || 'Japanese'
    const slang = buildSlangContext(sourceLang, targetLang)

    let userPrompt = `Translate from ${sourceName} to ${targetName}.\nContext: ${context || 'gaming chat'}\n`
    if (slang) {
      userPrompt += `\nSlang reference: ${slang}\n`
    }
    userPrompt += `\nText to translate:\n${text}`

    const response = await fetch(TRANSLATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        deviceId,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.error, limitReached: data.limitReached }
    }

    // Save to translation history
    await saveToHistory(text, data.translated)

    return {
      translated: data.translated,
      usage: data.usage,
    }
  } catch (err) {
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      return { error: 'Network error — check your internet connection and try again.' }
    }
    return { error: `Translation failed: ${err.message}` }
  }
}

/**
 * 翻訳履歴を保存（最大20件）
 */
async function saveToHistory(original, translated) {
  try {
    const result = await chrome.storage.local.get(['translationHistory'])
    const history = result.translationHistory || []
    history.unshift({ original, translated, timestamp: Date.now() })
    if (history.length > 20) history.length = 20
    await chrome.storage.local.set({ translationHistory: history })
  } catch (e) {
    console.warn('GamerLingo: Failed to save translation history', e.message)
  }
}

/**
 * 使用量チェック
 */
async function handleCheckUsage() {
  try {
    const deviceId = await getDeviceId()
    const today = new Date().toISOString().split('T')[0]

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/usage_tracking?device_id=eq.${deviceId}&date=eq.${today}&select=count`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )

    const data = await response.json()
    const count = data?.[0]?.count || 0

    // Pro判定
    const proResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/pro_members?device_id=eq.${deviceId}&status=eq.active&select=status,expires_at`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )

    const proData = await proResponse.json()
    const isPro = proData?.length > 0

    return {
      count,
      limit: isPro ? Infinity : 10,
      canTranslate: isPro || count < 10,
      isPro,
    }
  } catch (err) {
    return { count: 0, limit: 10, canTranslate: true, isPro: false }
  }
}

async function getSettings() {
  const result = await chrome.storage.local.get(['targetLang'])
  return {
    targetLang: result.targetLang || 'ja',
  }
}

/**
 * AI返信候補を生成（Proのみ）
 */
async function handleGenerateReply(originalText, translatedText, context) {
  try {
    // Pro判定
    const usageInfo = await handleCheckUsage()
    if (!usageInfo.isPro) {
      return { error: 'Pro only', proOnly: true }
    }

    const deviceId = await getDeviceId()
    const settings = await getSettings()
    const targetLang = settings.targetLang || 'ja'

    const response = await fetch(GENERATE_REPLY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        originalText,
        translatedText,
        deviceId,
        targetLang,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.error || 'Failed to generate replies' }
    }

    return { replies: data.replies }
  } catch (err) {
    return { error: `Reply generation failed: ${err.message}` }
  }
}

/**
 * 単語帳に保存（最大100件）
 */
async function saveToWordBook(original, translated) {
  try {
    const result = await chrome.storage.local.get(['wordBook'])
    const wordBook = result.wordBook || []
    wordBook.unshift({ original, translated, savedAt: Date.now() })
    if (wordBook.length > 100) wordBook.length = 100
    await chrome.storage.local.set({ wordBook })
    return { success: true }
  } catch (e) {
    return { error: 'Failed to save word' }
  }
}

/**
 * 単語帳から削除
 */
async function deleteFromWordBook(savedAt) {
  try {
    const result = await chrome.storage.local.get(['wordBook'])
    const wordBook = (result.wordBook || []).filter(entry => entry.savedAt !== savedAt)
    await chrome.storage.local.set({ wordBook })
    return { success: true }
  } catch (e) {
    return { error: 'Failed to delete word' }
  }
}

async function handleManageSubscription() {
  try {
    const deviceId = await getDeviceId()
    const response = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ deviceId }),
    })

    const data = await response.json()
    if (data.url) {
      chrome.tabs.create({ url: data.url })
      return { success: true }
    }
    return { error: data.error || 'Failed to open subscription management' }
  } catch (err) {
    return { error: `Subscription management failed: ${err.message}` }
  }
}

async function handleCreateCheckout(plan = 'monthly') {
  try {
    const deviceId = await getDeviceId()
    const response = await fetch(`${SUPABASE_URL}/functions/v1/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ deviceId, plan }),
    })

    const data = await response.json()
    if (data.url) {
      chrome.tabs.create({ url: data.url })
      return { success: true }
    }
    return { error: data.error || 'Failed to create checkout' }
  } catch (err) {
    return { error: `Checkout failed: ${err.message}` }
  }
}
