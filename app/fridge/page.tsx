'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { FridgeItem, CATEGORIES, Category } from '@/lib/types'
import AddItemModal from '@/components/AddItemModal'
import BottomNav from '@/components/BottomNav'

const CATEGORY_COLORS: Record<Category, string> = {
  '野菜・果物': 'bg-[#d4e8c2] text-[#4a6741]',
  '肉・魚':     'bg-[#f5d5c8] text-[#7a3f30]',
  '乳製品・卵': 'bg-[#f5ecd0] text-[#7a6130]',
  '飲み物':     'bg-[#c8dff5] text-[#2d5a7a]',
  '調味料':     'bg-[#e8d4f0] text-[#5a3a6b]',
  'その他':     'bg-[#e8e0d8] text-[#6b5f58]',
}

function daysUntilExpiry(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function FridgePage() {
  const [items, setItems] = useState<FridgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<Category | 'すべて'>('すべて')
  const [showModal, setShowModal] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [deviation, setDeviation] = useState<number | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('fridge_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setItems(data as FridgeItem[])
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }
      setUserEmail(user.email ?? '')
      await fetchItems()
      // 最新の偏差値を取得
      const { data: diag } = await supabase
        .from('diagnosis_results')
        .select('deviation')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (diag) setDeviation(diag.deviation)
      setLoading(false)
    }
    init()
  }, [supabase, router, fetchItems])

  async function deleteItem(id: string) {
    await supabase.from('fridge_items').delete().eq('id', id)
    setItems(prev => prev.filter(item => item.id !== id))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const filtered = selectedCategory === 'すべて'
    ? items
    : items.filter(item => item.category === selectedCategory)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#9c8f87] text-sm">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 pb-32">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-[#faf9f7] pt-6 pb-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-medium text-[#3d3530]">冷蔵庫</h1>
            <p className="text-xs text-[#9c8f87]">{userEmail}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-[#9c8f87] hover:text-[#6b5f58] transition-colors"
          >
            ログアウト
          </button>
        </div>

        {/* 偏差値バナー */}
        {deviation !== null ? (
          <button
            onClick={() => router.push('/diagnosis')}
            className="w-full bg-[#f5f0eb] rounded-2xl px-4 py-2.5 mb-3 flex items-center justify-between"
          >
            <span className="text-xs text-[#6b5f58]">片付け偏差値</span>
            <span className="text-lg font-bold text-[#8b7355]">{deviation}</span>
          </button>
        ) : (
          <button
            onClick={() => router.push('/diagnosis')}
            className="w-full bg-[#f5f0eb] rounded-2xl px-4 py-2.5 mb-3 flex items-center justify-between"
          >
            <span className="text-xs text-[#6b5f58]">片付け偏差値を診断する</span>
            <span className="text-xs text-[#8b7355]">→</span>
          </button>
        )}

        {/* カテゴリフィルター */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(['すべて', ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs transition-all ${
                selectedCategory === cat
                  ? 'bg-[#8b7355] text-white'
                  : 'bg-[#f0ebe5] text-[#6b5f58]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* アイテム一覧 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🥗</p>
          <p className="text-sm text-[#9c8f87]">食材を追加してみましょう</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const days = daysUntilExpiry(item.expiry_date)
            const isExpiringSoon = days !== null && days <= 3
            const isExpired = days !== null && days < 0

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#3d3530] text-sm truncate">{item.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[item.category as Category]}`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#9c8f87]">
                    <span>{item.quantity}</span>
                    {item.expiry_date && (
                      <span className={isExpired ? 'text-red-400' : isExpiringSoon ? 'text-orange-400' : ''}>
                        {isExpired
                          ? `期限切れ（${Math.abs(days!)}日前）`
                          : days === 0
                          ? '今日が期限'
                          : `あと${days}日`}
                      </span>
                    )}
                    {item.memo && <span className="truncate">{item.memo}</span>}
                  </div>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-[#c5b8b0] hover:text-[#9c8f87] transition-colors shrink-0 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 追加ボタン */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-20 right-6 w-14 h-14 rounded-full bg-[#8b7355] text-white text-2xl shadow-lg hover:bg-[#7a6347] transition-colors flex items-center justify-center z-30"
      >
        +
      </button>

      {/* 追加モーダル */}
      {showModal && (
        <AddItemModal
          onClose={() => setShowModal(false)}
          onAdded={() => {
            fetchItems()
            setShowModal(false)
          }}
        />
      )}

      <BottomNav />
    </div>
  )
}
