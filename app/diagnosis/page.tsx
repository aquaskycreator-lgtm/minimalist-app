'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { QUESTIONS, calcDeviation, calcAxisScores } from '@/lib/diagnosis'
import BottomNav from '@/components/BottomNav'

export default function DiagnosisPage() {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const q = QUESTIONS[current]
  const options = q.answers
  const progress = Math.round((current / QUESTIONS.length) * 100)

  async function handleAnswer(value: number) {
    const newAnswers = { ...answers, [q.id]: value }
    setAnswers(newAnswers)

    if (current < QUESTIONS.length - 1) {
      setCurrent(current + 1)
    } else {
      // 診断完了
      setLoading(true)
      const totalScore = Object.values(newAnswers).reduce((s, v) => s + v, 0)
      const deviation = calcDeviation(totalScore)
      const axisScores = calcAxisScores(newAnswers)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('diagnosis_results').insert({
          user_id: user.id,
          scores: axisScores,
          deviation,
        })
      }

      router.push(`/diagnosis/result?deviation=${deviation}&scores=${encodeURIComponent(JSON.stringify(axisScores))}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <p className="text-sm text-[#9c8f87]">診断中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#faf9f7] flex flex-col max-w-md mx-auto px-6 pb-20">
      {/* ヘッダー */}
      <div className="pt-12 pb-6">
        <p className="text-xs text-[#9c8f87] mb-1">片付け偏差値診断</p>
        <h1 className="text-lg font-medium text-[#3d3530]">1分でわかる<br/>あなたの整い度</h1>
      </div>

      {/* プログレスバー */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-[#9c8f87] mb-2">
          <span>Q{current + 1} / {QUESTIONS.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-[#e8e0d8] rounded-full">
          <div
            className="h-1.5 bg-[#8b7355] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 質問 */}
      <div className="flex-1">
        <div className="bg-white rounded-3xl p-6 shadow-sm mb-6">
          <p className="text-[#3d3530] text-base leading-relaxed font-medium">
            {q.text}
          </p>
        </div>

        {/* 選択肢 */}
        <div className="space-y-3">
          {options.map(option => (
            <button
              key={option.label}
              onClick={() => handleAnswer(option.value)}
              className="w-full bg-white rounded-2xl px-5 py-4 text-left text-sm text-[#3d3530] shadow-sm hover:bg-[#f5f0eb] active:bg-[#ede5db] transition-colors border border-[#f0ebe5]"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 戻るボタン */}
      {current > 0 && (
        <button
          onClick={() => setCurrent(current - 1)}
          className="py-4 text-xs text-[#9c8f87] text-center"
        >
          ← 前の質問に戻る
        </button>
      )}

      <BottomNav />
    </div>
  )
}
