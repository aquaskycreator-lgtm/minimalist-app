'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

type Message = {
  role: 'user' | 'assistant'
  text: string
}

function daysUntilExpiry(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function SearchPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: '在庫を検索できます。「キャベツある？」のように話しかけてください。' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth')
    })
  }, [supabase, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const q = input.trim()
    if (!q || loading) return

    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setLoading(true)

    const reply = await searchInventory(q)
    setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    setLoading(false)
  }

  async function searchInventory(query: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'ログインが必要です。'

    // クエリからキーワードを抽出（「ある？」「は？」などを除去）
    const keyword = query
      .replace(/[あるないどこですかは？?！!。、\s]+/g, '')
      .trim()

    if (!keyword) return 'アイテム名を教えてください。例：「キャベツある？」'

    // 3つのテーブルを並行検索
    const [fridgeRes, suppliesRes, closetRes] = await Promise.all([
      supabase
        .from('fridge_items')
        .select('*')
        .eq('user_id', user.id)
        .ilike('name', `%${keyword}%`),
      supabase
        .from('supplies')
        .select('*')
        .eq('user_id', user.id)
        .ilike('name', `%${keyword}%`),
      supabase
        .from('closet_items')
        .select('*')
        .eq('user_id', user.id)
        .ilike('name', `%${keyword}%`),
    ])

    const results: string[] = []

    if (fridgeRes.data && fridgeRes.data.length > 0) {
      for (const item of fridgeRes.data) {
        const days = daysUntilExpiry(item.expiry_date)
        let line = `冷蔵庫に「${item.name}」があります（${item.quantity}）`
        if (days !== null) {
          if (days < 0) line += `。⚠️ 期限が${Math.abs(days)}日過ぎています`
          else if (days === 0) line += '。今日が期限です'
          else line += `。あと${days}日`
        }
        results.push(line)
      }
    }

    if (suppliesRes.data && suppliesRes.data.length > 0) {
      for (const item of suppliesRes.data) {
        results.push(`日用品に「${item.name}」があります（${item.status}・${item.quantity}）`)
      }
    }

    if (closetRes.data && closetRes.data.length > 0) {
      for (const item of closetRes.data) {
        let line = `洋服に「${item.name}」があります（${item.category}`
        if (item.color) line += `・${item.color}`
        if (item.season) line += `・${item.season}`
        line += '）'
        results.push(line)
      }
    }

    if (results.length === 0) {
      return `「${keyword}」は登録されていないようです。`
    }

    return results.join('\n')
  }

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-[#faf9f7] pt-6 px-4 pb-4 z-10">
        <h1 className="text-lg font-medium text-[#3d3530]">在庫検索</h1>
        <p className="text-xs text-[#9c8f87]">冷蔵庫・日用品・洋服をまとめて検索</p>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 px-4 space-y-3 pt-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                msg.role === 'user'
                  ? 'bg-[#8b7355] text-white rounded-br-sm'
                  : 'bg-white text-[#3d3530] shadow-sm rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <span className="text-[#9c8f87] text-sm">検索中...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 入力欄 */}
      <div className="sticky bottom-16 bg-[#faf9f7] px-4 py-3 border-t border-[#f0ebe5]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="例：キャベツある？"
            className="flex-1 px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0] bg-white"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-12 h-12 rounded-2xl bg-[#8b7355] text-white flex items-center justify-center disabled:opacity-40 transition-colors hover:bg-[#7a6347] shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
