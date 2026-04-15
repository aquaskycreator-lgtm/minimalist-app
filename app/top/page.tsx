'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getTodayQuote } from '@/lib/aqua-quotes'
import BottomNav from '@/components/BottomNav'

const DISCARD_GOAL = 100

type DailyRecord = {
  id: string
  date: string
  food_count: number
  supplies_count: number
  closet_count: number
  total_count: number
  memo: string | null
}

type ItemTargets = {
  food: number | null
  supplies: number | null
  closet: number | null
  total: number | null
}

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

function TrendChart({ records }: { records: DailyRecord[] }) {
  if (records.length < 2) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-[#b8b0a8]">
        毎日アプリを開くと推移が記録されます
      </div>
    )
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const values = sorted.map(r => r.total_count)
  const maxVal = Math.max(...values)
  const minVal = Math.min(...values)
  const range = maxVal - minVal || 1

  const W = 280
  const H = 72
  const PX = 10
  const PY = 8

  const coords = sorted.map((r, i) => ({
    x: PX + (i / (sorted.length - 1)) * (W - PX * 2),
    y: (H - PY) - ((r.total_count - minVal) / range) * (H - PY * 2 - 12),
    label: r.date.slice(5),
  }))

  const polyline = coords.map(c => `${c.x},${c.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
      <line x1={PX} y1={H - PY - 12} x2={W - PX} y2={H - PY - 12} stroke="#f0ebe5" strokeWidth="1" />
      <polyline points={polyline} fill="none" stroke="#8b7355" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill="#8b7355" />
      ))}
      <text x={coords[0].x} y={H} textAnchor="middle" fontSize="8" fill="#b8b0a8">{coords[0].label}</text>
      <text x={coords[coords.length - 1].x} y={H} textAnchor="middle" fontSize="8" fill="#b8b0a8">{coords[coords.length - 1].label}</text>
    </svg>
  )
}

export default function TopPage() {
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [deviation, setDeviation] = useState<number | null>(null)
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [todayRecord, setTodayRecord] = useState<DailyRecord | null>(null)
  const [memo, setMemo] = useState('')
  const [targets, setTargets] = useState<ItemTargets>({ food: null, supplies: null, closet: null, total: null })
  const [editingTargets, setEditingTargets] = useState(false)
  const [targetInputs, setTargetInputs] = useState({ food: '', supplies: '', closet: '', total: '' })
  const [currentCounts, setCurrentCounts] = useState({ food: 0, supplies: 0, closet: 0, total: 0 })
  // 断捨離
  const [discardItems, setDiscardItems] = useState<DiscardItem[]>([])
  const [discardTotal, setDiscardTotal] = useState(0)
  const [discardInput, setDiscardInput] = useState('')
  const [addingDiscard, setAddingDiscard] = useState(false)
  const [showAllDiscard, setShowAllDiscard] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUserEmail(user.email ?? '')

    const [diagRes, fridgeRes, suppliesRes, closetRes, discardCountRes, discardRecentRes] = await Promise.all([
      supabase.from('diagnosis_results').select('deviation').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('fridge_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('supplies').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('closet_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('discard_items').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('discard_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    ])

    if (diagRes.data) setDeviation(diagRes.data.deviation)

    const foodCount = fridgeRes.count ?? 0
    const suppliesCount = suppliesRes.count ?? 0
    const closetCount = closetRes.count ?? 0
    const totalCount = foodCount + suppliesCount + closetCount
    setCurrentCounts({ food: foodCount, supplies: suppliesCount, closet: closetCount, total: totalCount })

    setDiscardTotal(discardCountRes.count ?? 0)
    if (discardRecentRes.data) setDiscardItems(discardRecentRes.data as DiscardItem[])

    // 今日の記録を保存/更新
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase.from('daily_records').select('*').eq('user_id', user.id).eq('date', today).single()
    if (existing) {
      await supabase.from('daily_records').update({ food_count: foodCount, supplies_count: suppliesCount, closet_count: closetCount, total_count: totalCount }).eq('id', existing.id)
      setTodayRecord({ ...existing, food_count: foodCount, supplies_count: suppliesCount, closet_count: closetCount, total_count: totalCount })
      setMemo(existing.memo ?? '')
    } else {
      const { data: newRec } = await supabase.from('daily_records').insert({ user_id: user.id, date: today, food_count: foodCount, supplies_count: suppliesCount, closet_count: closetCount, total_count: totalCount }).select().single()
      if (newRec) setTodayRecord(newRec)
    }

    // 過去14日の記録
    const { data: recData } = await supabase.from('daily_records').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(14)
    if (recData) setRecords(recData)

    // 目標設定
    const { data: targetData } = await supabase.from('item_targets').select('*').eq('user_id', user.id)
    if (targetData) {
      const t: ItemTargets = { food: null, supplies: null, closet: null, total: null }
      for (const row of targetData) {
        if (row.category === 'food') t.food = row.target_count
        if (row.category === 'supplies') t.supplies = row.target_count
        if (row.category === 'closet') t.closet = row.target_count
        if (row.category === 'total') t.total = row.target_count
      }
      setTargets(t)
      setTargetInputs({ food: t.food?.toString() ?? '', supplies: t.supplies?.toString() ?? '', closet: t.closet?.toString() ?? '', total: t.total?.toString() ?? '' })
    }

    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadAll() }, [loadAll])

  async function saveMemo() {
    if (!todayRecord) return
    await supabase.from('daily_records').update({ memo: memo || null }).eq('id', todayRecord.id)
  }

  async function saveTargets() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const entries = [
      { category: 'food', value: targetInputs.food },
      { category: 'supplies', value: targetInputs.supplies },
      { category: 'closet', value: targetInputs.closet },
      { category: 'total', value: targetInputs.total },
    ]
    for (const entry of entries) {
      const val = parseInt(entry.value)
      if (!isNaN(val) && val > 0) {
        await supabase.from('item_targets').upsert({ user_id: user.id, category: entry.category, target_count: val }, { onConflict: 'user_id,category' })
      } else {
        await supabase.from('item_targets').delete().eq('user_id', user.id).eq('category', entry.category)
      }
    }
    await loadAll()
    setEditingTargets(false)
  }

  async function addDiscardItem() {
    const name = discardInput.trim()
    if (!name) return
    setAddingDiscard(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: newItem } = await supabase.from('discard_items').insert({ user_id: user.id, name }).select().single()
    if (newItem) {
      setDiscardItems(prev => [newItem as DiscardItem, ...prev.slice(0, 4)])
      setDiscardTotal(prev => prev + 1)
    }
    setDiscardInput('')
    setAddingDiscard(false)
  }

  async function deleteDiscardItem(id: string) {
    await supabase.from('discard_items').delete().eq('id', id)
    setDiscardItems(prev => prev.filter(i => i.id !== id))
    setDiscardTotal(prev => Math.max(0, prev - 1))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#9c8f87] text-sm">読み込み中...</p>
      </div>
    )
  }

  const barColor = deviation !== null
    ? (deviation >= 70 ? '#6aaa7e' : deviation >= 60 ? '#8b7355' : deviation >= 50 ? '#b8a040' : '#c47a5a')
    : '#b8b0a8'

  const discardRemaining = Math.max(0, DISCARD_GOAL - discardTotal)
  const discardProgress = Math.min(discardTotal / DISCARD_GOAL, 1)
  const isDiscardComplete = discardTotal >= DISCARD_GOAL

  return (
    <div className="min-h-screen w-full max-w-md mx-auto px-4 pb-32">
      {/* ヘッダー */}
      <div className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-[#3d3530]">トップ</h1>
          <p className="text-xs text-[#9c8f87]">{userEmail}</p>
        </div>
        <button onClick={handleSignOut} className="text-xs text-[#9c8f87]">ログアウト</button>
      </div>

      {/* 今日のひとこと */}
      <div className="bg-[#fdf8f3] rounded-2xl px-4 py-3 mb-3 border border-[#ede5d8]">
        <p className="text-[10px] text-[#b8a99a] mb-0.5">今日のひとこと</p>
        <p className="text-xs text-[#6b5f58] leading-relaxed">{getTodayQuote()}</p>
      </div>

      {/* 100捨てチャレンジ */}
      <div className={`rounded-3xl p-5 shadow-sm mb-3 ${isDiscardComplete ? 'bg-[#f0f7ed]' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-[#6b5f58]">100捨てチャレンジ</p>
          {isDiscardComplete && (
            <span className="text-xs text-[#4a6741] bg-[#d4e8c2] px-2 py-0.5 rounded-full font-medium">達成！</span>
          )}
        </div>

        {/* カウントダウン表示 */}
        <div className="flex items-end gap-3 mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold" style={{ color: isDiscardComplete ? '#4a6741' : '#8b7355' }}>
              {isDiscardComplete ? '100' : discardRemaining}
            </span>
            <span className="text-sm text-[#9c8f87]">
              {isDiscardComplete ? '個達成' : '個'}
            </span>
          </div>
          <div className="pb-1">
            <p className="text-xs text-[#9c8f87]">
              {isDiscardComplete ? 'おめでとうございます！' : 'あと手放すと達成'}
            </p>
            <p className="text-[10px] text-[#b8b0a8]">{discardTotal} / {DISCARD_GOAL} 個手放した</p>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="h-2.5 bg-[#f0ebe5] rounded-full mb-4">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{
              width: `${discardProgress * 100}%`,
              backgroundColor: isDiscardComplete ? '#6aaa7e' : '#8b7355',
            }}
          />
        </div>

        {/* 入力欄 */}
        {!isDiscardComplete && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={discardInput}
              onChange={e => setDiscardInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDiscardItem()}
              placeholder="手放したモノを入力..."
              className="flex-1 px-3 py-2.5 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
            <button
              onClick={addDiscardItem}
              disabled={addingDiscard || !discardInput.trim()}
              className="px-4 py-2.5 rounded-2xl bg-[#8b7355] text-white text-sm font-medium disabled:opacity-40"
            >
              追加
            </button>
          </div>
        )}

        {/* 最近手放したもの */}
        {discardItems.length > 0 && (
          <div>
            <p className="text-[10px] text-[#9c8f87] mb-2">最近手放したもの</p>
            <div className="space-y-1.5">
              {discardItems.map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-[#3d3530] truncate">・{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] text-[#b8b0a8]">{relativeDate(item.created_at)}</span>
                    <button
                      onClick={() => deleteDiscardItem(item.id)}
                      className="text-[#d0c8c0] hover:text-[#9c8f87] text-sm leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {discardTotal > 5 && (
              <button
                onClick={() => setShowAllDiscard(!showAllDiscard)}
                className="text-[10px] text-[#8b7355] mt-2 block"
              >
                {showAllDiscard ? '閉じる' : `他 ${discardTotal - 5} 件を見る`}
              </button>
            )}
          </div>
        )}

        {discardItems.length === 0 && (
          <p className="text-xs text-[#b8b0a8] text-center py-2">手放したモノを記録しましょう</p>
        )}
      </div>

      {/* 断捨離報告 */}
      <div className="bg-white rounded-3xl p-5 shadow-sm mb-3">
        <p className="text-xs font-medium text-[#6b5f58] mb-3">断捨離報告</p>
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="今日手放したモノ、気づいたことを書いておこう..."
          rows={3}
          className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0] resize-none"
        />
        <button
          onClick={saveMemo}
          className="mt-2 w-full py-2.5 rounded-2xl bg-[#f0ebe5] text-[#6b5f58] text-xs font-medium"
        >
          保存
        </button>
      </div>

      {/* 片付け偏差値 */}
      <div className="bg-white rounded-3xl p-5 shadow-sm mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-[#6b5f58]">片付け偏差値</p>
          <button onClick={() => router.push('/diagnosis')} className="text-xs text-[#8b7355]">
            {deviation !== null ? '再診断 →' : '診断する →'}
          </button>
        </div>
        {deviation !== null ? (
          <>
            <div className="text-4xl font-bold mb-2" style={{ color: barColor }}>{deviation}</div>
            <div className="h-2 bg-[#f0ebe5] rounded-full">
              <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(((deviation - 30) / 50) * 100, 100)}%`, backgroundColor: barColor }} />
            </div>
          </>
        ) : (
          <p className="text-sm text-[#b8b0a8]">まだ診断していません</p>
        )}
      </div>

      {/* クイックリンク */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button onClick={() => router.push('/search')} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center gap-2">
          <img src="/aqua.png" alt="AQUA" className="w-10 h-10 rounded-full object-cover" />
          <span className="text-xs font-medium text-[#3d3530]">AQUAに相談</span>
          <span className="text-[10px] text-[#9c8f87]">在庫・片付けの悩み</span>
        </button>
        <button onClick={() => router.push('/diagnosis')} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center gap-2">
          <span className="text-3xl">📊</span>
          <span className="text-xs font-medium text-[#3d3530]">片付け診断</span>
          <span className="text-[10px] text-[#9c8f87]">偏差値を測る</span>
        </button>
      </div>

      {/* アイテム数サマリー */}
      <div className="bg-white rounded-3xl p-5 shadow-sm mb-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-[#6b5f58]">現在のアイテム数</p>
          <button onClick={() => setEditingTargets(!editingTargets)} className="text-xs text-[#8b7355]">
            {editingTargets ? 'キャンセル' : '目標を設定'}
          </button>
        </div>
        {editingTargets ? (
          <div className="space-y-3">
            {[
              { key: 'food', label: '食料品', current: currentCounts.food },
              { key: 'supplies', label: '日用品', current: currentCounts.supplies },
              { key: 'closet', label: 'アパレル', current: currentCounts.closet },
              { key: 'total', label: '合計', current: currentCounts.total },
            ].map(item => (
              <div key={item.key} className="flex items-center gap-2">
                <span className="text-xs text-[#6b5f58] w-16 shrink-0">{item.label}</span>
                <span className="text-xs text-[#3d3530] w-10 shrink-0">{item.current}個</span>
                <span className="text-xs text-[#b8b0a8] shrink-0">目標:</span>
                <input
                  type="number"
                  value={targetInputs[item.key as keyof typeof targetInputs]}
                  onChange={e => setTargetInputs(prev => ({ ...prev, [item.key]: e.target.value }))}
                  placeholder="未設定"
                  min="1"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-[#e8e0d8] text-xs text-[#3d3530] focus:outline-none focus:ring-1 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
                />
              </div>
            ))}
            <button onClick={saveTargets} className="w-full py-2.5 rounded-2xl bg-[#8b7355] text-white text-xs font-medium mt-2">保存する</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '食料品', count: currentCounts.food, target: targets.food, icon: '🥗' },
              { label: '日用品', count: currentCounts.supplies, target: targets.supplies, icon: '🧴' },
              { label: 'アパレル', count: currentCounts.closet, target: targets.closet, icon: '👗' },
              { label: '合計', count: currentCounts.total, target: targets.total, icon: '📦' },
            ].map(item => (
              <div key={item.label} className="bg-[#faf9f7] rounded-2xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs text-[#9c8f87]">{item.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-[#3d3530]">{item.count}</span>
                  {item.target !== null && (
                    <span className={`text-xs ${item.count <= item.target ? 'text-[#6aaa7e]' : 'text-[#c47a5a]'}`}>/ {item.target}</span>
                  )}
                </div>
                {item.target !== null && (
                  <div className="h-1.5 bg-[#e8e0d8] rounded-full mt-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min((item.count / item.target) * 100, 100)}%`, backgroundColor: item.count <= item.target ? '#6aaa7e' : '#c47a5a' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 推移グラフ */}
      <div className="bg-white rounded-3xl p-5 shadow-sm mb-3">
        <p className="text-xs font-medium text-[#6b5f58] mb-3">アイテム数の推移（合計）</p>
        <TrendChart records={records} />
      </div>

      <BottomNav />
    </div>
  )
}
