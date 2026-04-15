export type AxisKey = '持ち物量' | '定位置' | '動線' | '維持力' | '在庫管理'

export type AnswerOption = { label: string; value: number }

export type Question = {
  id: number
  text: string
  axis: AxisKey
  positive: boolean
  answers: AnswerOption[]
}

export const QUESTIONS: Question[] = [
  {
    id: 1,
    text: '床にモノを直置きすることがありますか？',
    axis: '維持力',
    positive: false,
    answers: [
      { label: 'よくある',       value: 0 },
      { label: 'たまにある',     value: 2 },
      { label: 'ほとんどない',   value: 4 },
    ],
  },
  {
    id: 2,
    text: 'よく使うモノの定位置は決まっていますか？',
    axis: '定位置',
    positive: true,
    answers: [
      { label: '決まっている',           value: 4 },
      { label: 'だいたい決まっている',   value: 2 },
      { label: '決まっていない',         value: 0 },
    ],
  },
  {
    id: 3,
    text: '家族もその置き場所を理解していますか？',
    axis: '定位置',
    positive: true,
    answers: [
      { label: '理解している',           value: 4 },
      { label: 'だいたい理解している',   value: 2 },
      { label: '理解していない',         value: 0 },
    ],
  },
  {
    id: 4,
    text: '同じようなモノをいくつ持っているか把握していますか？',
    axis: '持ち物量',
    positive: true,
    answers: [
      { label: '把握している',           value: 4 },
      { label: 'だいたい把握している',   value: 2 },
      { label: '把握していない',         value: 0 },
    ],
  },
  {
    id: 5,
    text: '冷蔵庫の中身をだいたい思い出せますか？',
    axis: '在庫管理',
    positive: true,
    answers: [
      { label: '思い出せる',             value: 4 },
      { label: 'だいたい思い出せる',     value: 2 },
      { label: '思い出せない',           value: 0 },
    ],
  },
  {
    id: 6,
    text: '日用品の買いすぎや買い忘れがありますか？',
    axis: '在庫管理',
    positive: false,
    answers: [
      { label: 'よくある',       value: 0 },
      { label: 'たまにある',     value: 2 },
      { label: 'ほとんどない',   value: 4 },
    ],
  },
  {
    id: 7,
    text: 'クローゼットに1年以上着ていない服がありますか？',
    axis: '持ち物量',
    positive: false,
    answers: [
      { label: 'たくさんある',   value: 0 },
      { label: '少しある',       value: 2 },
      { label: 'ほとんどない',   value: 4 },
    ],
  },
  {
    id: 8,
    text: 'モノが多すぎて片付けに時間がかかると感じますか？',
    axis: '持ち物量',
    positive: false,
    answers: [
      { label: 'よく感じる',     value: 0 },
      { label: 'たまに感じる',   value: 2 },
      { label: '感じない',       value: 4 },
    ],
  },
  {
    id: 9,
    text: '出したモノを元の場所に戻すのが面倒ですか？',
    axis: '動線',
    positive: false,
    answers: [
      { label: 'よく感じる',     value: 0 },
      { label: 'たまに感じる',   value: 2 },
      { label: '感じない',       value: 4 },
    ],
  },
  {
    id: 10,
    text: '来客前だけ慌てて片付けることが多いですか？',
    axis: '維持力',
    positive: false,
    answers: [
      { label: 'よくある',       value: 0 },
      { label: 'たまにある',     value: 2 },
      { label: 'ほとんどない',   value: 4 },
    ],
  },
]

// スコア → 偏差値変換
export function calcDeviation(totalScore: number): number {
  if (totalScore <= 8)  return 35
  if (totalScore <= 16) return 43
  if (totalScore <= 24) return 52
  if (totalScore <= 32) return 62
  return 72
}

// 軸ごとのスコアを0-100で計算
export function calcAxisScores(answers: Record<number, number>): Record<AxisKey, number> {
  const axes: AxisKey[] = ['持ち物量', '定位置', '動線', '維持力', '在庫管理']
  const result = {} as Record<AxisKey, number>

  for (const axis of axes) {
    const qs = QUESTIONS.filter(q => q.axis === axis)
    const maxScore = qs.length * 4
    const actualScore = qs.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0)
    result[axis] = Math.round((actualScore / maxScore) * 100)
  }

  return result
}

// タイプ名
export function getTypeName(deviation: number): string {
  if (deviation < 40) return 'まずは土台づくりタイプ'
  if (deviation < 50) return '片付け迷子タイプ'
  if (deviation < 60) return 'あと一歩で安定タイプ'
  if (deviation < 70) return '戻りにくい仕組み化タイプ'
  return '整う暮らし定着タイプ'
}

// 今日のアクション
export function getTodayAction(axisScores: Record<AxisKey, number>): string {
  const weakAxis = Object.entries(axisScores).sort((a, b) => a[1] - b[1])[0][0] as AxisKey
  const actions: Record<AxisKey, string> = {
    '持ち物量': '同じ用途のモノを3つ見直して、1つ手放してみましょう',
    '定位置':   'ハサミや文具など、よく使うモノの置き場所を1つ決めましょう',
    '動線':     '使う場所の近くに収納できるか、1か所見直してみましょう',
    '維持力':   '寝る前3分、床に置いてあるモノを1つ元に戻すことから始めましょう',
    '在庫管理': '冷蔵庫を開けて、今日使い切れる食材を1つ確認しましょう',
  }
  return actions[weakAxis]
}
