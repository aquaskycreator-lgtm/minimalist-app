'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { CLOSET_CATEGORIES, SEASONS, ClosetCategory, Season } from '@/lib/types'

type Props = {
  onClose: () => void
  onAdded: () => void
}

const CATEGORY_KEYWORDS: Record<ClosetCategory, string[]> = {
  'トップス':      ['Tシャツ', 'シャツ', 'ブラウス', 'ニット', 'セーター', 'カーディガン', 'タンクトップ', 'カットソー'],
  'ボトムス':      ['パンツ', 'ズボン', 'スカート', 'デニム', 'ジーンズ', 'レギンス', 'ショートパンツ'],
  'アウター':      ['コート', 'ジャケット', 'ダウン', 'パーカー', 'ブルゾン', 'トレンチ', 'アウター'],
  'インナー・下着': ['インナー', '下着', 'ブラ', 'ショーツ', 'ソックス', '靴下', 'タイツ', 'ヒートテック'],
  '靴・バッグ':    ['靴', 'スニーカー', 'パンプス', 'ブーツ', 'サンダル', 'バッグ', 'カバン', 'リュック', '財布'],
  'その他':        [],
}

const SEASON_KEYWORDS: Record<Season, string[]> = {
  '春夏':          ['春', '夏', '春夏', '半袖', '薄手'],
  '秋冬':          ['秋', '冬', '秋冬', '長袖', '厚手', '暖かい'],
  'オールシーズン': ['オールシーズン', '通年', '年中'],
}

function detectCategory(name: string): ClosetCategory {
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => name.includes(k))) return cat as ClosetCategory
  }
  return 'その他'
}

function detectSeason(text: string): Season | '' {
  for (const [season, keywords] of Object.entries(SEASON_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return season as Season
  }
  return ''
}

const COLOR_KEYWORDS = ['白', '黒', 'ネイビー', 'グレー', 'ベージュ', 'ブラウン', '赤', 'ピンク', '青', '緑', '黄', '紺', 'オフホワイト', 'カーキ']

function detectColor(text: string): string {
  return COLOR_KEYWORDS.find(c => text.includes(c)) ?? ''
}

function extractName(text: string): string {
  return text
    .replace(new RegExp(COLOR_KEYWORDS.join('|'), 'g'), '')
    .replace(/春夏|秋冬|オールシーズン|通年|年中|春|夏|秋|冬|半袖|長袖|薄手|厚手|暖かい|[、。,.\s]+/g, '')
    .trim()
}

export default function AddClosetModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ClosetCategory>('その他')
  const [color, setColor] = useState('')
  const [season, setSeason] = useState<Season | ''>('')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [recentItems, setRecentItems] = useState<{name: string, category: ClosetCategory}[]>([])
  const recognitionRef = useRef<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRecent() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('closet_items')
        .select('name, category')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8)
      if (data) {
        const unique = data.filter((item, idx, arr) =>
          arr.findIndex(i => i.name === item.name) === idx
        )
        setRecentItems(unique.slice(0, 5) as {name: string, category: ClosetCategory}[])
      }
    }
    fetchRecent()
  }, [supabase])

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
      setCategory(detectCategory(text))
      setColor(detectColor(text))
      setSeason(detectSeason(text))
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

    await supabase.from('closet_items').insert({
      user_id: user.id,
      name: name.trim(),
      category,
      color: color.trim() || null,
      season: season || null,
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
          <h2 className="text-base font-medium text-[#3d3530]">アパレルを追加</h2>
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
            <p className="text-xs text-[#b8b0a8] mt-1.5 px-2">例：「白Tシャツ、春夏」と話してください</p>
          )}
        </div>

        {/* クイック追加 */}
        {recentItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-[#9c8f87] mb-2">最近追加した洋服</p>
            <div className="flex flex-wrap gap-2">
              {recentItems.map(item => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => { setName(item.name); setCategory(item.category) }}
                  className="px-3 py-1.5 rounded-full text-xs bg-[#f0ebe5] text-[#6b5f58] hover:bg-[#e8e0d8] transition-colors"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">アイテム名 *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="例：白Tシャツ、デニムパンツ"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#6b5f58] mb-1">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {CLOSET_CATEGORIES.map(cat => (
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
            <label className="block text-xs text-[#6b5f58] mb-1">色（任意）</label>
            <input
              type="text"
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="例：白、ネイビー、ベージュ"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] text-sm text-[#3d3530] focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#6b5f58] mb-2">季節（任意）</label>
            <div className="flex gap-2">
              {SEASONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(season === s ? '' : s)}
                  className={`flex-1 py-2 rounded-2xl text-xs font-medium transition-all ${
                    season === s ? 'bg-[#8b7355] text-white' : 'bg-[#f0ebe5] text-[#6b5f58]'
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
              placeholder="例：お気に入り、くたびれてきた"
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
