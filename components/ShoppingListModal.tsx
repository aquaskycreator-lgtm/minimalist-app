'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { SupplyItem, SupplyStatus } from '@/lib/types'

type Props = {
  items: SupplyItem[]
  onClose: () => void
  onUpdated: () => void
}

type ShoppingItem = {
  id: string
  name: string
  is_done: boolean
}

export default function ShoppingListModal({ items, onClose, onUpdated }: Props) {
  const needItems = items.filter(i => i.status === '切れた' || i.status === '残り少ない')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  const fetchShoppingItems = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('shopping_items')
      .select('id, name, is_done')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (data) setShoppingItems(data as ShoppingItem[])
  }, [supabase])

  useEffect(() => { fetchShoppingItems() }, [fetchShoppingItems])

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
    const supplyIds = Array.from(checked).filter(id => needItems.some(i => i.id === id))
    const shopIds = Array.from(checked).filter(id => shoppingItems.some(i => i.id === id))
    if (supplyIds.length > 0) {
      await supabase.from('supplies').update({ status: '在庫あり' as SupplyStatus }).in('id', supplyIds)
    }
    if (shopIds.length > 0) {
      await supabase.from('shopping_items').delete().in('id', shopIds)
    }
    setLoading(false)
    setChecked(new Set())
    await fetchShoppingItems()
    onUpdated()
  }

  async function addShoppingItem() {
    const name = input.trim()
    if (!name) return
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('shopping_items')
      .insert({ user_id: user.id, name })
      .select('id, name, is_done')
      .single()
    if (data) setShoppingItems(prev => [...prev, data as ShoppingItem])
    setInput('')
    setAdding(false)
  }

  async function deleteShoppingItem(id: string) {
    await supabase.from('shopping_items').delete().eq('id', id)
    setShoppingItems(prev => prev.filter(i => i.id !== id))
    setChecked(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  const totalCount = needItems.length + shoppingItems.length

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-medium text-[#3d3530]">買い物リスト</h2>
            <p className="text-xs text-[#9c8f87] mt-0.5">チェックして「買った」を押すと在庫ありに更新されます</p>
          </div>
          <button onClick={onClose} className="text-[#9c8f87] text-lg leading-none">×</button>
        </div>

        {/* 直接入力 */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addShoppingItem()}
            placeholder="買いたいものを追加..."
            className="flex-1 px-4 py-2.5 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
          />
          <button
            onClick={addShoppingItem}
            disabled={adding || !input.trim()}
            className="px-4 py-2.5 rounded-2xl bg-[#8b7355] text-white text-sm font-medium disabled:opacity-40"
          >
            追加
          </button>
        </div>

        {totalCount === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[#9c8f87]">買い物が必要なアイテムはありません</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-6 max-h-72 overflow-y-auto">
              {/* 在庫フラグのアイテム */}
              {needItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left ${
                    checked.has(item.id)
                      ? 'bg-[#d4e8c2]'
                      : item.status === '切れた'
                      ? 'bg-[#fdf0ee]'
                      : 'bg-[#fdf8f0]'
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
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                      item.status === '切れた' ? 'bg-[#f5d5c8] text-[#7a3f30]' : 'bg-[#f5ecd0] text-[#7a6130]'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </button>
              ))}

              {/* 直接追加したアイテム */}
              {shoppingItems.map(item => (
                <div
                  key={item.id}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                    checked.has(item.id) ? 'bg-[#d4e8c2]' : 'bg-[#f5f0eb]'
                  }`}
                >
                  <button
                    onClick={() => toggle(item.id)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      checked.has(item.id) ? 'bg-[#6aaa7e] border-[#6aaa7e]' : 'border-[#c5b8b0]'
                    }`}
                  >
                    {checked.has(item.id) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                  <span className={`flex-1 text-sm font-medium ${checked.has(item.id) ? 'line-through text-[#9c8f87]' : 'text-[#3d3530]'}`}>
                    {item.name}
                  </span>
                  <button
                    onClick={() => deleteShoppingItem(item.id)}
                    className="text-[#d0c8c0] hover:text-[#9c8f87] text-sm leading-none shrink-0"
                  >
                    ×
                  </button>
                </div>
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
