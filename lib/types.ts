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
  created_at: string
}
