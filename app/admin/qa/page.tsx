'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = 'aqua.sky.creator@gmail.com'

type CustomQA = {
  id: string
  keywords: string
  answer: string
  created_at: string
}

type UnansweredQ = {
  id: string
  question: string
  asked_at: string
  is_resolved: boolean
}

export default function AdminQAPage() {
  const [items, setItems] = useState<CustomQA[]>([])
  const [unanswered, setUnanswered] = useState<UnansweredQ[]>([])
  const [loading, setLoading] = useState(true)
  const [keywords, setKeywords] = useState('')
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editKeywords, setEditKeywords] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchItems = useCallback(async () => {
    const [qaRes, uqRes] = await Promise.all([
      supabase.from('custom_qa').select('*').order('created_at', { ascending: false }),
      supabase.from('unanswered_questions').select('*').eq('is_resolved', false).order('asked_at', { ascending: false }),
    ])
    if (qaRes.data) setItems(qaRes.data as CustomQA[])
    if (uqRes.data) setUnanswered(uqRes.data as UnansweredQ[])
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push('/top')
        return
      }
      await fetchItems()
      setLoading(false)
    }
    init()
  }, [supabase, router, fetchItems])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!keywords.trim() || !answer.trim()) return
    setSaving(true)
    await supabase.from('custom_qa').insert({
      keywords: keywords.trim(),
      answer: answer.trim(),
    })
    // 対応する未回答質問を解決済みにする
    if (replyingToId) {
      await supabase.from('unanswered_questions').update({ is_resolved: true }).eq('id', replyingToId)
      setReplyingToId(null)
    }
    setKeywords('')
    setAnswer('')
    await fetchItems()
    setSaving(false)
  }

  function fillFromUnanswered(q: UnansweredQ) {
    setReplyingToId(q.id)
    setKeywords(q.question)
    setAnswer('')
    // フォームまでスクロール
    document.getElementById('add-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function dismissUnanswered(id: string) {
    await supabase.from('unanswered_questions').update({ is_resolved: true }).eq('id', id)
    setUnanswered(prev => prev.filter(q => q.id !== id))
  }

  async function handleDelete(id: string) {
    await supabase.from('custom_qa').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleSaveEdit(id: string) {
    if (!editKeywords.trim() || !editAnswer.trim()) return
    await supabase.from('custom_qa').update({
      keywords: editKeywords.trim(),
      answer: editAnswer.trim(),
    }).eq('id', id)
    setEditingId(null)
    await fetchItems()
  }

  function startEdit(item: CustomQA) {
    setEditingId(item.id)
    setEditKeywords(item.keywords)
    setEditAnswer(item.answer)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#9c8f87] text-sm">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-md mx-auto px-4 pb-20">
      {/* ヘッダー */}
      <div className="pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.push('/search')}
          className="text-[#9c8f87] text-sm"
        >
          ←
        </button>
        <div>
          <h1 className="text-lg font-medium text-[#3d3530]">Q&A管理</h1>
          <p className="text-xs text-[#9c8f87]">カスタム回答 {items.length}件</p>
        </div>
      </div>

      {/* 未回答の質問 */}
      {unanswered.length > 0 && (
        <div className="bg-[#fff8f0] rounded-3xl p-5 shadow-sm mb-5 border border-[#f0d8b8]">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-5 h-5 rounded-full bg-red-400 text-white text-[10px] flex items-center justify-center font-medium shrink-0">
              {unanswered.length}
            </span>
            <p className="text-xs font-medium text-[#6b5f58]">回答できなかった質問</p>
          </div>
          <div className="space-y-2">
            {unanswered.map(q => (
              <div key={q.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#3d3530] truncate">「{q.question}」</p>
                  <p className="text-[10px] text-[#b8b0a8] mt-0.5">
                    {new Date(q.asked_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => fillFromUnanswered(q)}
                    className="text-xs text-white bg-[#8b7355] px-3 py-1.5 rounded-full"
                  >
                    回答する
                  </button>
                  <button
                    onClick={() => dismissUnanswered(q.id)}
                    className="text-xs text-[#c5b8b0] hover:text-[#9c8f87]"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 新規追加フォーム */}
      <div id="add-form" className="bg-white rounded-3xl p-5 shadow-sm mb-5">
        <p className="text-xs font-medium text-[#6b5f58] mb-4">
          {replyingToId ? '未回答質問に回答する' : '新しい回答を追加'}
        </p>
        {replyingToId && (
          <button
            onClick={() => { setReplyingToId(null); setKeywords(''); setAnswer('') }}
            className="text-[10px] text-[#9c8f87] mb-3 block"
          >
            ← 通常追加に戻る
          </button>
        )}
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="text-[10px] text-[#9c8f87] block mb-1">
              キーワード（カンマ区切り）
            </label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="例：料理, 献立, 食材の使い方"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
            <p className="text-[10px] text-[#b8b0a8] mt-1 px-1">
              利用者の質問に含まれそうな言葉をカンマ区切りで入力してください
            </p>
          </div>
          <div>
            <label className="text-[10px] text-[#9c8f87] block mb-1">回答</label>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="AQUAとしての回答を入力..."
              rows={4}
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0] resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !keywords.trim() || !answer.trim()}
            className="w-full py-3 rounded-2xl bg-[#8b7355] text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? '保存中...' : '追加する'}
          </button>
        </form>
      </div>

      {/* 一覧 */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-[#9c8f87]">カスタム回答はまだありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm">
              {editingId === item.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-[#9c8f87] block mb-1">キーワード</label>
                    <input
                      type="text"
                      value={editKeywords}
                      onChange={e => setEditKeywords(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#e8e0d8] text-xs text-[#3d3530] focus:outline-none focus:ring-1 focus:ring-[#b8a99a]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#9c8f87] block mb-1">回答</label>
                    <textarea
                      value={editAnswer}
                      onChange={e => setEditAnswer(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-[#e8e0d8] text-xs text-[#3d3530] focus:outline-none focus:ring-1 focus:ring-[#b8a99a] resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 py-2 rounded-xl bg-[#f0ebe5] text-[#6b5f58] text-xs"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      className="flex-1 py-2 rounded-xl bg-[#8b7355] text-white text-xs"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap gap-1 flex-1">
                      {item.keywords.split(',').map(k => (
                        <span
                          key={k}
                          className="text-[10px] bg-[#f0ebe5] text-[#6b5f58] px-2 py-0.5 rounded-full"
                        >
                          {k.trim()}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(item)}
                        className="text-xs text-[#8b7355]"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs text-[#c5b8b0] hover:text-[#9c8f87]"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[#3d3530] leading-relaxed whitespace-pre-line">
                    {item.answer}
                  </p>
                  <p className="text-[10px] text-[#c5b8b0] mt-2">
                    {new Date(item.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
