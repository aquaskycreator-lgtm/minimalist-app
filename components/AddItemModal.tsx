'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { CATEGORIES, Category } from '@/lib/types'

type Props = {
  onClose: () => void
  onAdded: () => void
}

// カテゴリ自動判定
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  '野菜・果物': ['キャベツ','レタス','にんじん','大根','玉ねぎ','ねぎ','ほうれん草','小松菜','トマト','きゅうり','なす','ピーマン','ブロッコリー','じゃがいも','さつまいも','りんご','バナナ','みかん','いちご','もやし','豆腐','納豆'],
  '肉・魚': ['鶏肉','豚肉','牛肉','ひき肉','鮭','さば','まぐろ','えび','いか','あじ','ぶり','豚','鶏','牛','魚','肉','ソーセージ','ベーコン','ハム'],
  '乳製品・卵': ['牛乳','ヨーグルト','チーズ','バター','卵','たまご','生クリーム','豆乳'],
  '飲み物': ['ジュース','お茶','麦茶','コーヒー','ビール','ワイン','水','炭酸','コーラ','ポカリ'],
  '調味料': ['醤油','みそ','塩','砂糖','酢','マヨネーズ','ケチャップ','ソース','みりん','酒','油','ごま油','ドレッシング'],
  'その他': [],
}

function detectCategory(name: string): Category {
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => name.includes(k))) return cat as Category
  }
  return 'その他'
}

// 音声テキストから数量を抽出
function extractQuantity(text: string): string {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(個|本|袋|パック|枚|切れ|尾|匹|缶|瓶|箱|束|房|玉|丁|g|kg|ml|L|リットル|グラム)/)
  if (match) return `${match[1]}${match[2]}`
  if (text.includes('半分') || text.includes('半')) return '半分'
  if (text.includes('少し') || text.includes('少々')) return '少々'
  return '1個'
}

// 音声テキストから賞味期限を抽出
function extractExpiryDate(text: string): string {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  if (text.includes('今日') || text.includes('本日')) return fmt(today)
  if (text.includes('明日')) { today.setDate(today.getDate() + 1); return fmt(today) }
  if (text.includes('明後日')) { today.setDate(today.getDate() + 2); return fmt(today) }
  if (text.includes('今週')) { today.setDate(today.getDate() + 5); return fmt(today) }
  if (text.includes('来週')) { today.setDate(today.getDate() + 7); return fmt(today) }

  const daysMatch = text.match(/(\d+)\s*日(後|以内)/)
  if (daysMatch) { today.setDate(today.getDate() + parseInt(daysMatch[1])); return fmt(today) }

  const dateMatch = text.match(/(\d+)\s*月\s*(\d+)\s*日/)
  if (dateMatch) {
    const month = parseInt(dateMatch[1]) - 1
    const day = parseInt(dateMatch[2])
    const year = today.getMonth() > month ? today.getFullYear() + 1 : today.getFullYear()
    return fmt(new Date(year, month, day))
  }

  return ''
}

// 音声テキストから食材名を抽出（数量・期限ワードを除去）
function extractName(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*(個|本|袋|パック|枚|切れ|尾|匹|缶|瓶|箱|束|房|玉|丁|g|kg|ml|L)/g, '')
    .replace(/今日|明日|明後日|今週|来週|賞味期限|期限|\d+日後|\d+月\d+日|半分|少々|少し/g, '')
    .replace(/[、。,.\s]+/g, '')
    .trim()
}

export default function AddItemModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('その他')
  const [quantity, setQuantity] = useState('1個')
  const [expiryDate, setExpiryDate] = useState('')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)
  const supabase = createClient()

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
    recognition.onend = () => setListening(false)

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript
      setTranscript(text)

      const detectedName = extractName(text)
      const detectedQty = extractQuantity(text)
      const detectedExpiry = extractExpiryDate(text)
      const detectedCategory = detectCategory(detectedName)

      if (detectedName) setName(detectedName)
      if (detectedQty) setQuantity(detectedQty)
      if (detectedExpiry) setExpiryDate(detectedExpiry)
      setCategory(detectedCategory)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('fridge_items').insert({
      user_id: user.id,
      name: name.trim(),
      category,
      quantity,
      expiry_date: expiryDate || null,
      memo: memo.trim() || null,
    })

    setLoading(false)
    onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-medium text-[#3d3530]">食材を追加</h2>
          <button onClick={onClose} className="text-[#9c8f87] text-lg leading-none">×</button>
        </div>

        {/* 音声入力ボタン */}
        <div className="mb-5">
          <button
            type="button"
            onClick={listening ? stopVoice : startVoice}
            className={`w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              listening
                ? 'bg-red-50 text-red-400 border-2 border-red-200 animate-pulse'
                : 'bg-[#f0ebe5] text-[#6b5f58] hover:bg-[#e8e0d8]'
            }`}
          >
            <span className="text-base">{listening ? '🎙️' : '🎤'}</span>
            {listening ? '聞いています... タップで停止' : '音声で入力する'}
          </button>
          {transcript && (
            <p className="text-xs text-[#9c8f87] mt-2 px-2">
              認識: 「{transcript}」
            </p>
          )}
          {!transcript && (
            <p className="text-xs text-[#b8b0a8] mt-1.5 px-2">
              例：「キャベツ1個、賞味期限今週」と話してください
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 食材名 */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">食材名 *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="例：キャベツ"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          {/* カテゴリ */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                    category === cat
                      ? 'bg-[#8b7355] text-white'
                      : 'bg-[#f0ebe5] text-[#6b5f58]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 数量 */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">数量</label>
            <input
              type="text"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="例：1個、200g、半分"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          {/* 賞味期限 */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">賞味期限（任意）</label>
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a]"
            />
          </div>

          {/* メモ */}
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">メモ（任意）</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="例：開封済み"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 rounded-2xl bg-[#8b7355] text-white text-sm font-medium hover:bg-[#7a6347] transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? '追加中...' : '追加する'}
          </button>
        </form>
      </div>
    </div>
  )
}
