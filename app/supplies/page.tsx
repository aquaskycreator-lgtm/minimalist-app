'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { SupplyItem, SupplyCategory, SUPPLY_CATEGORIES, SupplyStatus } from '@/lib/types'
import AddSuppliesModal from '@/components/AddSuppliesModal'
import ShoppingListModal from '@/components/ShoppingListModal'
import BottomNav from '@/components/BottomNav'

const CATEGORY_COLORS: Record<SupplyCategory, string> = {
  'トイレ用品':    'bg-[#f5ecd0] text-[#7a6130]',
  '洗濯・洗剤':   'bg-[#c8dff5] text-[#2d5a7a]',
  'バス・シャンプー': 'bg-[#e8d4f0] text-[#5a3a6b]',
  'スキンケア':   'bg-[#f5d5c8] text-[#7a3f30]',
  '薬・衛生用品': 'bg-[#d4e8c2] text-[#4a6741]',
  'その他':       'bg-[#e8e0d8] text-[#6b5f58]',
}

const STATUS_COLORS: Record<SupplyStatus, string> = {
  '在庫あり':   'bg-[#d4e8c2] text-[#4a6741]',
  '残り少ない': 'bg-[#f5ecd0] text-[#7a6130]',
  '切れた':     'bg-[#f5d5c8] text-[#7a3f30]',
}

type SupplySort = '追加順' | '名前順' | 'カテゴリ順' | '在庫状況順'
const SUPPLY_SORTS: SupplySort[] = ['追加順', '名前順', 'カテゴリ順', '在庫状況順']
const STATUS_ORDER: Record<string, number> = { '切れた': 0, '残り少ない': 1, '在庫あり': 2 }

export default function SuppliesPage() {
  const [items, setItems] = useState<SupplyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<SupplyCategory | 'すべて'>('すべて')
  const [sortBy, setSortBy] = useState<SupplySort>('追加順')
  const [showModal, setShowModal] = useState(false)
  const [showShopping, setShowShopping] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('supplies')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setItems(data as SupplyItem[])
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
    await supabase.from('supplies').delete().eq('id', id)
    setItems(prev => prev.filter(item => item.id !== id))
  }

  async function updateStatus(id: string, newStatus: SupplyStatus) {
    await supabase.from('supplies').update({ status: newStatus }).eq('id', id)
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item))
  }

  const filtered = (selectedCategory === 'すべて'
    ? items
    : items.filter(item => item.category === selectedCategory)
  ).slice().sort((a, b) => {
    if (sortBy === '名前順') return a.name.localeCompare(b.name, 'ja')
    if (sortBy === 'カテゴリ順') return a.category.localeCompare(b.category, 'ja')
    if (sortBy === '在庫状況順') return (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
    return 0
  })

  const outOfStock = items.filter(i => i.status === '切れた').length
  const lowStock = items.filter(i => i.status === '残り少ない').length

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
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-medium text-[#3d3530]">日用品</h1>
              <p className="text-xs text-[#9c8f87]">{items.length}アイテム</p>
            </div>
            {(outOfStock > 0 || lowStock > 0) && (
              <button
                onClick={() => setShowShopping(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#8b7355] text-white text-xs shrink-0"
              >
                🛒 買い物リスト
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {outOfStock > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#f5d5c8] text-[#7a3f30]">
                切れた {outOfStock}
              </span>
            )}
            {lowStock > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#f5ecd0] text-[#7a6130]">
                残り少 {lowStock}
              </span>
            )}
          </div>
        </div>

        {/* カテゴリフィルター */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(['すべて', ...SUPPLY_CATEGORIES] as const).map(cat => (
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

        {/* 並び替え */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mt-2">
          {SUPPLY_SORTS.map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] transition-all ${
                sortBy === s
                  ? 'bg-[#3d3530] text-white'
                  : 'bg-[#f0ebe5] text-[#9c8f87]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* アイテム一覧 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🧴</p>
          <p className="text-sm text-[#9c8f87]">日用品を追加してみましょう</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-2xl px-4 py-3.5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#3d3530] text-sm truncate">{item.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[item.category as SupplyCategory]}`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#9c8f87]">
                    <span>{item.quantity}</span>
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

              {/* ステータス切り替え */}
              <div className="flex gap-2 mt-2.5">
                {(['在庫あり', '残り少ない', '切れた'] as SupplyStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(item.id, s)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      item.status === s
                        ? STATUS_COLORS[s]
                        : 'bg-[#f5f2ef] text-[#b8b0a8]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
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
        <AddSuppliesModal
          onClose={() => setShowModal(false)}
          onAdded={() => { fetchItems(); setShowModal(false) }}
        />
      )}

      {showShopping && (
        <ShoppingListModal
          items={items}
          onClose={() => setShowShopping(false)}
          onUpdated={fetchItems}
        />
      )}

      <BottomNav />
    </div>
  )
}
