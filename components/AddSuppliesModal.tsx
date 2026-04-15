'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { SUPPLY_CATEGORIES, SUPPLY_STATUSES, SupplyCategory, SupplyStatus } from '@/lib/types'

type Props = {
  onClose: () => void
  onAdded: () => void
}

const STATUS_COLORS: Record<SupplyStatus, string> = {
  '在庫あり':   'bg-[#d4e8c2] text-[#4a6741]',
  '残り少ない': 'bg-[#f5ecd0] text-[#7a6130]',
  '切れた':     'bg-[#f5d5c8] text-[#7a3f30]',
}

const CATEGORY_KEYWORDS: Record<SupplyCategory, string[]> = {
  'トイレ用品':       ['トイレ', 'トイレットペーパー', 'トイレシート', 'トイレ用'],
  '洗濯・洗剤':       ['洗剤', '柔軟剤', '洗濯', '漂白剤', '洗濯洗剤'],
  'バス・シャンプー':  ['シャンプー', 'コンディショナー', 'リンス', 'ボディソープ', 'バスソープ', '石鹸', '石けん'],
  'スキンケア':        ['化粧水', '乳液', 'クリーム', '日焼け止め', '洗顔', 'スキンケア', 'ファンデ', '美容'],
  '薬・衛生用品':      ['薬', '絆創膏', 'マスク', '消毒', '綿棒', '体温計', '薬局'],
  'その他':            [],
}

function detectCategory(name: string): SupplyCategory {
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => name.includes(k))) return cat as SupplyCategory
  }
  return 'その他'
}

function extractQuantity(text: string): string {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(個|本|袋|パック|枚|箱|缶|瓶|束|ロール|セット|g|kg|ml|L)/)
  if (match) return `${match[1]}${match[2]}`
  return '1個'
}

function detectStatus(text: string): SupplyStatus {
  if (text.includes('切れた') || text.includes('なくなった') || text.includes('切れ')) return '切れた'
  if (text.includes('残り少') || text.includes('少ない') || text.includes('もうすぐ')) return '残り少ない'
  return '在庫あり'
}

function extractName(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*(個|本|袋|パック|枚|箱|缶|瓶|束|ロール|セット|g|kg|ml|L)/g, '')
    .replace(/切れた|なくなった|切れ|残り少|少ない|もうすぐ|在庫あり|[、。,.\s]+/g, '')
    .trim()
}

export default function AddSuppliesModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<SupplyCategory>('その他')
  const [quantity, setQuantity] = useState('1個')
  const [status, setStatus] = useState<SupplyStatus>('在庫あり')
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
    recognition.onend   = () => setListening(false)
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript
      setTranscript(text)
      const detectedName = extractName(text)
      if (detectedName) setName(detectedName)
      setQuantity(extractQuantity(text))
      setStatus(detectStatus(text))
      setCategory(detectCategory(detectedName))
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

    await supabase.from('supplies').insert({
      user_id: user.id,
      name: name.trim(),
      category,
      quantity,
      status,
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
          <h2 className="text-base font-medium text-[#3d3530]">日用品を追加</h2>
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
          {transcript ? (
            <p className="text-xs text-[#9c8f87] mt-2 px-2">認識: 「{transcript}」</p>
          ) : (
            <p className="text-xs text-[#b8b0a8] mt-1.5 px-2">例：「シャンプー2本、残り少ない」と話してください</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">アイテム名 *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="例：シャンプー、トイレットペーパー"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {SUPPLY_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                    category === cat ? 'bg-[#8b7355] text-white' : 'bg-[#f0ebe5] text-[#6b5f58]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">数量</label>
            <input
              type="text"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="例：2本、1袋"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#6b5f58] mb-2">在庫状況</label>
            <div className="flex gap-2">
              {SUPPLY_STATUSES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-2xl text-xs font-medium transition-all ${
                    status === s ? STATUS_COLORS[s] : 'bg-[#f0ebe5] text-[#9c8f87]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">メモ（任意）</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="例：詰め替えタイプ"
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
