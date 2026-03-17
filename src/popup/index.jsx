import { render } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import './style.css'

const UI_STRINGS = {
  ja: {
    subtitle: 'AIゲーム翻訳',
    quickTranslate: 'クイック翻訳',
    placeholder: 'GG EZ noob...',
    translateTo: '翻訳先',
    todayUsage: '今日の使用量',
    upgradePro: '✨ Proにアップグレード — 無制限翻訳',
    howToUse: '使い方：',
    step1: 'Discord / Steam / Twitch でテキストを選択',
    step2: '右クリック →「GamerLingo: Translate」',
    step3: 'またはチャットの 🌐 をクリック',
    footer: 'GamerLingo v2.1.0 — ゲーマーのために',
    remaining: '残り{n}回',
    resetsAt: '0:00 UTCにリセット',
    recentTranslations: '最近の翻訳',
    autoTranslate: '自動翻訳',
    proFeature: 'Pro機能',
    wordBook: '単語帳',
    showMore: 'もっと見る',
    showLess: '折りたたむ',
    translatingText: '翻訳中...',
  },
  en: {
    subtitle: 'AI Game Translator',
    quickTranslate: 'Quick Translate',
    placeholder: 'GG EZ noob...',
    translateTo: 'Translate to',
    todayUsage: "Today's Usage",
    upgradePro: '✨ Upgrade to Pro — Unlimited Translations',
    howToUse: 'How to use:',
    step1: 'Select text on Discord / Steam / Twitch',
    step2: 'Right-click → "GamerLingo: Translate"',
    step3: 'Or click 🌐 on any chat message',
    footer: 'GamerLingo v2.1.0 — Made for gamers',
    remaining: '{n} remaining',
    resetsAt: 'Resets at 0:00 UTC',
    recentTranslations: 'Recent Translations',
    autoTranslate: 'Auto Translate',
    proFeature: 'Pro feature',
    wordBook: 'Word Book',
    showMore: 'Show more',
    showLess: 'Show less',
    translatingText: 'Translating...',
  },
  zh: {
    subtitle: 'AI游戏翻译器',
    quickTranslate: '快速翻译',
    placeholder: 'GG EZ noob...',
    translateTo: '翻译为',
    todayUsage: '今日用量',
    upgradePro: '✨ 升级Pro — 无限翻译',
    howToUse: '使用方法：',
    step1: '在 Discord / Steam / Twitch 选择文本',
    step2: '右键 →「GamerLingo: Translate」',
    step3: '或点击聊天中的 🌐',
    footer: 'GamerLingo v2.1.0 — 为玩家而生',
    remaining: '剩余{n}次',
    resetsAt: 'UTC 0:00 重置',
    recentTranslations: '最近翻译',
    autoTranslate: '自动翻译',
    proFeature: 'Pro功能',
    wordBook: '单词本',
    showMore: '查看更多',
    showLess: '收起',
    translatingText: '翻译中...',
  },
  ko: {
    subtitle: 'AI 게임 번역기',
    quickTranslate: '빠른 번역',
    placeholder: 'GG EZ noob...',
    translateTo: '번역 언어',
    todayUsage: '오늘 사용량',
    upgradePro: '✨ Pro 업그레이드 — 무제한 번역',
    howToUse: '사용법:',
    step1: 'Discord / Steam / Twitch에서 텍스트 선택',
    step2: '우클릭 → "GamerLingo: Translate"',
    step3: '또는 채팅의 🌐 클릭',
    footer: 'GamerLingo v2.1.0 — 게이머를 위해',
    remaining: '{n}회 남음',
    resetsAt: 'UTC 0:00에 초기화',
    recentTranslations: '최근 번역',
    autoTranslate: '자동 번역',
    proFeature: 'Pro 기능',
    wordBook: '단어장',
    showMore: '더 보기',
    showLess: '접기',
    translatingText: '번역 중...',
  },
  es: {
    subtitle: 'Traductor de juegos con IA',
    quickTranslate: 'Traducción rápida',
    placeholder: 'GG EZ noob...',
    translateTo: 'Traducir a',
    todayUsage: 'Uso de hoy',
    upgradePro: '✨ Mejorar a Pro — Traducciones ilimitadas',
    howToUse: 'Cómo usar:',
    step1: 'Selecciona texto en Discord / Steam / Twitch',
    step2: 'Clic derecho → "GamerLingo: Translate"',
    step3: 'O haz clic en 🌐 en cualquier mensaje',
    footer: 'GamerLingo v2.1.0 — Hecho para gamers',
    remaining: '{n} restantes',
    resetsAt: 'Se reinicia a las 0:00 UTC',
    recentTranslations: 'Traducciones recientes',
    autoTranslate: 'Auto traducción',
    proFeature: 'Pro función',
    wordBook: 'Vocabulario',
    showMore: 'Ver más',
    showLess: 'Ver menos',
    translatingText: 'Traduciendo...',
  },
  pt: {
    subtitle: 'Tradutor gamer com IA',
    quickTranslate: 'Tradução rápida',
    placeholder: 'GG EZ noob...',
    translateTo: 'Traduzir para',
    todayUsage: 'Uso de hoje',
    upgradePro: '✨ Upgrade Pro — Traduções ilimitadas',
    howToUse: 'Como usar:',
    step1: 'Selecione texto no Discord / Steam / Twitch',
    step2: 'Clique direito → "GamerLingo: Translate"',
    step3: 'Ou clique em 🌐 em qualquer mensagem',
    footer: 'GamerLingo v2.1.0 — Feito para gamers',
    remaining: '{n} restantes',
    resetsAt: 'Reinicia às 0:00 UTC',
    recentTranslations: 'Traduções recentes',
    autoTranslate: 'Auto tradução',
    proFeature: 'Pro recurso',
    wordBook: 'Vocabulário',
    showMore: 'Ver mais',
    showLess: 'Ver menos',
    translatingText: 'Traduzindo...',
  },
  ru: {
    subtitle: 'ИИ-переводчик для игр',
    quickTranslate: 'Быстрый перевод',
    placeholder: 'GG EZ noob...',
    translateTo: 'Перевести на',
    todayUsage: 'Использовано сегодня',
    upgradePro: '✨ Pro — Безлимитные переводы',
    howToUse: 'Как использовать:',
    step1: 'Выделите текст в Discord / Steam / Twitch',
    step2: 'ПКМ → "GamerLingo: Translate"',
    step3: 'Или нажмите 🌐 на сообщении',
    footer: 'GamerLingo v2.1.0 — Для геймеров',
    remaining: 'Осталось {n}',
    resetsAt: 'Сброс в 0:00 UTC',
    recentTranslations: 'Недавние переводы',
    autoTranslate: 'Авто-перевод',
    proFeature: 'Pro функция',
    wordBook: 'Словарь',
    showMore: 'Показать ещё',
    showLess: 'Свернуть',
    translatingText: 'Перевод...',
  },
  de: {
    subtitle: 'KI-Spieleübersetzer',
    quickTranslate: 'Schnellübersetzung',
    placeholder: 'GG EZ noob...',
    translateTo: 'Übersetzen in',
    todayUsage: 'Heutige Nutzung',
    upgradePro: '✨ Pro-Upgrade — Unbegrenzte Übersetzungen',
    howToUse: 'So geht\'s:',
    step1: 'Text in Discord / Steam / Twitch markieren',
    step2: 'Rechtsklick → "GamerLingo: Translate"',
    step3: 'Oder 🌐 bei einer Nachricht klicken',
    footer: 'GamerLingo v2.1.0 — Für Gamer gemacht',
    remaining: '{n} übrig',
    resetsAt: 'Reset um 0:00 UTC',
    recentTranslations: 'Letzte Übersetzungen',
    autoTranslate: 'Auto-Übersetzen',
    proFeature: 'Pro-Funktion',
    wordBook: 'Wörterbuch',
    showMore: 'Mehr anzeigen',
    showLess: 'Weniger',
    translatingText: 'Übersetze...',
  },
  fr: {
    subtitle: 'Traducteur gaming IA',
    quickTranslate: 'Traduction rapide',
    placeholder: 'GG EZ noob...',
    translateTo: 'Traduire en',
    todayUsage: "Utilisation aujourd'hui",
    upgradePro: '✨ Passer à Pro — Traductions illimitées',
    howToUse: 'Comment utiliser :',
    step1: 'Sélectionnez du texte sur Discord / Steam / Twitch',
    step2: 'Clic droit → "GamerLingo: Translate"',
    step3: 'Ou cliquez sur 🌐 sur un message',
    footer: 'GamerLingo v2.1.0 — Fait pour les gamers',
    remaining: '{n} restantes',
    resetsAt: 'Réinitialisation à 0:00 UTC',
    recentTranslations: 'Traductions récentes',
    autoTranslate: 'Auto-traduction',
    proFeature: 'Pro fonction',
    wordBook: 'Vocabulaire',
    showMore: 'Voir plus',
    showLess: 'Voir moins',
    translatingText: 'Traduction...',
  },
  hi: {
    subtitle: 'AI गेम ट्रांसलेटर',
    quickTranslate: 'क्विक ट्रांसलेट',
    placeholder: 'GG EZ noob...',
    translateTo: 'अनुवाद भाषा',
    todayUsage: 'आज का उपयोग',
    upgradePro: '✨ Pro अपग्रेड — अनलिमिटेड ट्रांसलेशन',
    howToUse: 'कैसे इस्तेमाल करें:',
    step1: 'Discord / Steam / Twitch पर टेक्स्ट सेलेक्ट करें',
    step2: 'राइट-क्लिक → "GamerLingo: Translate"',
    step3: 'या चैट में 🌐 पर क्लिक करें',
    footer: 'GamerLingo v2.1.0 — गेमर्स के लिए',
    remaining: '{n} शेष',
    resetsAt: '0:00 UTC पर रीसेट',
    recentTranslations: 'हाल के अनुवाद',
    autoTranslate: 'ऑटो ट्रांसलेट',
    proFeature: 'Pro फ़ीचर',
    wordBook: 'शब्दकोश',
    showMore: 'और देखें',
    showLess: 'कम देखें',
    translatingText: 'अनुवाद...',
  },
}

function App() {
  const [usage, setUsage] = useState({ count: 0, limit: 10, isPro: false })
  const [quickText, setQuickText] = useState('')
  const [quickResult, setQuickResult] = useState(null)
  const [translating, setTranslating] = useState(false)
  const [targetLang, setTargetLang] = useState('ja')
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [autoTranslate, setAutoTranslate] = useState(false)
  const [wordBook, setWordBook] = useState([])
  const [wordBookOpen, setWordBookOpen] = useState(false)
  const [wordBookShowAll, setWordBookShowAll] = useState(false)
  const [copiedHistoryIndex, setCopiedHistoryIndex] = useState(null)

  useEffect(() => {
    chrome.storage.local.get(['targetLang', 'autoTranslate'], (result) => {
      if (result.targetLang) setTargetLang(result.targetLang)
      if (result.autoTranslate) setAutoTranslate(result.autoTranslate)
    })

    chrome.runtime.sendMessage({ type: 'CHECK_USAGE' }, (response) => {
      if (response) setUsage(response)
    })

    chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (response) => {
      if (response) setHistory(response)
    })

    chrome.runtime.sendMessage({ type: 'GET_WORD_BOOK' }, (response) => {
      if (response) setWordBook(response)
    })
  }, [])

  const quickTranslate = async () => {
    if (!quickText.trim()) return
    setTranslating(true)
    setQuickResult(null)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_TEXT',
        text: quickText,
        context: 'gaming chat',
      })

      if (!response) {
        setQuickResult('Error: Extension not responding. Try closing and reopening the popup.')
      } else if (response.limitReached) {
        setQuickResult(`Daily limit reached (${usage.limit}/${usage.limit}). Upgrade to Pro for unlimited translations!`)
      } else if (response.error) {
        setQuickResult(response.error)
      } else {
        setQuickResult(response.translated)
        if (response.usage) setUsage({
          count: response.usage.count,
          limit: response.usage.limit || 10,
          isPro: response.usage.isPro,
        })
        // Refresh history
        chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (hist) => {
          if (hist) setHistory(hist)
        })
      }
    } catch (err) {
      if (err.message?.includes('Could not establish connection')) {
        setQuickResult('Error: Extension reloading. Please close and reopen the popup.')
      } else {
        setQuickResult(`Error: ${err.message}`)
      }
    } finally {
      setTranslating(false)
    }
  }

  const usagePercent = usage.limit === Infinity ? 0 : (usage.count / usage.limit) * 100
  const remaining = usage.isPro ? Infinity : Math.max(0, usage.limit - usage.count)
  const t = UI_STRINGS[targetLang] || UI_STRINGS.en

  return (
    <div className="flex flex-col h-full">
      <style>{`
        @keyframes upgradePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(108, 99, 255, 0.7); }
          50% { box-shadow: 0 0 12px 4px rgba(108, 99, 255, 0.5); }
        }
        .upgrade-pulse {
          animation: upgradePulse 1.5s ease-in-out infinite;
          border: 2px solid #ff6b6b;
        }
      `}</style>
      {/* Header */}
      <div className="bg-[#16213e] px-4 py-3 border-b border-[#2a2a4a]">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎮</span>
          <h1 className="text-lg font-bold text-[#6c63ff]">GamerLingo</h1>
          <span className="text-xs text-gray-500 ml-auto">
            {usage.isPro ? '✨ Pro' : 'Free'}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{t.subtitle}</p>
      </div>

      {/* Quick Translate */}
      <div className="px-4 py-3 border-b border-[#2a2a4a]">
        <label className="text-xs text-gray-400 block mb-1">{t.quickTranslate}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={quickText}
            onInput={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && quickTranslate()}
            placeholder={t.placeholder}
            className="flex-1 bg-[#1a1a2e] border border-[#3a3a5a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#6c63ff]"
          />
          <button
            onClick={quickTranslate}
            disabled={translating}
            aria-label="Translate"
            className="bg-[#6c63ff] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
          >
            {translating ? t.translatingText : '→'}
          </button>
        </div>
        {quickResult && (
          <div
            className="mt-2 p-2 bg-[#1a1a2e] rounded-lg text-sm"
            style={{ color: /[Ee]rror/.test(quickResult) ? '#ff6b6b' : '#ffffff' }}
          >
            {quickResult}
          </div>
        )}
      </div>

      {/* Recent Translations */}
      {history.length > 0 && (
        <div className="px-4 py-2 border-b border-[#2a2a4a]">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-label={historyOpen ? 'Collapse recent translations' : 'Expand recent translations'}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors w-full"
          >
            <span style={{ display: 'inline-block', transform: historyOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              ▶
            </span>
            {t.recentTranslations}
          </button>
          {historyOpen && (
            <div className="mt-2 space-y-1">
              {history.slice(0, 5).map((entry, i) => (
                <div
                  key={entry.timestamp + '-' + i}
                  onClick={() => {
                    navigator.clipboard.writeText(entry.translated)
                    setCopiedHistoryIndex(i)
                    setTimeout(() => setCopiedHistoryIndex(null), 1200)
                  }}
                  className="p-1.5 bg-[#1a1a2e] rounded cursor-pointer hover:bg-[#2a2a4a] transition-colors"
                  title={entry.original}
                >
                  <div className="text-[10px] text-gray-500 truncate">
                    {entry.original.length > 30 ? entry.original.slice(0, 30) + '...' : entry.original}
                  </div>
                  <div className="text-xs text-white truncate">
                    {copiedHistoryIndex === i ? <span style={{ color: '#6c63ff' }}>Copied!</span> : entry.translated}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Word Book */}
      {wordBook.length > 0 && (
        <div className="px-4 py-2 border-b border-[#2a2a4a]">
          <button
            onClick={() => setWordBookOpen(!wordBookOpen)}
            aria-label={wordBookOpen ? 'Collapse word book' : 'Expand word book'}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors w-full"
          >
            <span style={{ display: 'inline-block', transform: wordBookOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              ▶
            </span>
            {t.wordBook}
          </button>
          {wordBookOpen && (
            <div className="mt-2 space-y-1">
              {(wordBookShowAll ? wordBook : wordBook.slice(0, 10)).map((entry, i) => (
                <div
                  key={entry.savedAt + '-' + i}
                  className="p-1.5 bg-[#1a1a2e] rounded hover:bg-[#2a2a4a] transition-colors flex items-start gap-1"
                >
                  <div className="flex-1 min-w-0" onClick={() => navigator.clipboard.writeText(entry.translated)} style={{ cursor: 'pointer' }}>
                    <div className="text-[10px] text-gray-500 truncate">
                      {entry.original.length > 30 ? entry.original.slice(0, 30) + '...' : entry.original}
                    </div>
                    <div className="text-xs text-white truncate">→ {entry.translated}</div>
                  </div>
                  <button
                    onClick={() => {
                      chrome.runtime.sendMessage({ type: 'DELETE_WORD', savedAt: entry.savedAt }, () => {
                        setWordBook(prev => prev.filter(e => e.savedAt !== entry.savedAt))
                      })
                    }}
                    className="text-gray-600 hover:text-red-400 text-xs px-1 flex-shrink-0"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              ))}
              {wordBook.length > 10 && (
                <button
                  onClick={() => setWordBookShowAll(!wordBookShowAll)}
                  className="text-[10px] text-[#6c63ff] hover:text-[#a855f7] transition-colors w-full text-center py-1"
                >
                  {wordBookShowAll ? t.showLess : `${t.showMore} (${wordBook.length - 10})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Language Selection */}
      <div className="px-4 py-3 border-b border-[#2a2a4a]">
        <label className="text-xs text-gray-400 block mb-1">{t.translateTo}</label>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { code: 'ja', label: '日本語' },
            { code: 'en', label: 'EN' },
            { code: 'zh', label: '中文' },
            { code: 'ko', label: '한국어' },
            { code: 'es', label: 'ES' },
            { code: 'pt', label: 'PT-BR' },
            { code: 'ru', label: 'RU' },
            { code: 'de', label: 'DE' },
            { code: 'fr', label: 'FR' },
            { code: 'hi', label: 'हिंदी' },
          ].map(lang => (
            <button
              key={lang.code}
              aria-label={lang.label}
              onClick={() => {
                setTargetLang(lang.code)
                chrome.storage.local.set({ targetLang: lang.code })
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                targetLang === lang.code
                  ? 'bg-[#6c63ff] text-white'
                  : 'bg-[#2a2a4a] text-gray-400 hover:bg-[#3a3a5a]'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Auto Translate Toggle */}
      <div className="px-4 py-2.5 border-b border-[#2a2a4a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{t.autoTranslate}</span>
            {!usage.isPro && (
              <span className="text-[9px] font-bold text-[#a855f7] bg-[#a855f7]/15 px-1.5 py-0.5 rounded">
                {t.proFeature}
              </span>
            )}
          </div>
          <label className="relative inline-block w-9 h-5" style={{ opacity: usage.isPro ? 1 : 0.5 }}>
            <input
              type="checkbox"
              checked={autoTranslate}
              disabled={!usage.isPro}
              aria-label="Toggle auto-translate"
              onChange={(e) => {
                const val = e.target.checked
                setAutoTranslate(val)
                chrome.storage.local.set({ autoTranslate: val })
              }}
              className="sr-only peer"
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: usage.isPro ? 'pointer' : 'not-allowed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: autoTranslate ? '#6c63ff' : '#2a2a4a',
                borderRadius: '10px',
                transition: 'background 0.2s',
              }}
            />
            <span
              style={{
                position: 'absolute',
                height: '15px', width: '15px',
                left: autoTranslate ? '21px' : '3px',
                bottom: '2.5px',
                background: '#fff',
                borderRadius: '50%',
                transition: 'left 0.2s',
              }}
            />
          </label>
        </div>
      </div>

      {/* Usage */}
      <div className="px-4 py-3 border-b border-[#2a2a4a]">
        <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
          <span>{t.todayUsage}</span>
          <span
            className="font-bold text-sm"
            style={{ color: !usage.isPro && remaining <= 3 ? '#ff6b6b' : '#e0e0e0' }}
          >
            {usage.isPro ? '∞' : t.remaining.replace('{n}', remaining)}
          </span>
        </div>
        {!usage.isPro && (
          <>
            <div className="w-full bg-[#2a2a4a] rounded-full h-2 mb-1">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(usagePercent, 100)}%`,
                  background: usagePercent > 80 ? '#ff6b6b' : '#6c63ff',
                }}
              />
            </div>
            <div className="text-[10px] text-gray-500 mb-2">{t.resetsAt}</div>
            <button
              className={`w-full bg-gradient-to-r from-[#6c63ff] to-[#4834d4] text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity${remaining <= 3 ? ' upgrade-pulse' : ''}`}
              onClick={() => {
                chrome.runtime.sendMessage({ type: 'CREATE_CHECKOUT' })
              }}
            >
              {t.upgradePro}
            </button>
          </>
        )}
      </div>

      {/* How to use */}
      <div className="px-4 py-3 text-xs text-gray-500">
        <p className="font-medium text-gray-400 mb-1">{t.howToUse}</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>{t.step1}</li>
          <li>{t.step2}</li>
          <li>{t.step3}</li>
        </ol>
      </div>

      {/* Footer */}
      <div className="mt-auto px-4 py-2 bg-[#16213e] text-center">
        <span className="text-[10px] text-gray-600">
          {t.footer}
        </span>
      </div>
    </div>
  )
}

render(<App />, document.getElementById('app'))
