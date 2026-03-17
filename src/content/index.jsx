import { render } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'

// ===== サイト検出 =====
function detectSite() {
  const host = window.location.hostname
  if (host.includes('discord.com')) return 'discord'
  if (host.includes('steampowered.com') || host.includes('steamcommunity.com')) return 'steam'
  if (host.includes('twitch.tv')) return 'twitch'
  return 'other'
}

const SITE = detectSite()

// ===== Auto-translate設定 =====
let autoTranslateEnabled = false
let autoTranslateTargetLang = 'ja'

// 起動時にストレージから読み込み
;(async () => {
  try {
    const data = await chrome.storage.local.get(['autoTranslate', 'targetLang'])
    autoTranslateEnabled = !!data.autoTranslate
    if (data.targetLang) autoTranslateTargetLang = data.targetLang
  } catch (_) {}
})()

// ストレージ変更をリアルタイム監視
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.autoTranslate != null) {
    autoTranslateEnabled = !!changes.autoTranslate.newValue
  }
  if (changes.targetLang != null) {
    autoTranslateTargetLang = changes.targetLang.newValue || 'ja'
  }
})

// ===== ターゲット言語の文字を判定 =====
function isLikelyTargetLang(text, targetLang) {
  const cleaned = text.replace(/\s/g, '')
  if (cleaned.length === 0) return true
  const total = cleaned.length

  if (targetLang === 'ja') {
    const jaChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || []).length
    return jaChars / total > 0.5
  }
  if (targetLang === 'ko') {
    const koChars = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length
    return koChars / total > 0.5
  }
  if (targetLang === 'zh') {
    const zhChars = (text.match(/[\u4E00-\u9FFF]/g) || []).length
    return zhChars / total > 0.5
  }
  if (targetLang === 'ru') {
    const ruChars = (text.match(/[\u0400-\u04FF]/g) || []).length
    return ruChars / total > 0.5
  }
  if (targetLang === 'hi') {
    const hiChars = (text.match(/[\u0900-\u097F]/g) || []).length
    return hiChars / total > 0.5
  }
  if (targetLang === 'en') {
    const enChars = (text.match(/[a-zA-Z]/g) || []).length
    return enChars / total > 0.7
  }
  // For es, pt, de, fr — Latin-based, check for mostly ASCII/Latin
  const latinChars = (text.match(/[a-zA-Z\u00C0-\u024F]/g) || []).length
  return latinChars / total > 0.7
}

// ===== Auto-translate キュー =====
const autoTranslateQueue = []
let autoTranslateRunning = false
const AUTO_TRANSLATE_DELAY = 600

async function processAutoTranslateQueue() {
  if (autoTranslateRunning) return
  autoTranslateRunning = true

  while (autoTranslateQueue.length > 0) {
    const { text, container, context } = autoTranslateQueue.shift()

    // Skip if already has a translation
    if (container.querySelector('.gl-inline-translation')) continue

    try {
      const translated = await translateText(text, context)

      // Double-check it wasn't translated while we waited
      if (container.querySelector('.gl-inline-translation')) continue

      const translationDiv = document.createElement('div')
      translationDiv.className = 'gl-inline-translation'
      translationDiv.style.cssText = `
        background: rgba(108, 99, 255, 0.1);
        border-left: 2px solid #6c63ff;
        border-radius: 0 6px 6px 0;
        color: #b8b8d0;
        font-size: ${SITE === 'twitch' ? '12' : '13'}px;
        margin-top: ${SITE === 'twitch' ? '2' : '4'}px;
        padding: ${SITE === 'twitch' ? '2px 6px' : '4px 8px'};
        line-height: 1.4;
      `

      const badge = document.createElement('span')
      badge.textContent = 'GL'
      badge.style.cssText = `
        background: #6c63ff;
        color: #fff;
        font-size: 9px;
        font-weight: 700;
        border-radius: 3px;
        padding: 1px 4px;
        margin-right: 6px;
        vertical-align: middle;
      `

      const textSpan = document.createElement('span')
      textSpan.textContent = translated

      translationDiv.appendChild(badge)
      translationDiv.appendChild(textSpan)
      container.appendChild(translationDiv)
    } catch (err) {
      // Silently skip failed auto-translations (don't clutter chat)
      if (err.limitReached) {
        // Stop auto-translating if limit reached
        autoTranslateQueue.length = 0
        break
      }
    }

    // Delay between translations to avoid flooding API
    if (autoTranslateQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, AUTO_TRANSLATE_DELAY))
    }
  }

  autoTranslateRunning = false
}

function queueAutoTranslate(text, container, context) {
  // Deduplicate: skip if this text is already queued
  if (autoTranslateQueue.some(item => item.text === text)) return
  autoTranslateQueue.push({ text, container, context })
  processAutoTranslateQueue()
}

// ===== エラーメッセージ分類 =====
function classifyError(msg) {
  const m = (msg || '').toLowerCase()
  if (m.includes('fetch') || m.includes('network') || m.includes('timeout') || m.includes('failed to fetch') || m.includes('err_internet') || m.includes('net::')) {
    return 'Network error. Check your connection and try again.'
  }
  if (m.includes('no response') || m.includes('could not establish connection') || m.includes('receiving end does not exist')) {
    return 'Extension error. Try reloading the page.'
  }
  if (m.includes('api') || m.includes('500') || m.includes('502') || m.includes('503') || m.includes('429') || m.includes('rate limit') || m.includes('service') || m.includes('server')) {
    return 'Translation service temporarily unavailable. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

// ===== 翻訳キャッシュ（chrome.storage.local永続化 + 1時間TTL） =====
const translationCache = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const CACHE_STORAGE_KEY = 'translationCache'

// chrome.storage.localからキャッシュを復元
;(async () => {
  try {
    const data = await chrome.storage.local.get(CACHE_STORAGE_KEY)
    const entries = data[CACHE_STORAGE_KEY]
    if (entries && typeof entries === 'object') {
      const now = Date.now()
      for (const [key, value] of Object.entries(entries)) {
        if (value && typeof value.timestamp === 'number' && now - value.timestamp < CACHE_TTL_MS) {
          translationCache.set(key, value)
        }
      }
    }
  } catch (_) {
    // storage read failure is non-fatal
  }
})()

function saveCacheToStorage() {
  try {
    const entries = Object.fromEntries(translationCache.entries())
    chrome.storage.local.set({ [CACHE_STORAGE_KEY]: entries })
  } catch (_) {
    // storage write failure is non-fatal
  }
}

// ===== デバウンス用タイムスタンプ =====
let lastTranslateRequestTime = 0
const DEBOUNCE_MS = 500

// ===== 翻訳API呼び出し（キャッシュ付き） =====
async function translateText(text, context) {
  // Truncate input to 500 characters
  const MAX_INPUT_LENGTH = 500
  if (text.length > MAX_INPUT_LENGTH) {
    text = text.slice(0, MAX_INPUT_LENGTH) + '... (truncated)'
  }

  // デバウンス: 500ms以内の連続リクエストを無視
  const now = Date.now()
  if (now - lastTranslateRequestTime < DEBOUNCE_MS) {
    throw new Error('Please wait a moment before translating again.')
  }
  lastTranslateRequestTime = now

  // キャッシュにあればそのまま返す（API節約 + 結果が安定する）
  if (translationCache.has(text)) {
    const cached = translationCache.get(text)
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.translated
    }
    // TTL切れなら削除
    translationCache.delete(text)
  }

  const response = await chrome.runtime.sendMessage({
    type: 'TRANSLATE_TEXT',
    text,
    context: context || `${SITE} gaming chat`,
  })
  if (!response || response.error) {
    if (response?.limitReached) {
      const err = new Error(response.error)
      err.limitReached = true
      throw err
    }
    throw new Error(classifyError(response?.error || 'No response'))
  }

  // キャッシュに保存（最大500件、古いのから削除）
  if (translationCache.size > 500) {
    const firstKey = translationCache.keys().next().value
    translationCache.delete(firstKey)
  }
  translationCache.set(text, { translated: response.translated, timestamp: Date.now() })
  saveCacheToStorage()

  return response.translated
}

// ===== 返信生成 =====
async function generateReplies(originalText, translatedText) {
  const response = await chrome.runtime.sendMessage({
    type: 'GENERATE_REPLY',
    originalText,
    translatedText,
  })
  return response
}

// ===== 翻訳ポップアップ =====
function TranslationPopup({ result, position, onClose, onRetry }) {
  const ref = useRef(null)
  const [replyState, setReplyState] = useState({ loading: false, replies: null, error: null, proOnly: false, copiedIdx: null })
  const [bookmarkSaved, setBookmarkSaved] = useState(false)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!result) return null

  const handleGenerateReply = async () => {
    setReplyState({ loading: true, replies: null, error: null, proOnly: false, copiedIdx: null })
    const res = await generateReplies(result.original, result.translated)
    if (res.proOnly) {
      setReplyState({ loading: false, replies: null, error: null, proOnly: true, copiedIdx: null })
    } else if (res.error) {
      setReplyState({ loading: false, replies: null, error: res.error, proOnly: false, copiedIdx: null })
    } else {
      setReplyState({ loading: false, replies: res.replies, error: null, proOnly: false, copiedIdx: null })
    }
  }

  const handleBookmark = async () => {
    if (bookmarkSaved) return
    await chrome.runtime.sendMessage({ type: 'SAVE_WORD', original: result.original, translated: result.translated })
    setBookmarkSaved(true)
    setTimeout(() => setBookmarkSaved(false), 1000)
  }

  const handleCopyReply = (text, idx) => {
    navigator.clipboard.writeText(text)
    setReplyState(prev => ({ ...prev, copiedIdx: idx }))
    setTimeout(() => setReplyState(prev => ({ ...prev, copiedIdx: null })), 1500)
  }

  return (
    <div
      ref={ref}
      className="gamerlingo-popup"
      style={{
        position: 'fixed',
        left: `${Math.min(position.x, window.innerWidth - 340)}px`,
        top: `${Math.min(position.y + 10, window.innerHeight - 200)}px`,
        zIndex: 2147483647,
      }}
    >
      <div className="gamerlingo-header">
        <span className="gamerlingo-logo">🎮 GamerLingo</span>
        <button className="gamerlingo-close" onClick={onClose}>×</button>
      </div>
      <div className="gamerlingo-body">
        {result.limitReached ? (
          <div className="gamerlingo-upsell">
            <div className="gamerlingo-upsell-title">Daily limit reached (10/10)</div>
            <div className="gamerlingo-upsell-desc">Upgrade to Pro for unlimited translations!</div>
            <button
              className="gamerlingo-upsell-btn"
              onClick={() => {
                chrome.runtime.sendMessage({ type: 'CREATE_CHECKOUT' })
              }}
            >
              Upgrade to Pro
            </button>
          </div>
        ) : result.error ? (
          <div className="gamerlingo-error">
            {result.error}
            {onRetry && (
              <button className="gamerlingo-retry" onClick={onRetry}>Retry</button>
            )}
          </div>
        ) : (
          <>
            <div className="gamerlingo-original">{result.original}</div>
            <div className="gamerlingo-divider">↓</div>
            <div className="gamerlingo-translated">{result.translated}</div>
          </>
        )}
      </div>
      {!result.error && !result.limitReached && (
        <div className="gamerlingo-footer">
          <button
            className="gamerlingo-copy"
            onClick={() => navigator.clipboard.writeText(result.translated)}
          >
            Copy
          </button>
          <button
            className="gamerlingo-bookmark"
            onClick={handleBookmark}
            title="Save to Word Book"
          >
            {bookmarkSaved ? 'Saved!' : '\u2B50'}
          </button>
          <button
            className="gamerlingo-reply-btn"
            onClick={handleGenerateReply}
            disabled={replyState.loading}
          >
            {replyState.loading ? '...' : '\uD83D\uDCAC Reply'}
          </button>
        </div>
      )}
      {replyState.proOnly && (
        <div className="gamerlingo-reply-upsell">
          Pro feature — <a className="gamerlingo-reply-upgrade" onClick={() => chrome.runtime.sendMessage({ type: 'CREATE_CHECKOUT' })}>Upgrade</a>
        </div>
      )}
      {replyState.error && !replyState.proOnly && (
        <div className="gamerlingo-reply-error">{replyState.error}</div>
      )}
      {replyState.replies && (
        <div className="gamerlingo-replies">
          {replyState.replies.map((reply, i) => (
            <button
              key={i}
              className="gamerlingo-reply-option"
              onClick={() => handleCopyReply(reply, i)}
            >
              {replyState.copiedIdx === i ? 'Copied!' : reply}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LoadingPopup({ position }) {
  return (
    <div
      className="gamerlingo-popup"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y + 10}px`,
        zIndex: 2147483647,
      }}
    >
      <div className="gamerlingo-header">
        <span className="gamerlingo-logo">🎮 GamerLingo</span>
      </div>
      <div className="gamerlingo-body">
        <div className="gamerlingo-loading">Translating...</div>
      </div>
    </div>
  )
}

// ===== インライン翻訳（メッセージの下に翻訳を表示） =====
function InlineTranslation({ text }) {
  return (
    <div className="gamerlingo-inline">
      <span className="gamerlingo-inline-badge">GL</span>
      <span className="gamerlingo-inline-text">{text}</span>
    </div>
  )
}

// ===== メインApp =====
function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const lastRequestRef = useRef(null)

  // 右クリック翻訳
  useEffect(() => {
    const handler = async (message) => {
      if (message.type === 'CONTEXT_MENU_TRANSLATE') {
        const selection = window.getSelection()
        let pos = { x: 100, y: 100 }
        if (selection.rangeCount > 0) {
          const rect = selection.getRangeAt(0).getBoundingClientRect()
          pos = { x: rect.left, y: rect.bottom }
        }
        await doTranslate(message.text, pos)
      }
      if (message.type === 'SHORTCUT_TRANSLATE') {
        const selection = window.getSelection()
        const text = selection?.toString().trim()
        if (text) {
          let pos = { x: 100, y: 100 }
          if (selection.rangeCount > 0) {
            const rect = selection.getRangeAt(0).getBoundingClientRect()
            pos = { x: rect.left, y: rect.bottom }
          }
          await doTranslate(text, pos)
        }
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  async function doTranslate(text, pos) {
    lastRequestRef.current = { text, pos }
    setPosition(pos)
    setLoading(true)
    setResult(null)
    try {
      const translated = await translateText(text)
      setResult({ original: text, translated })
    } catch (err) {
      setResult({ original: text, error: err.message, limitReached: !!err.limitReached })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {loading && <LoadingPopup position={position} />}
      {result && (
        <TranslationPopup
          result={result}
          position={position}
          onClose={() => { setResult(null); setLoading(false) }}
          onRetry={result.error && !result.limitReached && lastRequestRef.current
            ? () => doTranslate(lastRequestRef.current.text, lastRequestRef.current.pos)
            : null}
        />
      )}
    </>
  )
}

// ===== Shadow DOMセットアップ =====
const container = document.createElement('div')
container.id = 'gamerlingo-root'
document.body.appendChild(container)

const shadow = container.attachShadow({ mode: 'open' })
const mountPoint = document.createElement('div')
shadow.appendChild(mountPoint)

const style = document.createElement('style')
style.textContent = `
  .gamerlingo-popup {
    background: #1a1a2e;
    border: 1px solid #6c63ff;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(108, 99, 255, 0.3);
    color: #e0e0e0;
    font-family: 'Segoe UI', -apple-system, sans-serif;
    font-size: 14px;
    max-width: 320px;
    min-width: 200px;
    overflow: hidden;
    animation: gamerlingo-fadein 0.15s ease-out;
  }
  @keyframes gamerlingo-fadein {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .gamerlingo-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #16213e;
    border-bottom: 1px solid #2a2a4a;
  }
  .gamerlingo-logo {
    font-weight: 700;
    font-size: 13px;
    color: #6c63ff;
  }
  .gamerlingo-close {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 16px;
    padding: 0 4px;
    margin-left: auto;
  }
  .gamerlingo-close:hover { color: #ff6b6b; }
  .gamerlingo-body { padding: 12px; }
  .gamerlingo-original {
    color: #999;
    font-size: 12px;
    margin-bottom: 4px;
    word-break: break-word;
  }
  .gamerlingo-divider {
    text-align: center;
    color: #6c63ff;
    font-size: 12px;
    margin: 4px 0;
  }
  .gamerlingo-translated {
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    word-break: break-word;
    line-height: 1.5;
  }
  .gamerlingo-error { color: #ff6b6b; font-size: 13px; }
  .gamerlingo-retry {
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    border-radius: 6px;
    color: #6c63ff;
    cursor: pointer;
    font-size: 12px;
    margin-left: 8px;
    padding: 2px 10px;
    transition: background 0.15s, color 0.15s;
  }
  .gamerlingo-retry:hover {
    background: #6c63ff;
    color: #fff;
  }
  .gamerlingo-upsell { text-align: center; padding: 4px 0; }
  .gamerlingo-upsell-title {
    color: #ffb86c;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .gamerlingo-upsell-desc {
    color: #999;
    font-size: 12px;
    margin-bottom: 10px;
  }
  .gamerlingo-upsell-btn {
    background: linear-gradient(135deg, #6c63ff 0%, #a855f7 100%);
    border: none;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 20px;
    transition: opacity 0.15s;
  }
  .gamerlingo-upsell-btn:hover { opacity: 0.85; }
  .gamerlingo-loading {
    color: #6c63ff;
    text-align: center;
    padding: 8px;
  }
  .gamerlingo-footer {
    padding: 6px 12px 8px;
    display: flex;
    gap: 6px;
  }
  .gamerlingo-copy {
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    border-radius: 6px;
    color: #ccc;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 10px;
  }
  .gamerlingo-copy:hover {
    background: #6c63ff;
    border-color: #6c63ff;
    color: #fff;
  }
  .gamerlingo-bookmark {
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    border-radius: 6px;
    color: #ccc;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 10px;
  }
  .gamerlingo-bookmark:hover {
    background: #6c63ff;
    border-color: #6c63ff;
    color: #fff;
  }
  .gamerlingo-reply-btn {
    background: #1a3a2a;
    border: 1px solid #2a5a3a;
    border-radius: 6px;
    color: #7ecf9a;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 10px;
    transition: background 0.15s, color 0.15s;
  }
  .gamerlingo-reply-btn:hover {
    background: #2a5a3a;
    color: #fff;
  }
  .gamerlingo-reply-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .gamerlingo-replies {
    padding: 4px 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .gamerlingo-reply-option {
    background: #1a3a2a;
    border: 1px solid #2a5a3a;
    border-radius: 6px;
    color: #c8e6d0;
    cursor: pointer;
    font-size: 12px;
    padding: 6px 10px;
    text-align: left;
    word-break: break-word;
    transition: background 0.15s, color 0.15s;
  }
  .gamerlingo-reply-option:hover {
    background: #2a5a3a;
    color: #fff;
  }
  .gamerlingo-reply-upsell {
    padding: 4px 12px 8px;
    font-size: 12px;
    color: #ffb86c;
    text-align: center;
  }
  .gamerlingo-reply-upgrade {
    color: #a855f7;
    cursor: pointer;
    text-decoration: underline;
  }
  .gamerlingo-reply-error {
    padding: 4px 12px 8px;
    font-size: 12px;
    color: #ff6b6b;
  }
`
shadow.appendChild(style)
render(<App />, mountPoint)

// ===== チャット自動翻訳ボタン注入 =====
// Discord/Twitchのチャットメッセージに翻訳ボタンを自動で追加する

const PROCESSED_ATTR = 'data-gamerlingo'

/**
 * Discord: チャットメッセージに翻訳ボタンを追加
 */
function injectDiscordButtons() {
  // Discordのメッセージコンテナを取得
  const messages = document.querySelectorAll(
    '[class*="messageContent_"]:not([data-gamerlingo]), ' +
    '[id^="message-content-"]:not([data-gamerlingo]), ' +
    '[class*="markup_"][class*="messageContent"]:not([data-gamerlingo])'
  )

  messages.forEach((msg) => {
    msg.setAttribute(PROCESSED_ATTR, 'true')

    const text = msg.textContent?.trim()
    if (!text || text.length < 2) return

    // 翻訳ボタンを作成
    const btn = document.createElement('button')
    btn.textContent = '🌐'
    btn.title = 'GamerLingo: Translate'
    btn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      opacity: 0.4;
      padding: 0 4px;
      transition: opacity 0.15s;
      vertical-align: middle;
    `
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1' })
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.4' })

    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      e.preventDefault()

      // 既に翻訳済みなら削除してトグル
      const existing = msg.querySelector('.gl-inline-translation')
      if (existing) {
        existing.remove()
        return
      }

      btn.textContent = '⏳'

      try {
        const translated = await translateText(text, 'Discord gaming chat')

        const translationDiv = document.createElement('div')
        translationDiv.className = 'gl-inline-translation'
        translationDiv.style.cssText = `
          background: rgba(108, 99, 255, 0.1);
          border-left: 2px solid #6c63ff;
          border-radius: 0 6px 6px 0;
          color: #b8b8d0;
          font-size: 13px;
          margin-top: 4px;
          padding: 4px 8px;
          line-height: 1.4;
        `

        const textSpan = document.createElement('span')
        textSpan.textContent = translated

        const replyBtn = document.createElement('button')
        replyBtn.textContent = '\uD83D\uDCAC Reply'
        replyBtn.style.cssText = `
          background: #1a3a2a;
          border: 1px solid #2a5a3a;
          border-radius: 4px;
          color: #7ecf9a;
          cursor: pointer;
          font-size: 11px;
          margin-left: 8px;
          padding: 2px 8px;
          transition: background 0.15s;
          vertical-align: middle;
        `
        replyBtn.addEventListener('mouseenter', () => { replyBtn.style.background = '#2a5a3a' })
        replyBtn.addEventListener('mouseleave', () => { replyBtn.style.background = '#1a3a2a' })
        replyBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation()
          replyBtn.textContent = '...'
          replyBtn.disabled = true
          const res = await generateReplies(text, translated)
          if (res.proOnly) {
            const upsell = document.createElement('div')
            upsell.style.cssText = 'font-size:11px;color:#ffb86c;margin-top:4px;'
            upsell.textContent = 'Pro feature \u2014 '
            const upgradeLink = document.createElement('a')
            upgradeLink.textContent = 'Upgrade'
            upgradeLink.style.cssText = 'color:#a855f7;cursor:pointer;text-decoration:underline;'
            upgradeLink.addEventListener('click', (e) => {
              e.stopPropagation()
              chrome.runtime.sendMessage({ type: 'CREATE_CHECKOUT' })
            })
            upsell.appendChild(upgradeLink)
            translationDiv.appendChild(upsell)
          } else if (res.replies) {
            const repliesDiv = document.createElement('div')
            repliesDiv.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-top:4px;'
            res.replies.forEach((reply) => {
              const opt = document.createElement('button')
              opt.textContent = reply
              opt.style.cssText = `
                background: #1a3a2a;
                border: 1px solid #2a5a3a;
                border-radius: 4px;
                color: #c8e6d0;
                cursor: pointer;
                font-size: 11px;
                padding: 3px 8px;
                text-align: left;
                word-break: break-word;
                transition: background 0.15s;
              `
              opt.addEventListener('mouseenter', () => { opt.style.background = '#2a5a3a' })
              opt.addEventListener('mouseleave', () => { opt.style.background = '#1a3a2a' })
              opt.addEventListener('click', (e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(reply)
                const orig = opt.textContent
                opt.textContent = 'Copied!'
                setTimeout(() => { opt.textContent = orig }, 1500)
              })
              repliesDiv.appendChild(opt)
            })
            translationDiv.appendChild(repliesDiv)
          }
          replyBtn.textContent = '\uD83D\uDCAC Reply'
          replyBtn.disabled = false
        })

        const bookmarkBtn = document.createElement('button')
        bookmarkBtn.textContent = '\u2B50'
        bookmarkBtn.title = 'Save to Word Book'
        bookmarkBtn.style.cssText = `
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          margin-left: 4px;
          padding: 0 2px;
          opacity: 0.6;
          transition: opacity 0.15s;
          vertical-align: middle;
        `
        bookmarkBtn.addEventListener('mouseenter', () => { bookmarkBtn.style.opacity = '1' })
        bookmarkBtn.addEventListener('mouseleave', () => { bookmarkBtn.style.opacity = '0.6' })
        bookmarkBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation()
          await chrome.runtime.sendMessage({ type: 'SAVE_WORD', original: text, translated })
          bookmarkBtn.textContent = 'Saved!'
          setTimeout(() => { bookmarkBtn.textContent = '\u2B50' }, 1000)
        })

        translationDiv.appendChild(textSpan)
        translationDiv.appendChild(bookmarkBtn)
        translationDiv.appendChild(replyBtn)
        msg.appendChild(translationDiv)
      } catch (err) {
        const errorDiv = document.createElement('div')
        errorDiv.className = 'gl-inline-translation'
        if (err.limitReached) {
          errorDiv.style.cssText = `
            background: rgba(255, 184, 108, 0.1);
            border-left: 2px solid #ffb86c;
            border-radius: 0 6px 6px 0;
            font-size: 12px;
            margin-top: 4px;
            padding: 4px 8px;
            line-height: 1.4;
          `
          const limitSpan = document.createElement('span')
          limitSpan.style.cssText = 'color:#ffb86c;font-weight:600;'
          limitSpan.textContent = 'Daily limit reached (10/10). '
          errorDiv.appendChild(limitSpan)
          const upgradeLink = document.createElement('a')
          upgradeLink.style.cssText = 'color:#a855f7;cursor:pointer;text-decoration:underline;'
          upgradeLink.textContent = 'Upgrade to Pro'
          upgradeLink.addEventListener('click', (ev) => {
            ev.stopPropagation()
            chrome.runtime.sendMessage({ type: 'CREATE_CHECKOUT' })
          })
          errorDiv.appendChild(upgradeLink)
          errorDiv.appendChild(document.createTextNode(' for unlimited!'))
        } else {
          errorDiv.style.cssText = 'color: #ff6b6b; font-size: 12px; margin-top: 4px;'
          errorDiv.textContent = err.message
          const retryLink = document.createElement('a')
          retryLink.textContent = ' Retry'
          retryLink.style.cssText = 'color:#6c63ff;cursor:pointer;text-decoration:underline;margin-left:6px;'
          retryLink.addEventListener('click', (ev) => {
            ev.stopPropagation()
            errorDiv.remove()
            btn.click()
          })
          errorDiv.appendChild(retryLink)
        }
        msg.appendChild(errorDiv)
      } finally {
        btn.textContent = '🌐'
      }
    })

    // メッセージの末尾にボタンを追加
    msg.appendChild(btn)

    // Auto-translate: キューに追加
    if (autoTranslateEnabled && !isLikelyTargetLang(text, autoTranslateTargetLang)) {
      queueAutoTranslate(text, msg, 'Discord gaming chat')
    }
  })
}

/**
 * Twitch: チャットメッセージに翻訳ボタンを追加
 */
function injectTwitchButtons() {
  const messages = document.querySelectorAll(
    '[data-a-target="chat-line-message-body"]:not([data-gamerlingo]), .chat-line__message--body:not([data-gamerlingo])'
  )

  messages.forEach((msg) => {
    msg.setAttribute(PROCESSED_ATTR, 'true')

    const text = msg.textContent?.trim()
    if (!text || text.length < 2) return

    const wrapper = msg.closest('[class*="chat-line"]')
    if (!wrapper) return

    // 既にボタンがあればスキップ
    if (wrapper.querySelector('.gl-twitch-btn')) return

    const btn = document.createElement('button')
    btn.className = 'gl-twitch-btn'
    btn.textContent = '🌐'
    btn.title = 'GamerLingo: Translate'
    btn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      opacity: 0.4;
      padding: 0 3px;
      transition: opacity 0.15s;
      vertical-align: middle;
      display: inline;
    `
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1' })
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.4' })

    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      e.preventDefault()

      const existing = wrapper.querySelector('.gl-inline-translation')
      if (existing) {
        existing.remove()
        return
      }

      btn.textContent = '⏳'

      try {
        const translated = await translateText(text, 'Twitch live stream chat')

        const translationDiv = document.createElement('div')
        translationDiv.className = 'gl-inline-translation'
        translationDiv.style.cssText = `
          background: rgba(108, 99, 255, 0.15);
          border-left: 2px solid #6c63ff;
          border-radius: 0 4px 4px 0;
          color: #b8b8d0;
          font-size: 12px;
          margin-top: 2px;
          padding: 2px 6px;
          line-height: 1.3;
        `

        const textSpan = document.createElement('span')
        textSpan.textContent = translated

        const replyBtn = document.createElement('button')
        replyBtn.textContent = '\uD83D\uDCAC Reply'
        replyBtn.style.cssText = `
          background: #1a3a2a;
          border: 1px solid #2a5a3a;
          border-radius: 4px;
          color: #7ecf9a;
          cursor: pointer;
          font-size: 10px;
          margin-left: 6px;
          padding: 1px 6px;
          transition: background 0.15s;
          vertical-align: middle;
        `
        replyBtn.addEventListener('mouseenter', () => { replyBtn.style.background = '#2a5a3a' })
        replyBtn.addEventListener('mouseleave', () => { replyBtn.style.background = '#1a3a2a' })
        replyBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation()
          replyBtn.textContent = '...'
          replyBtn.disabled = true
          const res = await generateReplies(text, translated)
          if (res.proOnly) {
            const upsell = document.createElement('div')
            upsell.style.cssText = 'font-size:10px;color:#ffb86c;margin-top:3px;'
            upsell.textContent = 'Pro feature \u2014 '
            const upgradeLink = document.createElement('a')
            upgradeLink.textContent = 'Upgrade'
            upgradeLink.style.cssText = 'color:#a855f7;cursor:pointer;text-decoration:underline;'
            upgradeLink.addEventListener('click', (e) => {
              e.stopPropagation()
              chrome.runtime.sendMessage({ type: 'CREATE_CHECKOUT' })
            })
            upsell.appendChild(upgradeLink)
            translationDiv.appendChild(upsell)
          } else if (res.replies) {
            const repliesDiv = document.createElement('div')
            repliesDiv.style.cssText = 'display:flex;flex-direction:column;gap:2px;margin-top:3px;'
            res.replies.forEach((reply) => {
              const opt = document.createElement('button')
              opt.textContent = reply
              opt.style.cssText = `
                background: #1a3a2a;
                border: 1px solid #2a5a3a;
                border-radius: 4px;
                color: #c8e6d0;
                cursor: pointer;
                font-size: 10px;
                padding: 2px 6px;
                text-align: left;
                word-break: break-word;
                transition: background 0.15s;
              `
              opt.addEventListener('mouseenter', () => { opt.style.background = '#2a5a3a' })
              opt.addEventListener('mouseleave', () => { opt.style.background = '#1a3a2a' })
              opt.addEventListener('click', (e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(reply)
                const orig = opt.textContent
                opt.textContent = 'Copied!'
                setTimeout(() => { opt.textContent = orig }, 1500)
              })
              repliesDiv.appendChild(opt)
            })
            translationDiv.appendChild(repliesDiv)
          }
          replyBtn.textContent = '\uD83D\uDCAC Reply'
          replyBtn.disabled = false
        })

        const bookmarkBtn = document.createElement('button')
        bookmarkBtn.textContent = '\u2B50'
        bookmarkBtn.title = 'Save to Word Book'
        bookmarkBtn.style.cssText = `
          background: none;
          border: none;
          cursor: pointer;
          font-size: 11px;
          margin-left: 3px;
          padding: 0 2px;
          opacity: 0.6;
          transition: opacity 0.15s;
          vertical-align: middle;
        `
        bookmarkBtn.addEventListener('mouseenter', () => { bookmarkBtn.style.opacity = '1' })
        bookmarkBtn.addEventListener('mouseleave', () => { bookmarkBtn.style.opacity = '0.6' })
        bookmarkBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation()
          await chrome.runtime.sendMessage({ type: 'SAVE_WORD', original: text, translated })
          bookmarkBtn.textContent = 'Saved!'
          setTimeout(() => { bookmarkBtn.textContent = '\u2B50' }, 1000)
        })

        translationDiv.appendChild(textSpan)
        translationDiv.appendChild(bookmarkBtn)
        translationDiv.appendChild(replyBtn)
        wrapper.appendChild(translationDiv)
      } catch (err) {
        if (err.limitReached) {
          const errorDiv = document.createElement('div')
          errorDiv.className = 'gl-inline-translation'
          errorDiv.style.cssText = `
            background: rgba(255, 184, 108, 0.1);
            border-left: 2px solid #ffb86c;
            border-radius: 0 4px 4px 0;
            font-size: 11px;
            margin-top: 2px;
            padding: 2px 6px;
            line-height: 1.3;
          `
          const limitSpan = document.createElement('span')
          limitSpan.style.cssText = 'color:#ffb86c;font-weight:600;'
          limitSpan.textContent = 'Daily limit reached (10/10). '
          errorDiv.appendChild(limitSpan)
          const upgradeLink = document.createElement('a')
          upgradeLink.style.cssText = 'color:#a855f7;cursor:pointer;text-decoration:underline;'
          upgradeLink.textContent = 'Upgrade to Pro'
          upgradeLink.addEventListener('click', (ev) => {
            ev.stopPropagation()
            chrome.runtime.sendMessage({ type: 'CREATE_CHECKOUT' })
          })
          errorDiv.appendChild(upgradeLink)
          errorDiv.appendChild(document.createTextNode(' for unlimited!'))
          wrapper.appendChild(errorDiv)
        } else {
          const errorDiv = document.createElement('div')
          errorDiv.className = 'gl-inline-translation'
          errorDiv.style.cssText = 'color: #ff6b6b; font-size: 11px; margin-top: 2px;'
          errorDiv.textContent = err.message
          const retryLink = document.createElement('a')
          retryLink.textContent = ' Retry'
          retryLink.style.cssText = 'color:#6c63ff;cursor:pointer;text-decoration:underline;margin-left:6px;'
          retryLink.addEventListener('click', (ev) => {
            ev.stopPropagation()
            errorDiv.remove()
            btn.click()
          })
          errorDiv.appendChild(retryLink)
          wrapper.appendChild(errorDiv)
        }
      } finally {
        btn.textContent = '🌐'
      }
    })

    msg.appendChild(btn)

    // Auto-translate: キューに追加
    if (autoTranslateEnabled && !isLikelyTargetLang(text, autoTranslateTargetLang)) {
      queueAutoTranslate(text, wrapper, 'Twitch live stream chat')
    }
  })
}

/**
 * Steam: コミュニティ/ストア/プロフィールのコメントに翻訳ボタンを追加
 */
function injectSteamButtons() {
  const messages = document.querySelectorAll(
    '.forum_op .content:not([data-gamerlingo]), ' +
    '.commentthread_comment_text:not([data-gamerlingo]), ' +
    '.review_box .content:not([data-gamerlingo]), ' +
    '.apphub_CardTextContent:not([data-gamerlingo])'
  )

  messages.forEach((msg) => {
    msg.setAttribute(PROCESSED_ATTR, 'true')

    const text = msg.textContent?.trim()
    if (!text || text.length < 2) return

    // 翻訳ボタンを作成
    const btn = document.createElement('button')
    btn.textContent = '\uD83C\uDF10'
    btn.title = 'GamerLingo: Translate'
    btn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      opacity: 0.4;
      padding: 0 4px;
      transition: opacity 0.15s;
      vertical-align: middle;
    `
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1' })
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.4' })

    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      e.preventDefault()

      // 既に翻訳済みなら削除してトグル
      const existing = msg.querySelector('.gl-inline-translation')
      if (existing) {
        existing.remove()
        return
      }

      btn.textContent = '\u231B'

      try {
        const translated = await translateText(text, 'Steam community')

        const translationDiv = document.createElement('div')
        translationDiv.className = 'gl-inline-translation'
        translationDiv.style.cssText = `
          background: rgba(108, 99, 255, 0.1);
          border-left: 2px solid #6c63ff;
          border-radius: 0 6px 6px 0;
          color: #b8b8d0;
          font-size: 13px;
          margin-top: 4px;
          padding: 4px 8px;
          line-height: 1.4;
        `

        const textSpan = document.createElement('span')
        textSpan.textContent = translated

        const replyBtn = document.createElement('button')
        replyBtn.textContent = '\uD83D\uDCAC Reply'
        replyBtn.style.cssText = `
          background: #1a3a2a;
          border: 1px solid #2a5a3a;
          border-radius: 4px;
          color: #7ecf9a;
          cursor: pointer;
          font-size: 11px;
          margin-left: 8px;
          padding: 2px 8px;
          transition: background 0.15s;
          vertical-align: middle;
        `
        replyBtn.addEventListener('mouseenter', () => { replyBtn.style.background = '#2a5a3a' })
        replyBtn.addEventListener('mouseleave', () => { replyBtn.style.background = '#1a3a2a' })
        replyBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation()
          replyBtn.textContent = '...'
          replyBtn.disabled = true
          const res = await generateReplies(text, translated)
          if (res.proOnly) {
            const upsell = document.createElement('div')
            upsell.style.cssText = 'font-size:11px;color:#ffb86c;margin-top:4px;'
            upsell.textContent = 'Pro feature \u2014 '
            const upgradeLink = document.createElement('a')
            upgradeLink.textContent = 'Upgrade'
            upgradeLink.style.cssText = 'color:#a855f7;cursor:pointer;text-decoration:underline;'
            upgradeLink.addEventListener('click', (e) => {
              e.stopPropagation()
              chrome.runtime.sendMessage({ type: 'CREATE_CHECKOUT' })
            })
            upsell.appendChild(upgradeLink)
            translationDiv.appendChild(upsell)
          } else if (res.replies) {
            const repliesDiv = document.createElement('div')
            repliesDiv.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-top:4px;'
            res.replies.forEach((reply) => {
              const opt = document.createElement('button')
              opt.textContent = reply
              opt.style.cssText = `
                background: #1a3a2a;
                border: 1px solid #2a5a3a;
                border-radius: 4px;
                color: #c8e6d0;
                cursor: pointer;
                font-size: 11px;
                padding: 3px 8px;
                text-align: left;
                word-break: break-word;
                transition: background 0.15s;
              `
              opt.addEventListener('mouseenter', () => { opt.style.background = '#2a5a3a' })
              opt.addEventListener('mouseleave', () => { opt.style.background = '#1a3a2a' })
              opt.addEventListener('click', (e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(reply)
                const orig = opt.textContent
                opt.textContent = 'Copied!'
                setTimeout(() => { opt.textContent = orig }, 1500)
              })
              repliesDiv.appendChild(opt)
            })
            translationDiv.appendChild(repliesDiv)
          }
          replyBtn.textContent = '\uD83D\uDCAC Reply'
          replyBtn.disabled = false
        })

        const bookmarkBtn = document.createElement('button')
        bookmarkBtn.textContent = '\u2B50'
        bookmarkBtn.title = 'Save to Word Book'
        bookmarkBtn.style.cssText = `
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          margin-left: 4px;
          padding: 0 2px;
          opacity: 0.6;
          transition: opacity 0.15s;
          vertical-align: middle;
        `
        bookmarkBtn.addEventListener('mouseenter', () => { bookmarkBtn.style.opacity = '1' })
        bookmarkBtn.addEventListener('mouseleave', () => { bookmarkBtn.style.opacity = '0.6' })
        bookmarkBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation()
          await chrome.runtime.sendMessage({ type: 'SAVE_WORD', original: text, translated })
          bookmarkBtn.textContent = 'Saved!'
          setTimeout(() => { bookmarkBtn.textContent = '\u2B50' }, 1000)
        })

        translationDiv.appendChild(textSpan)
        translationDiv.appendChild(bookmarkBtn)
        translationDiv.appendChild(replyBtn)
        msg.appendChild(translationDiv)
      } catch (err) {
        const errorDiv = document.createElement('div')
        errorDiv.className = 'gl-inline-translation'
        if (err.limitReached) {
          errorDiv.style.cssText = `
            background: rgba(255, 184, 108, 0.1);
            border-left: 2px solid #ffb86c;
            border-radius: 0 6px 6px 0;
            font-size: 12px;
            margin-top: 4px;
            padding: 4px 8px;
            line-height: 1.4;
          `
          const limitSpan = document.createElement('span')
          limitSpan.style.cssText = 'color:#ffb86c;font-weight:600;'
          limitSpan.textContent = 'Daily limit reached (10/10). '
          errorDiv.appendChild(limitSpan)
          const upgradeLink = document.createElement('a')
          upgradeLink.style.cssText = 'color:#a855f7;cursor:pointer;text-decoration:underline;'
          upgradeLink.textContent = 'Upgrade to Pro'
          upgradeLink.addEventListener('click', (ev) => {
            ev.stopPropagation()
            chrome.runtime.sendMessage({ type: 'CREATE_CHECKOUT' })
          })
          errorDiv.appendChild(upgradeLink)
          errorDiv.appendChild(document.createTextNode(' for unlimited!'))
        } else {
          errorDiv.style.cssText = 'color: #ff6b6b; font-size: 12px; margin-top: 4px;'
          errorDiv.textContent = err.message
          const retryLink = document.createElement('a')
          retryLink.textContent = ' Retry'
          retryLink.style.cssText = 'color:#6c63ff;cursor:pointer;text-decoration:underline;margin-left:6px;'
          retryLink.addEventListener('click', (ev) => {
            ev.stopPropagation()
            errorDiv.remove()
            btn.click()
          })
          errorDiv.appendChild(retryLink)
        }
        msg.appendChild(errorDiv)
      } finally {
        btn.textContent = '\uD83C\uDF10'
      }
    })

    // メッセージの末尾にボタンを追加
    msg.appendChild(btn)

    // Auto-translate: キューに追加
    if (autoTranslateEnabled && !isLikelyTargetLang(text, autoTranslateTargetLang)) {
      queueAutoTranslate(text, msg, 'Steam community')
    }
  })
}

/**
 * MutationObserverでチャットの新しいメッセージを監視
 */
function startChatObserver() {
  if (SITE !== 'discord' && SITE !== 'twitch' && SITE !== 'steam') return

  const injectFn = SITE === 'discord'
    ? injectDiscordButtons
    : SITE === 'steam'
      ? injectSteamButtons
      : injectTwitchButtons

  // 初回実行
  injectFn()

  // DOMの変化を監視して新しいメッセージにボタンを追加（デバウンス付き）
  let injectPending = false
  const observer = new MutationObserver(() => {
    if (!injectPending) {
      injectPending = true
      requestAnimationFrame(() => {
        injectFn()
        injectPending = false
      })
    }
  })

  // チャットエリアが見つかるまでリトライ
  function findAndObserve() {
    let chatContainer = null

    if (SITE === 'discord') {
      // Discordのチャットスクロールエリア
      chatContainer = document.querySelector('[data-list-id="chat-messages"]')
        || document.querySelector('[class*="scroller_"][class*="content_"]')
        || document.querySelector('main [class*="chatContent"]')
        || document.querySelector('[class*="messagesWrapper_"]')
        || document.querySelector('ol[class*="scrollerInner_"]')?.parentElement
    } else if (SITE === 'twitch') {
      chatContainer = document.querySelector('[class*="chat-scrollable-area"]')
        || document.querySelector('.chat-list--default')
        || document.querySelector('[data-a-target="chat-scroller"]')
    } else if (SITE === 'steam') {
      // Steam is not an SPA — observe the main content area for dynamic comment loading
      chatContainer = document.querySelector('.forum_area')
        || document.querySelector('.commentthread_comments')
        || document.querySelector('.review_box')
        || document.querySelector('#AppHubContent')
        || document.body
    }

    if (chatContainer) {
      observer.observe(chatContainer, {
        childList: true,
        subtree: true,
      })
      // 初回注入
      injectFn()
    } else {
      // まだ読み込まれてなければリトライ
      setTimeout(findAndObserve, 2000)
    }
  }

  // SPAなのでページ遷移も監視
  findAndObserve()

  // URLの変化を監視（Discordはchannelを切り替える）
  let lastUrl = location.href
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      // チャネル変更時にリトライ
      setTimeout(findAndObserve, 1000)
    }
  })
  urlObserver.observe(document.body, { childList: true, subtree: true })
}

// 起動
startChatObserver()
