'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getTodayQuote } from '@/lib/aqua-quotes'
import BottomNav from '@/components/BottomNav'

const DISCARD_GOAL = 100

type DailyRecord = {
  id: string
  date: string
  memo: string | null
}

type DiscardItem = {
  id: string
  name: string
  created_at: string
}

type IdealImage = {
  id: string
  image_path: string
}

function relativeDate(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今日'
  if (diffDays === 1) return '昨日'
  return `${diffDays}日前`
}

function calcStreak(dates: string[], today: string): number {
  if (!dates.length) return 0
  const dateSet = new Set(dates)
  let streak = 0
  const current = new Date(today)
  while (true) {
    const dateStr = current.toISOString().split('T')[0]
    if (dateSet.has(dateStr)) {
      streak++
      current.setDate(current.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export default function TopPage() {
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [deviation, setDeviation] = useState<number | null>(null)
  const [todayRecord, setTodayRecord] = useState<DailyRecord | null>(null)
  const [memo, setMemo] = useState('')
  const [discardItems, setDiscardItems] = useState<DiscardItem[]>([])
  const [discardTotal, setDiscardTotal] = useState(0)
  const [discardInput, setDiscardInput] = useState('')
  const [addingDiscard, setAddingDiscard] = useState(false)
  const [streak, setStreak] = useState(0)
  const [idealImages, setIdealImages] = useState<IdealImage[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUserEmail(user.email ?? '')
    setUserId(user.id)

    const [diagRes, discardCountRes, discardRecentRes, allDatesRes, idealImagesRes] = await Promise.all([
      supabase.from('diagnosis_results').select('deviation').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('discard_items').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('discard_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('daily_records').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(365),
      supabase.from('ideal_room_images').select('id, image_path').eq('user_id', user.id).order('created_at', { ascending: true }),
    ])

    if (diagRes.data) setDeviation(diagRes.data.deviation)
    setDiscardTotal(discardCountRes.count ?? 0)
    if (discardRecentRes.data) setDiscardItems(discardRecentRes.data as DiscardItem[])
    if (idealImagesRes.data) setIdealImages(idealImagesRes.data as IdealImage[])

    // ストリーク計算
    if (allDatesRes.data) {
      const dates = allDatesRes.data.map((r: { date: string }) => r.date)
      const today = new Date().toISOString().split('T')[0]
      setStreak(calcStreak(dates, today))
    }

    // 今日のメモ記録を取得/作成
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase.from('daily_records').select('id, date, memo').eq('user_id', user.id).eq('date', today).single()
    if (existing) {
      setTodayRecord(existing as DailyRecord)
      setMemo(existing.memo ?? '')
    } else {
      const { data: newRec } = await supabase.from('daily_records').insert({
        user_id: user.id,
        date: today,
        food_count: 0,
        supplies_count: 0,
        closet_count: 0,
        total_count: 0,
      }).select('id, date, memo').single()
      if (newRec) setTodayRecord(newRec as DailyRecord)
    }

    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadAll() }, [loadAll])

  async function saveMemo() {
    if (!todayRecord) return
    await supabase.from('daily_records').update({ memo: memo || null }).eq('id', todayRecord.id)
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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (idealImages.length >= 6) return

    setUploadingImage(true)
    const timestamp = Date.now()
    const path = `${userId}/${timestamp}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('ideal-room')
      .upload(path, file, { upsert: false })

    if (!uploadError) {
      const { data: newImg } = await supabase
        .from('ideal_room_images')
        .insert({ user_id: userId, image_path: path })
        .select('id, image_path')
        .single()
      if (newImg) setIdealImages(prev => [...prev, newImg as IdealImage])
    }

    setUploadingImage(false)
    // reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function deleteIdealImage(id: string, imagePath: string) {
    await supabase.storage.from('ideal-room').remove([imagePath])
    await supabase.from('ideal_room_images').delete().eq('id', id)
    setIdealImages(prev => prev.filter(img => img.id !== id))
  }

  function getImageUrl(path: string): string {
    return supabase.storage.from('ideal-room').getPublicUrl(path).data.publicUrl
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
          {streak >= 2 && (
            <p className="text-xs text-[#8b7355] font-medium mt-0.5">{streak}日連続記録中</p>
          )}
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
          <div className="flex items-center gap-2">
            {isDiscardComplete && (
              <span className="text-xs text-[#4a6741] bg-[#d4e8c2] px-2 py-0.5 rounded-full font-medium">達成！</span>
            )}
            {discardTotal > 0 && (
              <button onClick={() => router.push('/discard')} className="text-xs text-[#8b7355]">
                すべて見る →
              </button>
            )}
          </div>
        </div>

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

        <div className="h-2.5 bg-[#f0ebe5] rounded-full mb-4">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{
              width: `${discardProgress * 100}%`,
              backgroundColor: isDiscardComplete ? '#6aaa7e' : '#8b7355',
            }}
          />
        </div>

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

        {discardItems.length > 0 ? (
          <div>
            <p className="text-[10px] text-[#9c8f87] mb-2">最近手放したもの</p>
            <div className="space-y-1.5">
              {discardItems.map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="text-xs text-[#3d3530] truncate flex-1">・{item.name}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] text-[#b8b0a8]">{relativeDate(item.created_at)}</span>
                    <button onClick={() => deleteDiscardItem(item.id)} className="text-[#d0c8c0] hover:text-[#9c8f87] text-sm leading-none">×</button>
                  </div>
                </div>
              ))}
            </div>
            {discardTotal > 5 && (
              <p className="text-[10px] text-[#b8b0a8] mt-2">他 {discardTotal - 5} 件</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#b8b0a8] text-center py-2">手放したモノを記録しましょう</p>
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

      {/* 理想の部屋、理想の暮らし */}
      <div className="bg-white rounded-3xl p-5 shadow-sm mb-3">
        <p className="text-xs font-medium text-[#6b5f58] mb-3">理想の部屋、理想の暮らし</p>
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="どんな部屋で、どんな暮らしがしたいですか？"
          rows={4}
          className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0] resize-none"
        />
        <button
          onClick={saveMemo}
          className="mt-2 w-full py-2.5 rounded-2xl bg-[#f0ebe5] text-[#6b5f58] text-xs font-medium"
        >
          保存
        </button>

        {/* 理想の部屋 画像エリア */}
        <div className="mt-4">
          <p className="text-[10px] text-[#9c8f87] mb-2">イメージ画像</p>
          <div className="grid grid-cols-3 gap-2">
            {idealImages.map(img => (
              <div key={img.id} className="relative aspect-square rounded-2xl overflow-hidden bg-[#f0ebe5]">
                <img
                  src={getImageUrl(img.image_path)}
                  alt="理想の部屋"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => deleteIdealImage(img.id, img.image_path)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/40 text-white text-xs flex items-center justify-center leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            {idealImages.length < 6 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="aspect-square rounded-2xl border-2 border-dashed border-[#d0c8c0] flex flex-col items-center justify-center gap-1 text-[#b8b0a8] hover:border-[#b8a99a] hover:text-[#9c8f87] transition-colors disabled:opacity-40"
              >
                {uploadingImage ? (
                  <span className="text-[10px]">追加中...</span>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="text-[10px]">追加</span>
                  </>
                )}
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
