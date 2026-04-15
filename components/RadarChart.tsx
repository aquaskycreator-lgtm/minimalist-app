'use client'

type Props = {
  scores: Record<string, number>
}

const AXES = ['持ち物量', '定位置', '動線', '維持力', '在庫管理']
const SIZE = 200
const CENTER = SIZE / 2
const RADIUS = 75

function polarToCartesian(angle: number, r: number) {
  const rad = (angle - 90) * (Math.PI / 180)
  return {
    x: CENTER + r * Math.cos(rad),
    y: CENTER + r * Math.sin(rad),
  }
}

export default function RadarChart({ scores }: Props) {
  const angleStep = 360 / AXES.length

  const points = AXES.map((axis, i) => {
    const score = scores[axis] ?? 0
    const r = (score / 100) * RADIUS
    return polarToCartesian(i * angleStep, r)
  })

  const gridPoints = (ratio: number) =>
    AXES.map((_, i) => polarToCartesian(i * angleStep, RADIUS * ratio))

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[240px] mx-auto">
      {/* グリッド */}
      {[0.25, 0.5, 0.75, 1].map(r => (
        <polygon
          key={r}
          points={gridPoints(r).map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#e8e0d8"
          strokeWidth="1"
        />
      ))}

      {/* 軸線 */}
      {AXES.map((_, i) => {
        const end = polarToCartesian(i * angleStep, RADIUS)
        return (
          <line
            key={i}
            x1={CENTER} y1={CENTER}
            x2={end.x} y2={end.y}
            stroke="#e8e0d8"
            strokeWidth="1"
          />
        )
      })}

      {/* データ面 */}
      <polygon
        points={points.map(p => `${p.x},${p.y}`).join(' ')}
        fill="#8b7355"
        fillOpacity="0.25"
        stroke="#8b7355"
        strokeWidth="2"
      />

      {/* データ点 */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#8b7355" />
      ))}

      {/* ラベル */}
      {AXES.map((axis, i) => {
        const pos = polarToCartesian(i * angleStep, RADIUS + 18)
        return (
          <text
            key={i}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fill="#6b5f58"
          >
            {axis}
          </text>
        )
      })}
    </svg>
  )
}
