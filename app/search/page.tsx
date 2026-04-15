'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { findAnswer, FALLBACK } from '@/lib/aqua-qa'
import BottomNav from '@/components/BottomNav'

const ADMIN_EMAIL = 'aqua.sky.creator@gmail.com'

type Message = {
  role: 'user' | 'assistant'
  text: string
  isFallback?: boolean
  query?: string
}

type Mode = 'inventory' | 'advice'

function daysUntilExpiry(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

const INITIAL_MESSAGES: Record<Mode, Message> = {
  inventory: { role: 'assistant', text: '在庫を検索できます。「キャベツある？」のように話しかけてください。' },
  advice:    { role: 'assistant', text: 'AQUAです😊\n片付けや暮らしのことを何でも聞いてください✨' },
}

export default function SearchPage() {
  const [mode, setMode] = useState<Mode>('inventory')
  const [inventoryMessages, setInventoryMessages] = useState<Message[]>([INITIAL_MESSAGES.inventory])
  const [adviceMessages, setAdviceMessages]       = useState<Message[]>([INITIAL_MESSAGES.advice])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [addingForQuery, setAddingForQuery] = useState<string | null>(null)
  const [newKeywords, setNewKeywords] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const router = useRouter()
  const supabase = createClient()

  const messages = mode === 'inventory' ? inventoryMessages : adviceMessages
  const setMessages = mode === 'inventory'
    ? (fn: (prev: Message[]) => Message[]) => setInventoryMessages(fn)
    : (fn: (prev: Message[]) => Message[]) => setAdviceMessages(fn)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      const admin = user.email === ADMIN_EMAIL
      setIsAdmin(admin)
      if (admin) {
        const { count } = await supabase
          .from('unanswered_questions')
          .select('*', { count: 'exact', head: true })
          .eq('is_resolved', false)
        setUnreadCount(count ?? 0)
      }
    })
  }, [supabase, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [inventoryMessages, adviceMessages])

  function startVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('お使いのブラウザは音声入力に対応していません。Chromeをお使いください。')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'ja-JP'
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition
    recognition.onstart = () => setListening(true)
    recognition.onend   = () => setListening(false)
    recognition.onresult = (event: any) => {
      setInput(event.results[0][0].transcript)
    }
    recognition.onerror = () => {
      setListening(false)
      alert('音声認識に失敗しました。もう一度お試しください。')
    }
    recognition.start()
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  async function findCustomAnswer(query: string): Promise<string | null> {
    const { data } = await supabase.from('custom_qa').select('keywords, answer')
    if (!data || data.length === 0) return null

    const normalized = query.replace(/\s/g, '').toLowerCase()
    let bestScore = 0
    let bestAnswer: string | null = null

    for (const row of data) {
      const keywords = row.keywords.split(',').map((k: string) => k.trim())
      let score = 0
      for (const kw of keywords) {
        const k = kw.replace(/\s/g, '').toLowerCase()
        if (k && normalized.includes(k)) score += k.length
      }
      if (score > bestScore) {
        bestScore = score
        bestAnswer = row.answer
      }
    }

    return bestScore > 0 ? bestAnswer : null
  }

  async function handleSend() {
    const q = input.trim()
    if (!q || loading) return
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setLoading(true)
    setAddingForQuery(null)

    let reply: string
    let isFallback = false

    if (mode === 'inventory') {
      reply = await searchInventory(q)
    } else {
      const staticReply = findAnswer(q)
      if (staticReply === FALLBACK) {
        const custom = await findCustomAnswer(q)
        if (custom) {
          reply = custom
        } else {
          reply = FALLBACK
          isFallback = true
          // 未回答質問として記録
          await supabase.from('unanswered_questions').insert({ question: q })
        }
      } else {
        reply = staticReply
      }
    }

    setMessages(prev => [...prev, { role: 'assistant', text: reply, isFallback, query: q }])
    setLoading(false)
  }

  async function handleSaveCustom(query: string) {
    if (!newKeywords.trim() || !newAnswer.trim()) return
    setSaving(true)

    await supabase.from('custom_qa').insert({
      keywords: newKeywords.trim(),
      answer: newAnswer.trim(),
    })

    // チャット内のfallbackメッセージを更新
    setAdviceMessages(prev => prev.map(msg =>
      msg.isFallback && msg.query === query
        ? { ...msg, text: newAnswer.trim(), isFallback: false }
        : msg
    ))

    setAddingForQuery(null)
    setNewKeywords('')
    setNewAnswer('')
    setSaving(false)
  }

  async function searchInventory(query: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'ログインが必要です。'

    const keyword = query
      .replace(/[あるないどこですかはが？?！!。、\s]+/g, '')
      .trim()

    if (!keyword) return 'アイテム名を教えてください。例：「キャベツある？」'

    const [fridgeRes, suppliesRes, closetRes] = await Promise.all([
      supabase.from('fridge_items').select('*').eq('user_id', user.id).ilike('name', `%${keyword}%`),
      supabase.from('supplies').select('*').eq('user_id', user.id).ilike('name', `%${keyword}%`),
      supabase.from('closet_items').select('*').eq('user_id', user.id).ilike('name', `%${keyword}%`),
    ])

    const results: string[] = []

    if (fridgeRes.data?.length) {
      for (const item of fridgeRes.data) {
        const days = daysUntilExpiry(item.expiry_date)
        let line = `冷蔵庫に「${item.name}」があります（${item.quantity}）`
        if (days !== null) {
          if (days < 0)    line += `。⚠️ 期限が${Math.abs(days)}日過ぎています`
          else if (days === 0) line += '。今日が期限です'
          else line += `。あと${days}日`
        }
        results.push(line)
      }
    }
    if (suppliesRes.data?.length) {
      for (const item of suppliesRes.data) {
        results.push(`日用品に「${item.name}」があります（${item.status}・${item.quantity}）`)
      }
    }
    if (closetRes.data?.length) {
      for (const item of closetRes.data) {
        let line = `洋服に「${item.name}」があります（${item.category}`
        if (item.color)  line += `・${item.color}`
        if (item.season) line += `・${item.season}`
        line += '）'
        results.push(line)
      }
    }

    return results.length > 0
      ? results.join('\n')
      : `「${keyword}」は登録されていないようです。`
  }

  const placeholder = mode === 'inventory'
    ? (listening ? '聞いています...' : '例：キャベツある？')
    : (listening ? '聞いています...' : '例：捨てられません')

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-[#faf9f7] pt-6 px-4 pb-3 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-medium text-[#3d3530]">相談</h1>
          {isAdmin && (
            <button
              onClick={() => router.push('/admin/qa')}
              className="relative text-xs text-[#8b7355] bg-[#f5f0eb] px-3 py-1.5 rounded-full"
            >
              Q&A管理
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-400 text-white text-[10px] flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
        </div>
        {/* モード切り替え */}
        <div className="flex bg-[#f0ebe5] rounded-2xl p-1">
          <button
            onClick={() => setMode('inventory')}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
              mode === 'inventory' ? 'bg-white text-[#3d3530] shadow-sm' : 'text-[#9c8f87]'
            }`}
          >
            在庫を調べる
          </button>
          <button
            onClick={() => setMode('advice')}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
              mode === 'advice' ? 'bg-white text-[#3d3530] shadow-sm' : 'text-[#9c8f87]'
            }`}
          >
            AQUAに相談
          </button>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 px-4 space-y-3 pt-2">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && mode === 'advice' && (
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mr-2 mt-0.5">
                  <img src="/aqua.png" alt="AQUA" className="w-full h-full object-cover" />
                </div>
              )}
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

            {/* 管理者向け：回答を追加ボタン */}
            {isAdmin && msg.role === 'assistant' && msg.isFallback && mode === 'advice' && (
              <div className="ml-10 mt-2">
                {addingForQuery === msg.query ? (
                  <div className="bg-[#fdf8f3] rounded-2xl p-4 border border-[#ede5d8]">
                    <p className="text-xs font-medium text-[#6b5f58] mb-3">回答を登録する</p>
                    <div className="space-y-2 mb-3">
                      <div>
                        <label className="text-[10px] text-[#9c8f87] block mb-1">
                          キーワード（カンマ区切り）
                        </label>
                        <input
                          type="text"
                          value={newKeywords}
                          onChange={e => setNewKeywords(e.target.value)}
                          placeholder="例：断捨離, 手放せない, 捨てられない"
                          className="w-full px-3 py-2 rounded-xl border border-[#e8e0d8] text-xs text-[#3d3530] focus:outline-none focus:ring-1 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#9c8f87] block mb-1">回答</label>
                        <textarea
                          value={newAnswer}
                          onChange={e => setNewAnswer(e.target.value)}
                          placeholder="AQUAとして回答を入力してください"
                          rows={3}
                          className="w-full px-3 py-2 rounded-xl border border-[#e8e0d8] text-xs text-[#3d3530] focus:outline-none focus:ring-1 focus:ring-[#b8a99a] placeholder-[#c5b8b0] resize-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setAddingForQuery(null); setNewKeywords(''); setNewAnswer('') }}
                        className="flex-1 py-2 rounded-xl bg-[#f0ebe5] text-[#6b5f58] text-xs"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => handleSaveCustom(msg.query!)}
                        disabled={saving || !newKeywords.trim() || !newAnswer.trim()}
                        className="flex-1 py-2 rounded-xl bg-[#8b7355] text-white text-xs disabled:opacity-50"
                      >
                        {saving ? '保存中...' : '保存する'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAddingForQuery(msg.query ?? '')
                      setNewKeywords(msg.query ?? '')
                      setNewAnswer('')
                    }}
                    className="text-xs text-[#8b7355] bg-[#fdf5ec] px-3 py-1.5 rounded-full border border-[#e8d8b8]"
                  >
                    + この質問に回答を追加する
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <span className="text-[#9c8f87] text-sm">{mode === 'inventory' ? '検索中...' : '考え中...'}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 入力欄 */}
      <div className="sticky bottom-16 bg-[#faf9f7] px-4 py-3 border-t border-[#f0ebe5]">
        <div className="flex gap-2">
          <button
            onClick={listening ? stopVoice : startVoice}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
              listening ? 'bg-red-50 border-2 border-red-200 animate-pulse' : 'bg-[#f0ebe5] hover:bg-[#e8e0d8]'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={listening ? '#f87171' : '#8b7355'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={placeholder}
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
