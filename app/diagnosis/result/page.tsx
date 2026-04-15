'use client'

export const dynamic = 'force-dynamic'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import RadarChart from '@/components/RadarChart'
import { getTypeName, getTodayAction } from '@/lib/diagnosis'
import type { AxisKey } from '@/lib/diagnosis'

function ResultContent() {
  const params = useSearchParams()
  const router = useRouter()

  const deviation = parseInt(params.get('deviation') ?? '50')
  const scoresRaw = params.get('scores') ?? '{}'
  const axisScores: Record<AxisKey, number> = JSON.parse(decodeURIComponent(scoresRaw))

  const typeName = getTypeName(deviation)
  const todayAction = getTodayAction(axisScores)

  // 偏差値バーの色
  const barColor = deviation >= 70 ? '#6aaa7e' : deviation >= 60 ? '#8b7355' : deviation >= 50 ? '#b8a040' : '#c47a5a'

  // 強み・課題
  const sorted = Object.entries(axisScores).sort((a, b) => b[1] - a[1])
  const strengths = sorted.slice(0, 2).map(([k]) => k)
  const weaknesses = sorted.slice(-2).map(([k]) => k)

  const strengthMessages: Record<string, string> = {
    '持ち物量': 'モノの量を意識できている',
    '定位置': '定位置の意識が高い',
    '動線': '使いやすい配置ができている',
    '維持力': '日々のリセットができている',
    '在庫管理': '在庫の把握ができている',
  }

  const weaknessMessages: Record<string, string> = {
    '持ち物量': 'モノの総量が少し多め',
    '定位置': '定位置の仕組みが弱い',
    '動線': '戻しにくい配置がある',
    '維持力': 'リセットの習慣が育ち中',
    '在庫管理': '在庫の見える化が課題',
  }

  return (
    <div className="min-h-screen w-full bg-[#faf9f7] max-w-md mx-auto px-6 pb-24">
      <div className="pt-12 pb-6 text-center">
        <p className="text-xs text-[#9c8f87] mb-1">診断結果</p>
        <h1 className="text-lg font-medium text-[#3d3530]">あなたの片付け偏差値</h1>
      </div>

      {/* 偏差値 */}
      <div className="bg-white rounded-3xl p-8 shadow-sm mb-4 text-center">
        <div className="text-6xl font-bold mb-1" style={{ color: barColor }}>
          {deviation}
        </div>
        <div className="text-sm text-[#9c8f87] mb-4">{typeName}</div>

        {/* バー */}
        <div className="h-3 bg-[#f0ebe5] rounded-full mb-2">
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{ width: `${((deviation - 30) / 50) * 100}%`, backgroundColor: barColor }}
          />
        </div>
        <div className="flex justify-between text-xs text-[#c5b8b0]">
          <span>30</span>
          <span>50</span>
          <span>80</span>
        </div>
      </div>

      {/* レーダーチャート */}
      <div className="bg-white rounded-3xl p-6 shadow-sm mb-4">
        <p className="text-xs font-medium text-[#6b5f58] mb-4 text-center">5つの軸</p>
        <RadarChart scores={axisScores} />
        <div className="grid grid-cols-5 gap-1 mt-4">
          {Object.entries(axisScores).map(([axis, score]) => (
            <div key={axis} className="text-center">
              <div className="text-xs font-medium text-[#3d3530]">{score}</div>
              <div className="text-[9px] text-[#9c8f87]">{axis}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 強み・課題 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#f0f7ed] rounded-2xl p-4">
          <p className="text-xs font-medium text-[#4a6741] mb-2">今の強み</p>
          {strengths.map(s => (
            <p key={s} className="text-xs text-[#4a6741] mb-1">・{strengthMessages[s]}</p>
          ))}
        </div>
        <div className="bg-[#fdf5f0] rounded-2xl p-4">
          <p className="text-xs font-medium text-[#8b5e3c] mb-2">今の課題</p>
          {weaknesses.map(w => (
            <p key={w} className="text-xs text-[#8b5e3c] mb-1">・{weaknessMessages[w]}</p>
          ))}
        </div>
      </div>

      {/* 今日のアクション */}
      <div className="bg-[#faf3e8] rounded-2xl p-5 mb-6 border border-[#e8d8b8]">
        <p className="text-xs font-medium text-[#8b7355] mb-2">今日のおすすめアクション</p>
        <p className="text-sm text-[#3d3530] leading-relaxed">{todayAction}</p>
      </div>

      {/* ボタン */}
      <div className="space-y-3">
        <button
          onClick={() => router.push('/fridge')}
          className="w-full py-3 rounded-2xl bg-[#8b7355] text-white text-sm font-medium"
        >
          冷蔵庫管理に戻る
        </button>
        <button
          onClick={() => router.push('/diagnosis')}
          className="w-full py-3 rounded-2xl bg-[#f0ebe5] text-[#6b5f58] text-sm"
        >
          もう一度診断する
        </button>
      </div>
    </div>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-sm text-[#9c8f87]">読み込み中...</p></div>}>
      <ResultContent />
    </Suspense>
  )
}
