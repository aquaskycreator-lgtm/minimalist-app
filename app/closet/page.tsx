'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ClosetItem, ClosetCategory, CLOSET_CATEGORIES } from '@/lib/types'
import AddClosetModal from '@/components/AddClosetModal'
import BottomNav from '@/components/BottomNav'

const CATEGORY_COLORS: Record<ClosetCategory, string> = {
  'トップス':      'bg-[#f5d5c8] text-[#7a3f30]',
  'ボトムス':      'bg-[#c8dff5] text-[#2d5a7a]',
  'アウター':      'bg-[#d4e8c2] text-[#4a6741]',
  'インナー・下着': 'bg-[#f5ecd0] text-[#7a6130]',
  '靴・バッグ':    'bg-[#e8d4f0] text-[#5a3a6b]',
  'その他':        'bg-[#e8e0d8] text-[#6b5f58]',
}

const SEASON_LABELS: Record<string, string> = {
  '春夏': '🌸',
  '秋冬': '🍂',
  'オールシーズン': '✦',
}

export default function ClosetPage() {
  const [items, setItems] = useState<ClosetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<ClosetCategory | 'すべて'>('すべて')
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('closet_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setItems(data as ClosetItem[])
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      await fetchItems()
      setLoading(false)
    }
    init()
  }, [supabase, router, fetchItems])

  async function deleteItem(id: string) {
    await supabase.from('closet_items').delete().eq('id', id)
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const filtered = selectedCategory === 'すべて'
    ? items
    : items.filter(item => item.category === selectedCategory)

  // カテゴリ別カウント
  const categoryCounts = CLOSET_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat).length
    return acc
  }, {} as Record<ClosetCategory, number>)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#9c8f87] text-sm">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-md mx-auto px-4 pb-32">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-[#faf9f7] pt-6 pb-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-medium text-[#3d3530]">洋服</h1>
            <p className="text-xs text-[#9c8f87]">{items.length}アイテム</p>
          </div>
        </div>

        {/* カテゴリフィルター */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(['すべて', ...CLOSET_CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs transition-all ${
                selectedCategory === cat
                  ? 'bg-[#8b7355] text-white'
                  : 'bg-[#f0ebe5] text-[#6b5f58]'
              }`}
            >
              {cat}{cat !== 'すべて' && categoryCounts[cat as ClosetCategory] > 0 ? ` ${categoryCounts[cat as ClosetCategory]}` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* アイテム一覧 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">👗</p>
          <p className="text-sm text-[#9c8f87]">洋服を登録してみましょう</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-[#3d3530] text-sm truncate">{item.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[item.category as ClosetCategory]}`}>
                    {item.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#9c8f87]">
                  {item.color && <span>{item.color}</span>}
                  {item.season && (
                    <span>{SEASON_LABELS[item.season]} {item.season}</span>
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
          ))}
        </div>
      )}

      {/* 追加ボタン */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-20 right-6 w-14 h-14 rounded-full bg-[#8b7355] text-white text-2xl shadow-lg hover:bg-[#7a6347] transition-colors flex items-center justify-center z-30"
      >
        +
      </button>

      {showModal && (
        <AddClosetModal
          onClose={() => setShowModal(false)}
          onAdded={() => { fetchItems(); setShowModal(false) }}
        />
      )}

      <BottomNav />
    </div>
  )
}
