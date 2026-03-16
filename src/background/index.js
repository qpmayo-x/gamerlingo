// Background Service Worker — Supabase Edge Function経由で翻訳

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

// ===== スラング辞書 =====
const SLANG_EN_TO_JA = {
  'GG': 'おつ', 'GG EZ': '楽勝おつ', 'GLHF': 'よろしく',
  'WP': 'ナイスプレイ', 'GJ': 'グッジョブ',
  'noob': '雑魚', 'n00b': '雑魚', 'AFK': '離席', 'BRB': 'ちょっと離れる',
  'DC': '回線落ち', 'lag': 'ラグい', 'nerf': '弱体化', 'buff': '強化',
  'OP': 'ぶっ壊れ', 'meta': '環境最強', 'clutch': '神プレイ',
  'choke': 'やらかし', 'throw': '投げ', 'int': 'わざと負け',
  'feed': 'キル献上', 'carry': 'キャリー', 'smurf': '初心者狩り',
  'toxic': '害悪', 'tilted': 'イライラ', 'salty': '悔しがり',
  'gank': '奇襲', 'camp': '待ち伏せ', 'rush': '突撃',
  'DPS': '火力', 'tank': 'タンク', 'healer': 'ヒーラー',
  'wipe': '全滅', 'ace': 'エース', 'tryhard': 'ガチ勢',
  'RNG': '運ゲー', 'p2w': '課金ゲー', 'f2p': '無課金',
  'POG': 'すごい', 'KEKW': '草', 'EZ': '楽勝',
  'rekt': 'ボコボコ', 'get rekt': 'ボコボコにされろ',
  'lmao': '草', 'lol': '草', 'gg wp': 'おつナイス', 'ez clap': '楽勝',
  'diff': '格差', 'bot': 'Bot', 'cracked': 'うますぎ', 'goated': '神',
  'sus': '怪しい', 'based': 'わかる', 'cope': '負け惜しみ', 'ratio': '比率負け',
  'L': '負け', 'W': '勝ち', 'mid': '微妙', 'bussin': '最高',
  'cap': '嘘', 'no cap': 'ガチ', 'touch grass': '外出ろ', 'skill issue': '実力不足',
  'malding': 'ハゲるほどキレてる', 'copium': '負け惜しみ', 'sadge': '悲しい',
  'pog': 'すごい', 'poggers': 'やば', 'kappa': '冗談', 'pepe': 'ペペ',
  'one trick': '専', 'OTP': 'ワントリック', 'griefing': '荒らし',
  '1v1': 'タイマン', 'aimbot': 'エイムボット', 'wallhack': 'ウォールハック',
  'hacker': 'チーター', 'cheater': 'チーター', 'respawn': 'リスポーン',
  'cooldown': 'クールダウン', 'ult': '必殺技', 'aggro': 'ヘイト',
  'kite': 'カイト', 'peel': 'ピール', 'rotate': 'ローテ', 'flank': '裏取り',
  'push': 'プッシュ', 'pull': 'プル', 'ward': 'ワード', 'ping': 'ピン',
  'fps': 'フレームレート', 'ms': 'ミリ秒',
}

const SLANG_EN_TO_KO = {
  'GG': '지지', 'EZ': '이지', 'noob': '뉴비', 'OP': '사기캐',
  'nerf': '너프', 'buff': '버프', 'carry': '캐리', 'feed': '킬 헌납',
  'toxic': '트롤', 'tilted': '멘탈 나감', 'clutch': '클러치', 'camp': '캠핑',
  'rush': '러쉬', 'tank': '탱커', 'healer': '힐러', 'wipe': '전멸',
  'tryhard': '빡겜', 'smurf': '스머프', 'POG': '대박', 'KEKW': 'ㅋㅋㅋ',
  'rekt': '관광당함', 'AFK': '자리비움', 'DC': '렉', 'lag': '렉',
  'GJ': '잘했어', 'WP': '잘했어', 'GLHF': 'ㄱㄱ',
  'lmao': 'ㅋㅋㅋ', 'lol': 'ㅋㅋ', 'GG WP': '지지 잘했어', 'gg wp': '지지 잘함',
  'diff': '차이', 'bot': '봇', 'cracked': '미쳤다', 'sus': '의심',
  'cope': '정신승리', 'L': '패배', 'W': '승리', 'mid': '애매',
  'skill issue': '실력 문제', 'griefing': '트롤링', '1v1': '1대1',
  'hacker': '핵쟁이', 'cheater': '핵쟁이', 'respawn': '리스폰',
  'ult': '궁극기', 'aggro': '어그로', 'flank': '우회', 'push': '푸시',
  'rotate': '로테이션', 'ping': '핑', 'ez clap': '이지', 'goated': '갓',
  'meta': '메타', 'choke': '쵸크', 'throw': '던지기', 'int': '고의트롤',
  'salty': '소금', 'DPS': '딜러', 'ace': '에이스', 'RNG': '운빨',
  'p2w': '과금겜', 'f2p': '무과금',
}

const SLANG_EN_TO_ZH = {
  'GG': 'GG', 'EZ': '轻松', 'noob': '菜鸟', 'OP': '超模',
  'nerf': '削弱', 'buff': '加强', 'carry': '带飞', 'feed': '送人头',
  'toxic': '喷子', 'tilted': '上头', 'clutch': '绝杀', 'camp': '蹲人',
  'rush': '冲', 'tank': '坦克', 'healer': '奶妈', 'wipe': '团灭',
  'tryhard': '卷王', 'smurf': '小号', 'POG': '666', 'rekt': '被虐',
  'AFK': '挂机', 'DC': '掉线', 'lag': '卡了', 'GJ': '干得好',
  'WP': '打得好', 'GLHF': '加油',
  'lmao': '笑死', 'lol': '哈哈哈', 'gg wp': '打得好', 'diff': '差距',
  'bot': '机器人', 'cracked': '太强了', 'sus': '可疑', 'cope': '精神胜利',
  'L': '输了', 'W': '赢了', 'mid': '一般', 'skill issue': '菜就多练',
  'griefing': '捣乱', '1v1': '单挑', 'hacker': '外挂', 'cheater': '开挂',
  'respawn': '复活', 'ult': '大招', 'aggro': '仇恨', 'flank': '绕后',
  'push': '推进', 'rotate': '转点', 'ping': '延迟', 'meta': '版本答案',
  'choke': '失误', 'throw': '送', 'int': '送', 'salty': '破防',
  'ez clap': '轻松', 'goated': '神', 'DPS': '输出', 'ace': '团灭对面',
  'RNG': '看脸', 'p2w': '氪金', 'f2p': '白嫖', 'gank': '抓人',
}

const SLANG_EN_TO_ES = {
  'GG': 'GG', 'EZ': 'fácil', 'noob': 'manco', 'OP': 'roto',
  'nerf': 'nerfear', 'buff': 'buffear', 'carry': 'carry', 'feed': 'dar kills',
  'toxic': 'tóxico', 'tilted': 'tilteado', 'clutch': 'clutch', 'camp': 'campero',
  'rush': 'rush', 'tank': 'tanque', 'healer': 'healer', 'tryhard': 'tryhard',
  'smurf': 'smurf', 'rekt': 'destruido', 'AFK': 'AFK', 'lag': 'lag',
  'GJ': 'buen trabajo', 'WP': 'bien jugado', 'GLHF': 'suerte',
  'lmao': 'jajaja', 'lol': 'jaja', 'gg wp': 'gg bien jugado', 'diff': 'diferencia',
  'bot': 'bot', 'cracked': 'crack', 'sus': 'sospechoso', 'cope': 'cope',
  'L': 'derrota', 'W': 'victoria', 'mid': 'regular', 'skill issue': 'falta de skill',
  'griefing': 'trolear', '1v1': '1v1', 'hacker': 'hacker', 'cheater': 'tramposo',
  'respawn': 'respawn', 'ult': 'ulti', 'aggro': 'aggro', 'flank': 'flanquear',
  'push': 'pushear', 'rotate': 'rotar', 'ping': 'ping', 'meta': 'meta',
  'choke': 'chokearse', 'throw': 'tirar', 'int': 'intentar', 'salty': 'salado',
  'goated': 'crack', 'ez clap': 'fácil', 'DPS': 'DPS', 'wipe': 'wipe',
  'ace': 'ace', 'RNG': 'RNG', 'DC': 'DC', 'gank': 'gankear',
}

const SLANG_EN_TO_PT = {
  'GG': 'GG', 'EZ': 'fácil', 'noob': 'noob', 'OP': 'apelão',
  'nerf': 'nerfar', 'buff': 'buffar', 'carry': 'carrega', 'feed': 'feeder',
  'toxic': 'tóxico', 'tilted': 'tiltado', 'clutch': 'clutch', 'camp': 'camperar',
  'rush': 'rusha', 'tank': 'tanque', 'healer': 'suporte', 'tryhard': 'tryhard',
  'smurf': 'smurf', 'rekt': 'destruído', 'AFK': 'AFK', 'lag': 'lag',
  'GJ': 'bom trabalho', 'WP': 'bem jogado', 'GLHF': 'boa sorte',
  'lmao': 'kkkk', 'lol': 'kkk', 'gg wp': 'gg bem jogado', 'diff': 'diferença',
  'bot': 'bot', 'cracked': 'absurdo', 'sus': 'suspeito', 'cope': 'cope',
  'L': 'derrota', 'W': 'vitória', 'mid': 'mediano', 'skill issue': 'falta de habilidade',
  'griefing': 'trollar', '1v1': '1v1', 'hacker': 'hacker', 'cheater': 'trapaceiro',
  'respawn': 'respawn', 'ult': 'ulti', 'aggro': 'aggro', 'flank': 'flanquear',
  'push': 'pushar', 'rotate': 'rodar', 'ping': 'ping', 'meta': 'meta',
  'choke': 'chokar', 'throw': 'entregar', 'int': 'intar', 'salty': 'salgado',
  'goated': 'craque', 'ez clap': 'fácil', 'DPS': 'DPS', 'wipe': 'wipe',
  'ace': 'ace', 'RNG': 'RNG', 'DC': 'DC', 'gank': 'gankar',
}

const SLANG_EN_TO_RU = {
  'GG': 'гг', 'EZ': 'изи', 'noob': 'нуб', 'OP': 'имба',
  'nerf': 'нерф', 'buff': 'бафф', 'carry': 'тащить', 'feed': 'кормить',
  'toxic': 'токсик', 'tilted': 'тильт', 'clutch': 'клатч', 'camp': 'кемпер',
  'rush': 'раш', 'tank': 'танк', 'healer': 'хилер', 'wipe': 'вайп',
  'tryhard': 'трайхард', 'smurf': 'смурф', 'rekt': 'уничтожен', 'AFK': 'афк',
  'DC': 'дисконнект', 'lag': 'лаг', 'GJ': 'молодец', 'WP': 'хорошо сыграл',
  'GLHF': 'глхф',
  'lmao': 'лмао', 'lol': 'лол', 'gg wp': 'гг хорошо сыграл', 'diff': 'разница',
  'bot': 'бот', 'cracked': 'имба', 'sus': 'подозрительный', 'cope': 'коуп',
  'L': 'проигрыш', 'W': 'победа', 'mid': 'средний', 'skill issue': 'проблема скилла',
  'griefing': 'гриф', '1v1': 'один на один', 'hacker': 'читер', 'cheater': 'читер',
  'respawn': 'респавн', 'ult': 'ульта', 'aggro': 'агро', 'flank': 'фланг',
  'push': 'пуш', 'rotate': 'ротация', 'ping': 'пинг', 'meta': 'мета',
  'choke': 'слив', 'throw': 'слить', 'int': 'интить', 'salty': 'соленый',
  'goated': 'имба', 'ez clap': 'изи', 'DPS': 'дпс', 'ace': 'эйс',
  'RNG': 'рандом', 'gank': 'ганк', 'p2w': 'донат', 'f2p': 'бесплатник',
}

const SLANG_EN_TO_DE = {
  'GG': 'gg', 'EZ': 'easy', 'noob': 'Noob', 'OP': 'overpowered',
  'nerf': 'nerfen', 'buff': 'buffen', 'carry': 'carryen', 'feed': 'feeden',
  'toxic': 'toxisch', 'tilted': 'getiltet', 'clutch': 'Clutch', 'camp': 'campen',
  'rush': 'rushen', 'tank': 'Tank', 'healer': 'Heiler', 'tryhard': 'Tryhard',
  'smurf': 'Smurf', 'rekt': 'zerstört', 'AFK': 'AFK', 'lag': 'Lag',
  'GJ': 'gut gemacht', 'WP': 'gut gespielt', 'GLHF': 'glhf',
  'lmao': 'lmao', 'lol': 'lol', 'gg wp': 'gg gut gespielt', 'diff': 'Unterschied',
  'bot': 'Bot', 'cracked': 'krass', 'sus': 'suspekt', 'cope': 'cope',
  'L': 'Niederlage', 'W': 'Sieg', 'mid': 'mittelmäßig', 'skill issue': 'Skill-Problem',
  'griefing': 'griefen', '1v1': '1v1', 'hacker': 'Hacker', 'cheater': 'Cheater',
  'respawn': 'Respawn', 'ult': 'Ulti', 'aggro': 'Aggro', 'flank': 'flanken',
  'push': 'pushen', 'rotate': 'rotieren', 'ping': 'Ping', 'meta': 'Meta',
  'choke': 'vergeigen', 'throw': 'throwen', 'int': 'inten', 'salty': 'salzig',
  'goated': 'Legende', 'ez clap': 'easy', 'DPS': 'DPS', 'wipe': 'Wipe',
  'ace': 'Ace', 'RNG': 'RNG', 'DC': 'DC', 'gank': 'ganken',
}

const SLANG_EN_TO_FR = {
  'GG': 'gg', 'EZ': 'facile', 'noob': 'noob', 'OP': 'pété',
  'nerf': 'nerf', 'buff': 'buff', 'carry': 'carry', 'feed': 'feed',
  'toxic': 'toxique', 'tilted': 'tilté', 'clutch': 'clutch', 'camp': 'camper',
  'rush': 'rush', 'tank': 'tank', 'healer': 'heal', 'tryhard': 'tryhard',
  'smurf': 'smurf', 'rekt': 'détruit', 'AFK': 'AFK', 'lag': 'lag',
  'GJ': 'bien joué', 'WP': 'bien joué', 'GLHF': 'bonne chance',
  'lmao': 'ptdr', 'lol': 'mdr', 'gg wp': 'gg bien joué', 'diff': 'différence',
  'bot': 'bot', 'cracked': 'cassé', 'sus': 'suspect', 'cope': 'cope',
  'L': 'défaite', 'W': 'victoire', 'mid': 'moyen', 'skill issue': 'problème de skill',
  'griefing': 'grief', '1v1': '1v1', 'hacker': 'hackeur', 'cheater': 'tricheur',
  'respawn': 'respawn', 'ult': 'ulti', 'aggro': 'aggro', 'flank': 'flanquer',
  'push': 'push', 'rotate': 'tourner', 'ping': 'ping', 'meta': 'méta',
  'choke': 'choke', 'throw': 'throw', 'int': 'int', 'salty': 'salé',
  'goated': 'le goat', 'ez clap': 'facile', 'DPS': 'DPS', 'wipe': 'wipe',
  'ace': 'ace', 'RNG': 'RNG', 'DC': 'DC', 'gank': 'gank',
}

const SLANG_DICTS = {
  'en-ja': SLANG_EN_TO_JA,
  'en-ko': SLANG_EN_TO_KO,
  'en-zh': SLANG_EN_TO_ZH,
  'en-es': SLANG_EN_TO_ES,
  'en-pt': SLANG_EN_TO_PT,
  'en-ru': SLANG_EN_TO_RU,
  'en-de': SLANG_EN_TO_DE,
  'en-fr': SLANG_EN_TO_FR,
}

function buildSlangContext(sourceLang, targetLang) {
  const forwardKey = `${sourceLang}-${targetLang}`
  const reverseKey = `${targetLang}-${sourceLang}`

  if (SLANG_DICTS[forwardKey]) {
    const dict = SLANG_DICTS[forwardKey]
    return Object.entries(dict).map(([k, v]) => `${k} = ${v}`).join(', ')
  }
  if (SLANG_DICTS[reverseKey]) {
    const dict = SLANG_DICTS[reverseKey]
    return Object.entries(dict).map(([v, k]) => `${k} = ${v}`).join(', ')
  }
  return ''
}

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
    handleCreateCheckout().then(sendResponse)
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
    // ignore storage errors
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

async function handleCreateCheckout() {
  try {
    const deviceId = await getDeviceId()
    const response = await fetch(`${SUPABASE_URL}/functions/v1/checkout`, {
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
    return { error: data.error || 'Failed to create checkout' }
  } catch (err) {
    return { error: `Checkout failed: ${err.message}` }
  }
}
