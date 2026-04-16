'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type MealType = '朝' | '昼' | '夜'
const MEAL_TYPES: MealType[] = ['朝', '昼', '夜']
const DAYS = ['月', '火', '水', '木', '金', '土', '日']

type MealEntry = {
  id: string
  date: string
  meal_type: string
  content: string
}

function getWeekDates(baseDate: Date): Date[] {
  const day = baseDate.getDay()
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDateLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export default function MealPlanPage() {
  const [loading, setLoading] = useState(true)
  const [weekBase, setWeekBase] = useState(() => new Date())
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const weekDates = getWeekDates(weekBase)
  const today = toDateStr(new Date())

  const fetchMeals = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const from = toDateStr(weekDates[0])
    const to = toDateStr(weekDates[6])

    const { data } = await supabase
      .from('meal_plans')
      .select('id, date, meal_type, content')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to)

    if (data) setMeals(data as MealEntry[])
    setLoading(false)
  }, [supabase, router, weekDates[0], weekDates[6]])

  useEffect(() => { fetchMeals() }, [weekBase])

  function getMeal(date: string, mealType: string): MealEntry | undefined {
    return meals.find(m => m.date === date && m.meal_type === mealType)
  }

  function startEdit(date: string, mealType: string) {
    const key = `${date}_${mealType}`
    const existing = getMeal(date, mealType)
    setEditingKey(key)
    setEditingValue(existing?.content ?? '')
  }

  async function saveEdit(date: string, mealType: string) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const content = editingValue.trim()
    const existing = getMeal(date, mealType)

    if (!content) {
      // 空なら削除
      if (existing) {
        await supabase.from('meal_plans').delete().eq('id', existing.id)
        setMeals(prev => prev.filter(m => m.id !== existing.id))
      }
    } else if (existing) {
      // 更新
      await supabase.from('meal_plans').update({ content }).eq('id', existing.id)
      setMeals(prev => prev.map(m => m.id === existing.id ? { ...m, content } : m))
    } else {
      // 新規
      const { data } = await supabase
        .from('meal_plans')
        .insert({ user_id: user.id, date, meal_type: mealType, content })
        .select('id, date, meal_type, content')
        .single()
      if (data) setMeals(prev => [...prev, data as MealEntry])
    }

    setEditingKey(null)
    setEditingValue('')
    setSaving(false)
  }

  function prevWeek() {
    const d = new Date(weekBase)
    d.setDate(d.getDate() - 7)
    setWeekBase(d)
    setLoading(true)
  }

  function nextWeek() {
    const d = new Date(weekBase)
    d.setDate(d.getDate() + 7)
    setWeekBase(d)
    setLoading(true)
  }

  function goToday() {
    setWeekBase(new Date())
    setLoading(true)
  }

  const weekLabel = `${weekDates[0].getMonth() + 1}月${weekDates[0].getDate()}日 〜 ${weekDates[6].getMonth() + 1}月${weekDates[6].getDate()}日`

  return (
    <div className="min-h-screen w-full max-w-md mx-auto px-4 pb-32">
      {/* ヘッダー */}
      <div className="pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => router.push('/fridge')} className="text-[#9c8f87] text-sm">←</button>
        <div className="flex-1">
          <h1 className="text-lg font-medium text-[#3d3530]">1週間の献立</h1>
        </div>
      </div>

      {/* 週ナビゲーション */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevWeek}
          className="w-9 h-9 rounded-full bg-[#f0ebe5] text-[#6b5f58] flex items-center justify-center text-sm"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-sm font-medium text-[#3d3530]">{weekLabel}</p>
          <button onClick={goToday} className="text-[10px] text-[#8b7355] mt-0.5">今週に戻る</button>
        </div>
        <button
          onClick={nextWeek}
          className="w-9 h-9 rounded-full bg-[#f0ebe5] text-[#6b5f58] flex items-center justify-center text-sm"
        >
          →
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-[#9c8f87] text-sm">読み込み中...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {weekDates.map((date, i) => {
            const dateStr = toDateStr(date)
            const isToday = dateStr === today
            const isWeekend = i >= 5

            return (
              <div
                key={dateStr}
                className={`bg-white rounded-3xl p-4 shadow-sm ${isToday ? 'ring-2 ring-[#8b7355]' : ''}`}
              >
                {/* 日付ヘッダー */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-sm font-medium ${
                    isToday ? 'text-[#8b7355]' : isWeekend ? (i === 5 ? 'text-blue-400' : 'text-red-400') : 'text-[#3d3530]'
                  }`}>
                    {DAYS[i]}
                  </span>
                  <span className="text-xs text-[#9c8f87]">{formatDateLabel(date)}</span>
                  {isToday && (
                    <span className="text-[10px] bg-[#8b7355] text-white px-2 py-0.5 rounded-full">今日</span>
                  )}
                </div>

                {/* 朝・昼・夜 */}
                <div className="space-y-2">
                  {MEAL_TYPES.map(mealType => {
                    const key = `${dateStr}_${mealType}`
                    const meal = getMeal(dateStr, mealType)
                    const isEditing = editingKey === key

                    return (
                      <div key={mealType} className="flex items-center gap-2">
                        <span className="text-[10px] text-[#b8a99a] w-4 shrink-0">{mealType}</span>
                        {isEditing ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit(dateStr, mealType)
                                if (e.key === 'Escape') { setEditingKey(null); setEditingValue('') }
                              }}
                              placeholder="料理名を入力..."
                              autoFocus
                              className="flex-1 px-3 py-1.5 rounded-xl border border-[#e8e0d8] text-xs text-[#3d3530] focus:outline-none focus:ring-1 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
                            />
                            <button
                              onClick={() => saveEdit(dateStr, mealType)}
                              disabled={saving}
                              className="px-3 py-1.5 rounded-xl bg-[#8b7355] text-white text-xs disabled:opacity-50"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => { setEditingKey(null); setEditingValue('') }}
                              className="px-2 py-1.5 rounded-xl bg-[#f0ebe5] text-[#9c8f87] text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(dateStr, mealType)}
                            className={`flex-1 text-left px-3 py-1.5 rounded-xl text-xs transition-colors ${
                              meal
                                ? 'bg-[#fdf8f3] text-[#3d3530] border border-[#ede5d8]'
                                : 'text-[#c5b8b0] hover:bg-[#f9f5f1]'
                            }`}
                          >
                            {meal ? meal.content : '+ 追加'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
