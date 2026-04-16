'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type DiscardItem = {
  id: string
  name: string
  created_at: string
}

function relativeDate(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今日'
  if (diffDays === 1) return '昨日'
  return `${diffDays}日前`
}

export default function DiscardPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<DiscardItem[]>([])
  const [total, setTotal] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  const loadItems = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const [countRes, itemsRes] = await Promise.all([
      supabase.from('discard_items').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('discard_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])

    setTotal(countRes.count ?? 0)
    if (itemsRes.data) setItems(itemsRes.data as DiscardItem[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadItems() }, [loadItems])

  async function deleteItem(id: string) {
    await supabase.from('discard_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setTotal(prev => Math.max(0, prev - 1))
  }

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
      <div className="pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => router.push('/top')} className="text-[#9c8f87] text-sm">←</button>
        <div>
          <h1 className="text-lg font-medium text-[#3d3530]">手放したモノ</h1>
          <p className="text-xs text-[#9c8f87]">合計 {total} 個</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-[#9c8f87]">まだ記録がありません</p>
          <p className="text-xs text-[#b8b0a8] mt-1">トップページから手放したモノを記録しましょう</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center justify-between px-4 py-3 ${index !== items.length - 1 ? 'border-b border-[#f0ebe5]' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#3d3530] truncate">・{item.name}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className="text-[10px] text-[#b8b0a8]">{relativeDate(item.created_at)}</span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-[#d0c8c0] hover:text-[#9c8f87] text-sm leading-none"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
