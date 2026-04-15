'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { CLOSET_CATEGORIES, SEASONS, ClosetCategory, Season } from '@/lib/types'

type Props = {
  onClose: () => void
  onAdded: () => void
}

export default function AddClosetModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ClosetCategory>('その他')
  const [color, setColor] = useState('')
  const [season, setSeason] = useState<Season | ''>('')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('closet_items').insert({
      user_id: user.id,
      name: name.trim(),
      category,
      color: color.trim() || null,
      season: season || null,
      memo: memo.trim() || null,
    })

    setLoading(false)
    onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-medium text-[#3d3530]">洋服を追加</h2>
          <button onClick={onClose} className="text-[#9c8f87] text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 名前 */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">アイテム名 *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="例：白Tシャツ、デニムパンツ"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          {/* カテゴリ */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {CLOSET_CATEGORIES.map(cat => (
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

          {/* 色 */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">色（任意）</label>
            <input
              type="text"
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="例：白、ネイビー、ベージュ"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          {/* 季節 */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-2">季節（任意）</label>
            <div className="flex gap-2">
              {SEASONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(season === s ? '' : s)}
                  className={`flex-1 py-2 rounded-2xl text-xs font-medium transition-all ${
                    season === s
                      ? 'bg-[#8b7355] text-white'
                      : 'bg-[#f0ebe5] text-[#6b5f58]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">メモ（任意）</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="例：お気に入り、くたびれてきた"
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
