'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('確認メールを送信しました。メールをご確認ください。')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage('メールアドレスまたはパスワードが正しくありません')
      } else {
        router.push('/fridge')
        router.refresh()
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">🌿</div>
          <h1 className="text-xl font-medium text-[#3d3530] tracking-wide">
            ミニマリスト＆片付けアプリ
          </h1>
          <p className="text-sm text-[#9c8f87] mt-1">シンプルな暮らしのための在庫管理</p>
        </div>

        {/* タブ */}
        <div className="flex bg-[#f0ebe5] rounded-2xl p-1 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-white text-[#3d3530] shadow-sm font-medium'
                : 'text-[#9c8f87]'
            }`}
          >
            ログイン
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-sm rounded-xl transition-all ${
              mode === 'signup'
                ? 'bg-white text-[#3d3530] shadow-sm font-medium'
                : 'text-[#9c8f87]'
            }`}
          >
            新規登録
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#6b5f58] mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@email.com"
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] bg-white text-[#3d3530] text-sm focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>
          <div>
            <label className="block text-sm text-[#6b5f58] mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="6文字以上"
              minLength={6}
              className="w-full px-4 py-3 rounded-2xl border border-[#e8e0d8] bg-white text-[#3d3530] text-sm focus:outline-none focus:ring-2 focus:ring-[#b8a99a] placeholder-[#c5b8b0]"
            />
          </div>

          {message && (
            <p className="text-sm text-[#9c8f87] text-center bg-[#f5f0eb] rounded-xl px-4 py-3">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-[#8b7355] text-white text-sm font-medium tracking-wide hover:bg-[#7a6347] transition-colors disabled:opacity-50"
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : '登録する'}
          </button>
        </form>
      </div>
    </div>
  )
}
