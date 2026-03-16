// ゲームスラング辞書 — AI翻訳のプロンプトに埋め込むためのコアデータ

export const SLANG_EN_TO_JA = {
  // 一般
  'GG': 'お疲れ / いい試合だった',
  'GG EZ': 'お疲れ、楽勝だったな',
  'GLHF': 'よろしく、頑張ろう',
  'WP': 'ナイスプレイ',
  'GJ': 'グッジョブ',
  'noob': '初心者 / 下手くそ',
  'n00b': '初心者 / 下手くそ',
  'AFK': '離席 / 放置',
  'BRB': 'ちょっと離れる',
  'DC': '回線落ち',
  'lag': 'ラグい / 重い',
  'ping': 'ピン / 応答速度',

  // バランス・メタ
  'nerf': '弱体化',
  'buff': '強化',
  'OP': '強すぎ / ぶっ壊れ',
  'meta': '環境最強 / 今の最適解',
  'broken': '壊れ性能',
  'S-tier': '最強ランク',

  // プレイ関連
  'clutch': '神プレイ / 逆転',
  'choke': 'やらかした / 緊張で失敗',
  'throw': '投げた / わざと負けた',
  'int': '意図的に負ける',
  'inting': 'わざと負けてる',
  'feed': '敵にキル献上',
  'feeding': '養殖 / 敵を育ててる',
  'carry': 'キャリー / チームを背負う',
  'smurf': 'サブ垢 / 初心者狩り',
  'tryhard': 'ガチ勢',
  'casual': 'エンジョイ勢',
  'grind': '周回 / 作業',

  // 態度・感情
  'toxic': '害悪 / 煽り',
  'tilted': 'イラついてる',
  'tilt': 'メンタル崩壊',
  'salty': '悔しがってる',
  'copium': '現実逃避 / 負け惜しみ',
  'based': 'わかってる / 芯がある',
  'cringe': 'キツい / 痛い',
  'sus': '怪しい',

  // FPS・MOBA
  'gank': 'ガンク / 奇襲',
  'camp': 'キャンプ / 待ち伏せ',
  'rush': 'ラッシュ / 突撃',
  'rotate': 'ローテ / 移動',
  'flank': 'フランク / 裏取り',
  'peel': 'ピール / 味方を守る',
  'kite': 'カイト / 距離を取りながら攻撃',
  'aggro': 'アグロ / ヘイトを取る',
  'DPS': '火力 / ダメージディーラー',
  'tank': 'タンク / 盾役',
  'healer': 'ヒーラー',
  'support': 'サポート',
  'rez': '蘇生',
  'wipe': '全滅',
  'ace': 'エース / 全員キル',
  '1v1': 'タイマン',

  // 課金・ガチャ
  'RNG': '運ゲー',
  'p2w': '課金ゲー',
  'f2p': '無課金',
  'whale': '廃課金',
  'gacha': 'ガチャ',
  'reroll': 'リセマラ',
  'pity': '天井',

  // Twitch・配信
  'POG': 'すごい / 神',
  'PogChamp': 'すごい / 神',
  'KEKW': '草 / ｗｗｗ',
  'Sadge': '悲しい',
  'LULW': '草',
  'Pepega': 'アホ（愛情込み）',
  'monkaS': 'ハラハラ / 怖い',
  'EZ Clap': '楽勝',
  'ratio': '比率負け',
  'W': '勝ち',
  'L': '負け',
}

export const SLANG_JA_TO_EN = {
  '草': 'lol / lmao',
  'ｗｗｗ': 'lol / lmao',
  '乙': 'GG / good work',
  'よろ': 'GLHF',
  '沼': 'stuck / hardstuck',
  '人権': 'must-have / S-tier',
  '廃課金': 'whale',
  '微課金': 'light spender',
  '無課金': 'f2p',
  'リセマラ': 'reroll',
  '爆死': 'got shafted / bad pulls',
  '天井': 'pity (system)',
  '凸': 'dupe / constellation',
  '石': 'gems / currency',
  '鯖': 'server',
  '垢': 'account',
  '垢BAN': 'account banned',
  'チーター': 'cheater / hacker',
  '芋': 'camper',
  '凸砂': 'aggressive sniper',
  '味方ガチャ': 'teammate RNG / team lottery',
  '戦犯': 'the one who threw',
  'エンジョイ勢': 'casual player',
  'ガチ勢': 'tryhard / sweaty',
  'キャリー': 'carry',
  'ナーフ': 'nerf',
  'バフ': 'buff',
  '環境': 'meta',
  '壊れ': 'broken / OP',
  '確殺': 'guaranteed kill / one-shot',
  'ワンパン': 'one-shot / one-punch',
}

/**
 * スラング辞書をプロンプト用のテキストに変換
 */
export function buildSlangContext(sourceLang, targetLang) {
  const dict = sourceLang === 'en' ? SLANG_EN_TO_JA : SLANG_JA_TO_EN
  const lines = Object.entries(dict)
    .map(([k, v]) => `- ${k} = ${v}`)
    .join('\n')
  return lines
}
