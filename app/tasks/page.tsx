'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type CleanupTask = {
  id: string
  place: string
  is_done: boolean
  created_at: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}/${day}`
}

export default function TasksPage() {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<CleanupTask[]>([])
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const loadTasks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data } = await supabase
      .from('cleanup_tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (data) setTasks(data as CleanupTask[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadTasks() }, [loadTasks])

  async function addTask() {
    const place = input.trim()
    if (!place) return
    setAdding(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: newTask } = await supabase
      .from('cleanup_tasks')
      .insert({ user_id: user.id, place, is_done: false })
      .select()
      .single()

    if (newTask) setTasks(prev => [...prev, newTask as CleanupTask])
    setInput('')
    setAdding(false)
  }

  async function toggleTask(id: string, current: boolean) {
    await supabase.from('cleanup_tasks').update({ is_done: !current }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_done: !current } : t))
  }

  async function deleteTask(id: string) {
    await supabase.from('cleanup_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#9c8f87] text-sm">読み込み中...</p>
      </div>
    )
  }

  const pendingTasks = tasks.filter(t => !t.is_done)
  const doneTasks = tasks.filter(t => t.is_done)

  return (
    <div className="min-h-screen w-full max-w-md mx-auto px-4 pb-32">
      {/* ヘッダー */}
      <div className="pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.push('/top')}
          className="w-8 h-8 rounded-full bg-[#f0ebe5] flex items-center justify-center text-[#6b5f58] shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-lg font-medium text-[#3d3530]">片付ける場所</h1>
      </div>

      {/* 入力エリア */}
      <div className="flex gap-2 mb-5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="場所を入力（例：キッチン引き出し）"
          className="flex-1 px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0] bg-white"
        />
        <button
          onClick={addTask}
          disabled={adding || !input.trim()}
          className="px-4 py-3 rounded-2xl bg-[#8b7355] text-white text-sm font-medium disabled:opacity-40 shrink-0"
        >
          追加
        </button>
      </div>

      {/* 未完了タスク */}
      {pendingTasks.length === 0 && doneTasks.length === 0 && (
        <div className="bg-white rounded-3xl p-8 shadow-sm text-center">
          <p className="text-sm text-[#b8b0a8]">片付ける場所を追加しましょう</p>
        </div>
      )}

      {pendingTasks.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm mb-4 overflow-hidden">
          {pendingTasks.map((task, i) => (
            <div
              key={task.id}
              className={`flex items-center gap-3 px-5 py-4 ${i < pendingTasks.length - 1 ? 'border-b border-[#f5f0eb]' : ''}`}
            >
              <button
                onClick={() => toggleTask(task.id, task.is_done)}
                className="w-5 h-5 rounded-full border-2 border-[#d0c8c0] shrink-0 flex items-center justify-center hover:border-[#8b7355] transition-colors"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#3d3530] truncate">{task.place}</p>
                <p className="text-[10px] text-[#b8b0a8] mt-0.5">{formatDate(task.created_at)}</p>
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="text-[#d0c8c0] hover:text-[#9c8f87] text-lg leading-none shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 完了タスク */}
      {doneTasks.length > 0 && (
        <div>
          <p className="text-xs text-[#9c8f87] mb-2 px-1">完了</p>
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            {doneTasks.map((task, i) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 px-5 py-4 ${i < doneTasks.length - 1 ? 'border-b border-[#f5f0eb]' : ''}`}
              >
                <button
                  onClick={() => toggleTask(task.id, task.is_done)}
                  className="w-5 h-5 rounded-full bg-[#c5b8b0] border-2 border-[#c5b8b0] shrink-0 flex items-center justify-center"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 6 4.5 9.5 11 2" />
                  </svg>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#b8b0a8] truncate line-through">{task.place}</p>
                  <p className="text-[10px] text-[#c5b8b0] mt-0.5">{formatDate(task.created_at)}</p>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-[#d0c8c0] hover:text-[#9c8f87] text-lg leading-none shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
