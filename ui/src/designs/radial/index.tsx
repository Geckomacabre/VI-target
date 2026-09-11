import {
  EASE, amp, clampLines, disabledStyle, duration, gate, gatedLabel, intensity, labelLines, labelType,
  readBool, readNumber, readString, showsLock,
  CursorShape, IndicatorShape, LockGlyph, OptionIcon,
  registerDesign, useEffect, useRef, useState,
} from '@host'
import type {
  CursorShapeName, CursorViewProps, DesignModule, DisabledStyle,
  IndicatorShapeName, IndicatorViewProps, MenuViewProps, TargetOption,
} from '@host'

const BASE_ANGLE: Record<string, number> = { right: 0, left: 180, up: -90 }

/* Distance from anchor point to the near edge of the label plate. */
const PLATE_GAP = 78

// Calculate usable texture horizontal bounds based on arc open side.
const ROOM = 1024 * 0.84 - 16

function Menu({ options, focus, rejectToken, phase, emptyLabel, tunables, reducedMotion, openMs: rawOpenMs }: MenuViewProps) {
  const openMs = gate(rawOpenMs, tunables, reducedMotion)
  const span = readNumber(tunables, 'arcSpan', 168)
  const radius = readNumber(tunables, 'arcRadius', 210)
  const side = readString(tunables, 'arcSide', 'right')
  const neighbours = readNumber(tunables, 'neighbours', 3)
  const spokes = readBool(tunables, 'spokes', true)
  const hubRing = readBool(tunables, 'hubRing', true)
  const plateWidth = readNumber(tunables, 'plateWidth', 440)

  const base = BASE_ANGLE[side] ?? 0
  const slots = Math.max(1, neighbours * 2 + 1)
  const step = span / slots
  const move = duration(170, tunables, reducedMotion)
  const shake = useShake(rejectToken, reducedMotion)
  const gated = disabledStyle(tunables)

  // Motion contraction parameter: scales entrance and exit transforms.
  const contract = amp(0.05, tunables, reducedMotion)

  const focused = options[focus - 1]
  const opening = phase === 'opening'
  const closing = phase === 'closing'

  return (
    <div
      className="world-anchor"
      style={{
        transition: `opacity ${openMs}ms ${EASE}, transform ${openMs}ms ${EASE}`,
        opacity: closing ? 0 : 1,
        transform: `scale(var(--t-scale)) scale(${closing ? 1 - contract * 1.2 : opening ? 1 - contract : 1})`,
      }}
    >
      {/* World hub anchor and orientation tick */}
      {hubRing && (
        <svg width="240" height="240" style={{ position: 'absolute', left: -120, top: -120, overflow: 'visible' }}>
          <circle cx="120" cy="120" r="38" fill="none" stroke="var(--t-outline-strong)" strokeWidth="3" />
          <circle cx="120" cy="120" r="8" fill="var(--t-accent)" />
          <line
            x1={120 + Math.cos((base * Math.PI) / 180) * 46}
            y1={120 + Math.sin((base * Math.PI) / 180) * 46}
            x2={120 + Math.cos((base * Math.PI) / 180) * 74}
            y2={120 + Math.sin((base * Math.PI) / 180) * 74}
            stroke="var(--t-accent)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      )}

      {spokes && (
        <Spokes count={slots} base={base} step={step} radius={radius} />
      )}

      {options.map((option, index) => {
        const delta = index - (focus - 1)
        const visible = Math.abs(delta) <= neighbours
        const angle = ((base + delta * step) * Math.PI) / 180
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        const falloff = 1 - Math.min(Math.abs(delta) / (neighbours + 1), 1)
        const isFocus = delta === 0

        return (
          <Disc
            key={option.id}
            option={option}
            x={x}
            y={y}
            scale={isFocus ? 1 : 0.66 + falloff * 0.16}
            opacity={visible ? (isFocus ? 1 : 0.28 + falloff * 0.44) : 0}
            focused={isFocus}
            gated={gated}
            move={move}
            stagger={opening ? Math.abs(delta) * 26 * intensity(tunables, reducedMotion) : 0}
          />
        )
      })}

      <Plate
        option={focused}
        side={side}
        radius={radius}
        base={base}
        width={side === 'up' ? plateWidth : Math.max(280, Math.min(plateWidth, ROOM - radius - PLATE_GAP))}
        lines={labelLines(tunables)}
        gated={gated}
        showSubtext={readBool(tunables, 'subtext', true)}
        emptyLabel={emptyLabel}
        move={move}
        nudge={shake ? amp(12, tunables, reducedMotion) : 0}
      />
    </div>
  )
}

// Radial detent tick marks positioned along arc path.
function Spokes({ count, base, step, radius }: { count: number; base: number; step: number; radius: number }) {
  const marks = []
  const half = Math.floor(count / 2)

  for (let i = -half; i <= half; i += 1) {
    const angle = ((base + i * step) * Math.PI) / 180
    // Position tick line segments along radial radius.
    const inner = radius - 92
    const outer = radius - 70
    marks.push(
      <line
        key={i}
        x1={300 + Math.cos(angle) * inner}
        y1={300 + Math.sin(angle) * inner}
        x2={300 + Math.cos(angle) * outer}
        y2={300 + Math.sin(angle) * outer}
        stroke="var(--t-outline)"
        strokeWidth={i === 0 ? 5 : 3}
        strokeLinecap="round"
        opacity={i === 0 ? 1 : 0.6}
      />,
    )
  }

  return (
    <svg width="600" height="600" style={{ position: 'absolute', left: -300, top: -300, overflow: 'visible' }}>
      {marks}
    </svg>
  )
}

interface DiscProps {
  option: TargetOption
  x: number
  y: number
  scale: number
  opacity: number
  focused: boolean
  gated: DisabledStyle
  move: number
  stagger: number
}

function Disc({ option, x, y, scale, opacity, focused, gated, move, stagger }: DiscProps) {
  const size = 116
  const tone = option.enabled ? 'var(--t-text)' : 'var(--t-disabled)'
  // Disc active state: apply accent styling for enabled focused options.
  const live = focused && option.enabled
  const barred = !option.enabled

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        background: live ? 'var(--t-accent-soft)' : 'var(--t-surface-fill-soft)',
        backgroundImage: focused ? 'var(--t-gradient)' : undefined,
        border: `3px solid ${live ? 'var(--t-accent)' : focused ? 'var(--t-outline-strong)' : 'var(--t-outline)'}`,
        boxShadow: focused ? 'var(--t-shadow)' : 'none',
        transform: `scale(${scale})`,
        // Apply dim opacity treatment when option is ineligible.
        opacity: opacity * (barred && gated === 'dim' ? 0.55 : 1),
        transition: `transform ${move}ms ${EASE} ${stagger}ms, opacity ${move}ms ${EASE} ${stagger}ms, background ${move}ms ${EASE}, border-color ${move}ms ${EASE}`,
      }}
    >
      <OptionIcon
        name={option.icon}
        size={focused ? 56 : 44}
        weight="bold"
        color={live ? 'var(--t-accent)' : tone}
      />
      {barred && showsLock(gated) && <LockPip />}
      {barred && gated === 'strike' && <StrikeBar size={size} />}
    </div>
  )
}

// Option locked badge indicator.
function LockPip() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34"
      style={{ position: 'absolute', right: -2, bottom: -2 }}>
      <circle cx="12" cy="12" r="11" fill="var(--t-surface)" stroke="var(--t-disabled)" strokeWidth="1.5" />
      <rect x="7.5" y="11" width="9" height="7" rx="1.6" fill="var(--t-disabled)" />
      <path d="M 9.2 11 v -2 a 2.8 2.8 0 0 1 5.6 0 v 2" fill="none" stroke="var(--t-disabled)" strokeWidth="1.7" />
    </svg>
  )
}

// Strike-through treatment for option discs in strike mode.
function StrikeBar({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0 }}>
      <line
        x1={size * 0.2} y1={size * 0.8} x2={size * 0.8} y2={size * 0.2}
        stroke="var(--t-disabled)" strokeWidth="5" strokeLinecap="round"
      />
    </svg>
  )
}

interface PlateProps {
  option?: TargetOption
  side: string
  radius: number
  base: number
  width: number
  lines: number
  gated: DisabledStyle
  showSubtext: boolean
  emptyLabel: string
  move: number
  nudge: number
}

// Active option label plate layout.
function Plate({ option, side, radius, base, width, lines, gated, showSubtext, emptyLabel, move, nudge }: PlateProps) {
  const angle = (base * Math.PI) / 180
  const x = Math.cos(angle) * (radius + PLATE_GAP)
  const y = Math.sin(angle) * (radius + PLATE_GAP)

  const alignRight = side === 'left'
  const centred = side === 'up'

  const label = option?.label ?? emptyLabel
  const enabled = option?.enabled ?? false
  const detail = option && showSubtext ? (option.enabled ? option.description : option.reason) : undefined
  const barred = option !== undefined && !enabled

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(${alignRight ? '-100%' : centred ? '-50%' : '0'}, -50%) translateX(${nudge}px)`,
        transition: `transform ${nudge ? 70 : move}ms ${EASE}`,
        width,
        maxWidth: width,
        padding: '24px 28px',
        borderRadius: 'var(--t-corner)',
        background: 'var(--t-surface-fill)',
        backgroundImage: 'var(--t-gradient)',
        border: `2px solid ${enabled ? 'var(--t-outline-strong)' : 'var(--t-outline)'}`,
        boxShadow: 'var(--t-shadow)',
        textAlign: alignRight ? 'right' : centred ? 'center' : 'left',
        opacity: barred && gated === 'dim' ? 0.82 : 1,
      }}
    >
      <div
        style={{
          ...labelType(34),
          ...clampLines(lines),
          lineHeight: 1.18,
          color: 'var(--t-text)',
          ...(barred ? gatedLabel(gated) : {}),
        }}
      >
        {label}
      </div>

      {detail && (
        <div
          style={{
            marginTop: 10,
            fontSize: `calc(25px * var(--t-type-scale))`,
            fontWeight: 500,
            lineHeight: 1.35,
            // Requirement reason text color styling for ineligible option.
            color: enabled ? 'var(--t-text-muted)' : 'var(--t-text)',
            display: 'flex',
            gap: 10,
            justifyContent: alignRight ? 'flex-end' : centred ? 'center' : 'flex-start',
            alignItems: 'flex-start',
          }}
        >
          {barred && showsLock(gated) && (
            <span style={{ color: 'var(--t-disabled)', display: 'flex', marginTop: 2 }}>
              <LockGlyph size={24} color="currentColor" />
            </span>
          )}
          <span style={clampLines(2)}>{detail}</span>
        </div>
      )}
    </div>
  )
}

/** Refusal feedback animation hook. */
function useShake(token: number, reducedMotion: boolean) {
  const [active, setActive] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (reducedMotion) return

    setActive(true)
    const timer = window.setTimeout(() => setActive(false), 80)
    return () => window.clearTimeout(timer)
  }, [token, reducedMotion])

  return active
}

function Indicator({ state, activateToken, tunables, reducedMotion, openMs: rawOpenMs }: IndicatorViewProps) {
  const openMs = gate(rawOpenMs, tunables, reducedMotion)
  const shape = readString(tunables, 'indicatorStyle', 'ring') as IndicatorShapeName
  const useAccent = readBool(tunables, 'indicatorAccent', false)
  const color = useAccent || state !== 'idle' ? 'var(--t-accent)' : 'var(--t-text)'
  const charged = useCharge(state, activateToken, openMs, reducedMotion)

  return (
    <div
      className="world"
      style={{
        transform: `scale(${state === 'idle' ? 0.82 : state === 'near' ? 1 : 0.94 + charged * 0.18})`,
        opacity: state === 'idle' ? 0.72 : 1,
        transition: reducedMotion ? 'none' : `transform ${openMs}ms ${EASE}, opacity 140ms ${EASE}`,
      }}
    >
      <IndicatorShape shape={shape} color={color} weight={state === 'idle' ? 9 : 12} charge={charged} />
    </div>
  )
}

/** Indicator charge animation hook for magnetise transition. */
function useCharge(state: string, token: number, ms: number, reducedMotion: boolean) {
  const [charge, setCharge] = useState(state === 'active' ? 1 : 0)

  useEffect(() => {
    if (state !== 'active') {
      setCharge(0)
      return
    }
    if (reducedMotion) {
      setCharge(1)
      return
    }

    setCharge(0)
    const raf = requestAnimationFrame(() => setCharge(1))
    return () => cancelAnimationFrame(raf)
  }, [state, token, reducedMotion, ms])

  return charge
}

function Cursor({ tunables }: CursorViewProps) {
  const shape = readString(tunables, 'cursorStyle', 'reticle') as CursorShapeName
  return (
    <div className="world">
      <CursorShape shape={shape} color="var(--t-text)" weight={7} />
    </div>
  )
}

const design: DesignModule = { id: 'radial', sdk: 1, Menu, Indicator, Cursor }

registerDesign(design)

export default design
