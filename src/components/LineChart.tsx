import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './LineChart.module.css'

export interface ChartPoint {
  /** YYYY-MM-DD */
  date: string
  value: number
}

/** 깔끔한 눈금 간격 (1, 2, 2.5, 5 × 10^n) */
function niceStep(range: number, target: number): number {
  const raw = range / Math.max(1, target)
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (raw <= m * mag) return m * mag
  }
  return 10 * mag
}

function compact(n: number): string {
  if (Math.abs(n) >= 10000) return `${Math.round(n / 1000)}K`
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

const H = 188
const PAD = { top: 18, right: 44, bottom: 26, left: 40 }

/**
 * 단일 시리즈 꺾은선 — 2px 선, 10% 면 워시, 표면색 링이 있는 점,
 * 마지막 값만 직접 라벨, 크로스헤어 + 툴팁(포인터/키보드).
 */
export function LineChart({
  points,
  unit,
  label,
}: {
  points: ChartPoint[]
  unit: string
  /** 접근성 이름 (예: "벤치프레스 추정 1RM 추이") */
  label: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const geo = useMemo(() => {
    const innerW = width - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const vals = points.map((p) => p.value)
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    if (lo === hi) {
      lo -= Math.max(1, Math.abs(lo) * 0.1)
      hi += Math.max(1, Math.abs(hi) * 0.1)
    }
    const step = niceStep(hi - lo, 3)
    const yMin = Math.floor(lo / step) * step
    const yMax = Math.ceil(hi / step) * step
    const ticks: number[] = []
    for (let v = yMin; v <= yMax + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)

    const times = points.map((p) => Date.parse(p.date + 'T00:00:00'))
    const tMin = Math.min(...times)
    const tMax = Math.max(...times)
    const byIndex = tMax === tMin
    const x = (i: number) =>
      PAD.left +
      (points.length === 1
        ? innerW / 2
        : byIndex
          ? (i / (points.length - 1)) * innerW
          : ((times[i] - tMin) / (tMax - tMin)) * innerW)
    const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH

    const xy = points.map((p, i) => [x(i), y(p.value)] as const)
    const line = xy.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('')
    const area =
      xy.length > 1
        ? `${line}L${xy[xy.length - 1][0].toFixed(1)},${PAD.top + innerH}L${xy[0][0].toFixed(1)},${PAD.top + innerH}Z`
        : ''
    return { innerW, innerH, ticks, y, xy, line, area }
  }, [points, width])

  const last = points.length - 1
  const shown = active ?? null

  const nearest = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return null
    const px = clientX - rect.left
    let best = 0
    let bestD = Infinity
    geo.xy.forEach(([x], i) => {
      const d = Math.abs(x - px)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    return best
  }

  const fmtDate = (iso: string) => iso.slice(5).replace('-', '.')
  const tip = shown != null ? points[shown] : null
  const tipX = shown != null ? geo.xy[shown][0] : 0

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      tabIndex={0}
      role="img"
      aria-label={`${label}. ${points.length}회 기록, 최근 ${points[last].value}${unit}`}
      onPointerDown={(e) => setActive(nearest(e.clientX))}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse' || e.buttons) setActive(nearest(e.clientX))
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setActive(null)
      }}
      onBlur={() => setActive(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? last + 1) - 1))
        else if (e.key === 'ArrowRight') setActive((a) => Math.min(last, (a ?? -1) + 1))
        else if (e.key === 'Escape') setActive(null)
        else return
        e.preventDefault()
      }}
    >
      <svg width={width} height={H} className={styles.svg} aria-hidden>
        {/* 가로 그리드 + y 눈금 */}
        {geo.ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + geo.innerW}
              y1={geo.y(t)}
              y2={geo.y(t)}
              className={styles.grid}
            />
            <text x={PAD.left - 8} y={geo.y(t)} className={styles.tick} textAnchor="end" dy="0.32em">
              {compact(t)}
            </text>
          </g>
        ))}

        {/* x 라벨: 처음/마지막만 */}
        <text x={geo.xy[0][0]} y={H - 6} className={styles.tick} textAnchor={last ? 'start' : 'middle'}>
          {fmtDate(points[0].date)}
        </text>
        {last > 0 && (
          <text x={geo.xy[last][0]} y={H - 6} className={styles.tick} textAnchor="end">
            {fmtDate(points[last].date)}
          </text>
        )}

        {geo.area && <path d={geo.area} className={styles.area} />}
        {last > 0 && <path d={geo.line} className={styles.line} />}

        {/* 크로스헤어 */}
        {shown != null && (
          <line
            x1={tipX}
            x2={tipX}
            y1={PAD.top - 6}
            y2={PAD.top + geo.innerH}
            className={styles.crosshair}
          />
        )}

        {geo.xy.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === shown ? 6 : i === last || points.length <= 12 ? 4 : 0}
            className={styles.dot}
          />
        ))}

        {/* 마지막 값만 직접 라벨 */}
        <text
          x={geo.xy[last][0] + 8}
          y={geo.xy[last][1]}
          className={styles.endLabel}
          dy="0.32em"
        >
          {compact(points[last].value)}
        </text>
      </svg>

      {tip && (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(Math.max(tipX, 56), width - 56),
          }}
        >
          <strong className={styles.tipValue}>
            {tip.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            <span className={styles.tipUnit}>{unit}</span>
          </strong>
          <span className={styles.tipDate}>
            <span className={styles.tipKey} aria-hidden />
            {fmtDate(tip.date)}
          </span>
        </div>
      )}
    </div>
  )
}
