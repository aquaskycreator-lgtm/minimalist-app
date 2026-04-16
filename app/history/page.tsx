'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type HistoryEntry = {
  id: string
  question: string
  answer: string
  asked_at: string
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const router = useRouter()
  const supabase = createClient()

  const loadHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', user.id)
      .order('asked_at', { ascending: false })

    if (data) setEntries(data as HistoryEntry[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function deleteEntry(id: string) {
    await supabase.from('search_history').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
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
        <button
          onClick={() => router.push('/search')}
          className="w-8 h-8 rounded-full bg-[#f0ebe5] flex items-center justify-center text-[#6b5f58] shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-lg font-medium text-[#3d3530]">相談履歴</h1>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 shadow-sm text-center">
          <p className="text-sm text-[#b8b0a8]">まだ履歴がありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(entry => (
            <div key={entry.id} className="bg-white rounded-3xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-[10px] text-[#b8b0a8]">{formatDateTime(entry.asked_at)}</p>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-[#d0c8c0] hover:text-[#9c8f87] text-lg leading-none shrink-0"
                >
                  ×
                </button>
              </div>

              {/* 質問バブル */}
              <div className="flex justify-end mb-3">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm bg-[#8b7355] text-white text-sm leading-relaxed">
                  {entry.question}
                </div>
              </div>

              {/* 回答バブル */}
              <div className="flex justify-start">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-sm bg-[#f5f0eb] text-[#3d3530] text-sm leading-relaxed whitespace-pre-line">
                  {entry.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
