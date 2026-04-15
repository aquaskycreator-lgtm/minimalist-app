'use client'

import { usePathname, useRouter } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const items = [
    { href: '/top',      label: 'トップ',  icon: '🏠' },
    { href: '/fridge',   label: '食料品',  icon: '🥗' },
    { href: '/supplies', label: '日用品',  icon: '🧴' },
    { href: '/closet',   label: 'アパレル', icon: '👗' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#f0ebe5] z-40">
      <div className="max-w-md mx-auto flex">
        {items.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
                active ? 'text-[#8b7355]' : 'text-[#b8b0a8]'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
