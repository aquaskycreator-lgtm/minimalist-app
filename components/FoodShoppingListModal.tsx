'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { FridgeItem } from '@/lib/types'

type Props = {
  items: FridgeItem[]
  onClose: () => void
  onUpdated: () => void
}

export default function FoodShoppingListModal({ items, onClose, onUpdated }: Props) {
  const needItems = items.filter(i => i.need_to_buy)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleComplete() {
    if (checked.size === 0) return
    setLoading(true)
    await supabase
      .from('fridge_items')
      .update({ need_to_buy: false })
      .in('id', Array.from(checked))
    setLoading(false)
    onUpdated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-medium text-[#3d3530]">買い物リスト</h2>
            <p className="text-xs text-[#9c8f87] mt-0.5">チェックして「買った」を押すとリストから外れます</p>
          </div>
          <button onClick={onClose} className="text-[#9c8f87] text-lg leading-none">×</button>
        </div>

        {needItems.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">✨</p>
            <p className="text-sm text-[#9c8f87]">買い物リストは空です</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-6 max-h-80 overflow-y-auto">
              {needItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left ${
                    checked.has(item.id) ? 'bg-[#d4e8c2]' : 'bg-[#fdf8f0]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    checked.has(item.id) ? 'bg-[#6aaa7e] border-[#6aaa7e]' : 'border-[#c5b8b0]'
                  }`}>
                    {checked.has(item.id) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${checked.has(item.id) ? 'line-through text-[#9c8f87]' : 'text-[#3d3530]'}`}>
                      {item.name}
                    </span>
                    <span className="ml-2 text-xs text-[#9c8f87]">{item.category}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleComplete}
              disabled={checked.size === 0 || loading}
              className="w-full py-3 rounded-2xl bg-[#8b7355] text-white text-sm font-medium disabled:opacity-40 transition-colors hover:bg-[#7a6347]"
            >
              {loading ? '更新中...' : `選択した${checked.size}点を「買った」にする`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
