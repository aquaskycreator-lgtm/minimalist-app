'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { CATEGORIES, Category } from '@/lib/types'

type Props = {
  onClose: () => void
  onAdded: () => void
}

export default function AddItemModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('その他')
  const [quantity, setQuantity] = useState('1個')
  const [expiryDate, setExpiryDate] = useState('')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('fridge_items').insert({
      user_id: user.id,
      name: name.trim(),
      category,
      quantity,
      expiry_date: expiryDate || null,
      memo: memo.trim() || null,
    })

    setLoading(false)
    onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* モーダル */}
      <div className="relative w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-medium text-[#3d3530]">食材を追加</h2>
          <button onClick={onClose} className="text-[#9c8f87] text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 食材名 */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">食材名 *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="例：キャベツ"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          {/* カテゴリ */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                    category === cat
                      ? 'bg-[#8b7355] text-white'
                      : 'bg-[#f0ebe5] text-[#6b5f58]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 数量 */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">数量</label>
            <input
              type="text"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="例：1個、200g、半分"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          {/* 賞味期限 */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">賞味期限（任意）</label>
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a]"
            />
          </div>

          {/* メモ */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">メモ（任意）</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="例：開封済み"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 rounded-2xl bg-[#8b7355] text-white text-sm font-medium hover:bg-[#7a6347] transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? '追加中...' : '追加する'}
          </button>
        </form>
      </div>
    </div>
  )
}
