export type Category = '野菜・果物' | '肉・魚' | '乳製品・卵' | '飲み物' | '調味料' | 'その他'

export const CATEGORIES: Category[] = [
  '野菜・果物',
  '肉・魚',
  '乳製品・卵',
  '飲み物',
  '調味料',
  'その他',
]

export type FridgeItem = {
  id: string
  user_id: string
  name: string
  category: Category
  quantity: string
  expiry_date: string | null
  memo: string | null
  need_to_buy: boolean
  created_at: string
}

// 日用品
export type SupplyCategory = 'トイレ用品' | '洗濯・洗剤' | 'バス・シャンプー' | 'スキンケア' | '薬・衛生用品' | 'その他'
export const SUPPLY_CATEGORIES: SupplyCategory[] = [
  'トイレ用品',
  '洗濯・洗剤',
  'バス・シャンプー',
  'スキンケア',
  '薬・衛生用品',
  'その他',
]
export type SupplyStatus = '在庫あり' | '残り少ない' | '切れた'
export const SUPPLY_STATUSES: SupplyStatus[] = ['在庫あり', '残り少ない', '切れた']

export type SupplyItem = {
  id: string
  user_id: string
  name: string
  category: SupplyCategory
  quantity: string
  status: SupplyStatus
  memo: string | null
  created_at: string
}

// 洋服
export type ClosetCategory = 'トップス' | 'ボトムス' | 'アウター' | 'インナー・下着' | '靴・バッグ' | 'その他'
export const CLOSET_CATEGORIES: ClosetCategory[] = [
  'トップス',
  'ボトムス',
  'アウター',
  'インナー・下着',
  '靴・バッグ',
  'その他',
]
export type Season = '春夏' | '秋冬' | 'オールシーズン'
export const SEASONS: Season[] = ['春夏', '秋冬', 'オールシーズン']

export type ClosetItem = {
  id: string
  user_id: string
  name: string
  category: ClosetCategory
  color: string | null
  season: Season | null
  memo: string | null
  created_at: string
}
