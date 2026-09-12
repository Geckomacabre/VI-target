import {
  ChevronGlyph, CursorShape, EASE, IndicatorShape, LockGlyph, OptionIcon,
  amp, clampLines, disabledStyle, duration, gate, gatedLabel, intensity, labelLines, labelType,
  readBool, readNumber, readString, registerDesign, rgba, showsLock,
  useEffect, useRef, useState,
} from '@host'
import type {
  CSSProperties, CursorShapeName, CursorViewProps, DesignFont, DesignModule, DisabledStyle,
  IndicatorShapeName, IndicatorViewProps, InputPrompts, MenuViewProps, OptionBadge, ReactNode,
  TargetOption,
} from '@host'

/* The rail sits ON the world anchor, so the focus node marks the exact point the
   player is aimed at. Everything else is laid out away from it on the open side. */

/** Rail centre to the near edge of the text column. */
const LABEL_GAP = 74

/** Usable width on the open side of the 1024 canvas, given the 0.34 anchor bias. */
const ROOM = 1024 * 0.84 - 40

const NODE = 52

/* Pad labels arrive as tokens for GTA's own button font, which does not exist
   inside a CEF frame: rendered verbatim they are tofu boxes. Map the ones worth
   recognising onto real characters, and refuse to print anything that is not
   plain ASCII rather than drawing garbage in the player's face. */
const PAD_GLYPHS: Record<string, string> = {
  A: 'A', B: 'B', X: 'X', Y: 'Y',
  BUTTON_A: 'A', BUTTON_B: 'B', BUTTON_X: 'X', BUTTON_Y: 'Y',
  PAD_A: 'A', PAD_B: 'B', PAD_X: 'X', PAD_Y: 'Y',
  CROSS: '✕', CIRCLE: '◯', SQUARE: '□', TRIANGLE: '△',
  DPAD_UP: '↑', DPAD_DOWN: '↓', DPAD_LEFT: '←', DPAD_RIGHT: '→',
  UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
  LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT',
  L1: 'L1', R1: 'R1', L2: 'L2', R2: 'R2', L3: 'L3', R3: 'R3',
  LEFT_SHOULDER: 'LB', RIGHT_SHOULDER: 'RB',
  LEFT_TRIGGER: 'LT', RIGHT_TRIGGER: 'RT',
  LEFT_STICK: 'L3', RIGHT_STICK: 'R3',
  START: '≡', SELECT: '❐', BACK: '❐',
}

const normalise = (label: string) =>
  label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')

/** Printable ASCII only: anything else is a font ligature we cannot draw. */
const renderable = (value: string) => /^[ -~]+$/.test(value)

/** The characters to draw for a binding, or null when there is nothing bound. */
function glyphFor(input: InputPrompts | undefined): string | null {
  const label = input?.confirm?.trim()
  if (!label) return null

  if (input?.device === 'pad') {
    const mapped = PAD_GLYPHS[normalise(label)]
    if (mapped) return mapped
  }

  return renderable(label) ? label : '•'
}

function Menu({
  options, focus, rejectToken, phase, emptyLabel, input, tunables, reducedMotion,
  openMs: rawOpenMs,
}: MenuViewProps) {
  const openMs = gate(rawOpenMs, tunables, reducedMotion)

  const left = readString(tunables, 'listSide', 'right') === 'left'
  const slotted = readString(tunables, 'anchorMode', 'slot') === 'slot'
  const visible = Math.max(3, Math.min(8, Math.round(readNumber(tunables, 'visible', 5))))
  const rowGap = readNumber(tunables, 'rowGap', 86)
  const emphasis = readNumber(tunables, 'focusEmphasis', 124) / 100
  const listWidth = Math.max(240, Math.min(readNumber(tunables, 'listWidth', 680), ROOM - LABEL_GAP))

  const railStyle = readString(tunables, 'railStyle', 'line')
  const confirm = readString(tunables, 'confirmGlyph', 'auto')
  const submenuGlyph = readString(tunables, 'submenuGlyph', 'dots')
  const rowIcon = readString(tunables, 'rowIcon', 'none')
  const showCounter = readBool(tunables, 'counter', false)
  const showSubtext = readBool(tunables, 'subtext', true)

  const scrim = readNumber(tunables, 'scrim', 38) / 100
  const keyline = readNumber(tunables, 'textOutline', 60) / 100
  const surface = readString(tunables, 'surface', '#0b0d0e')

  const lines = labelLines(tunables)
  const gated = disabledStyle(tunables)
  const move = duration(190, tunables, reducedMotion)
  const nudge = useShake(rejectToken, reducedMotion) ? amp(16, tunables, reducedMotion) : 0

  const count = options.length
  const index = count === 0 ? 0 : Math.min(Math.max(focus - 1, 0), count - 1)
  const span = ((visible - 1) / 2) * rowGap

  const top = useWindowTop(options, index, visible, phase)
  // Slot mode parks the focused row on the anchor; list mode holds the list
  // still and only scrolls once the focus reaches an edge of the window.
  const shift = slotted ? -index * rowGap : -span - top * rowGap

  const entering = phase === 'opening'
  const closing = phase === 'closing'
  const travel = amp(38, tunables, reducedMotion)
  const stagger = 24 * intensity(tunables, reducedMotion)

  const first = slotted ? 0 : top
  const last = slotted ? count - 1 : Math.min(count - 1, top + visible - 1)
  const moreUp = count > 0 && (slotted ? index > 0 : top > 0)
  const moreDown = count > 0 && (slotted ? index < count - 1 : last < count - 1)

  // Where the rows actually reach, which is short of the window whenever the
  // list is shorter than it or the focus has run to one end of it. The rail and
  // the scrim are cut to this, so neither trails off into empty space.
  const headY = count === 0 ? 0 : Math.max(-span, first * rowGap + shift)
  const footY = count === 0 ? 0 : Math.min(span, last * rowGap + shift)

  const shadow = keyline <= 0
    ? 'none'
    : `0 ${(2 * keyline).toFixed(1)}px ${(12 * keyline).toFixed(1)}px rgba(0,0,0,${(0.9 * keyline).toFixed(2)}),` +
      ` 0 0 ${(4 + 5 * keyline).toFixed(1)}px rgba(0,0,0,${(0.85 * keyline).toFixed(2)})`

  return (
    <div
      className="world-anchor"
      style={{
        fontFamily: 'var(--t-font)',
        transition: `opacity ${openMs}ms ${EASE}, transform ${openMs}ms ${EASE}`,
        opacity: closing ? 0 : 1,
        transform: `scale(var(--t-scale)) translateX(${closing ? (left ? travel * 0.5 : -travel * 0.5) : 0}px)`,
      }}
    >
      {scrim > 0 && (
        <Scrim
          left={left}
          width={LABEL_GAP * 1.9 + listWidth}
          top={headY - rowGap * 0.62}
          height={footY - headY + rowGap * 1.24}
          surface={surface}
          strength={scrim}
        />
      )}

      {railStyle === 'line' && count > 0 && <Rail head={headY} foot={footY} />}

      {moreUp && railStyle !== 'none' && <Caret y={headY - rowGap * 0.52} up />}
      {moreDown && railStyle !== 'none' && <Caret y={footY + rowGap * 0.52} up={false} />}

      {count === 0 && (
        <Row
          y={0} x={entering ? (left ? -travel : travel) : nudge * (left ? -1 : 1)}
          opacity={entering || closing ? 0 : 0.78}
          delay={0} move={move} left={left} listWidth={listWidth} lines={lines}
          label={emptyLabel} size={34} shadow={shadow}
          node={<Dot muted />}
        />
      )}

      {options.map((option, i) => {
        const y = i * rowGap + shift
        const inWindow = i >= first && i <= last && Math.abs(y) <= span + 1
        // One row of headroom past the window, so a row that is about to scroll
        // in fades up from where it will be rather than popping into place.
        if (Math.abs(y) > span + rowGap * 1.6) return null

        const focused = i === index
        const dim = span > 0 ? Math.abs(y) / span : 0
        const barred = !option.enabled
        const detail = showSubtext
          ? (focused ? (option.enabled ? option.description : option.reason) : (barred ? option.reason : undefined))
          : undefined

        return (
          <Row
            key={option.id}
            y={y}
            x={entering ? (left ? -travel : travel) : nudge * (left ? -1 : 1)}
            opacity={
              entering || closing || !inWindow
                ? 0
                : (focused ? 1 : (0.74 - 0.32 * dim) * (barred && gated === 'dim' ? 0.7 : 1))
            }
            delay={entering ? Math.abs(i - index) * stagger : 0}
            move={nudge ? 70 : move}
            left={left}
            listWidth={listWidth}
            lines={lines}
            label={option.label}
            size={34 * (focused ? emphasis : 1)}
            shadow={shadow}
            labelStyle={barred ? gatedLabel(gated) : { color: focused ? 'var(--t-accent)' : 'var(--t-text)' }}
            detail={detail}
            detailTone={barred ? 'var(--t-text)' : 'var(--t-text-muted)'}
            detailLock={barred && showsLock(gated)}
            icon={rowIcon === 'all' || (rowIcon === 'focus' && focused) ? option.icon : undefined}
            iconColor={option.iconColor}
            badges={option.badges}
            submenu={option.submenu ? submenuGlyph : 'none'}
            node={
              <Node
                focused={focused}
                enabled={option.enabled}
                gated={gated}
                confirm={confirm}
                glyph={glyphFor(input)}
              />
            }
          />
        )
      })}

      {showCounter && count > 1 && (
        <Counter left={left} y={footY + rowGap * 0.56} index={index} count={count} shadow={shadow} />
      )}
    </div>
  )
}

/* ── Rail ───────────────────────────────────────────────────────────────── */

/** The line the nodes hang on. Faded at both ends so it reads as a segment of
 *  something longer rather than a hard bar that stops mid-air. */
function Rail({ head, foot }: { head: number; foot: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: -2,
        top: head - 22,
        width: 4,
        height: foot - head + 44,
        borderRadius: 2,
        background:
          'linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--t-outline) 14%, var(--t-outline) 86%, rgba(0,0,0,0) 100%)',
      }}
    />
  )
}

/** More options past the window, in that direction. */
function Caret({ y, up }: { y: number; up: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24" width={30} height={30}
      style={{ position: 'absolute', left: -15, top: y - 15, color: 'var(--t-text-muted)', opacity: 0.8 }}
    >
      <path
        d={up ? 'M 5 15 L 12 8 L 19 15' : 'M 5 9 L 12 16 L 19 9'}
        fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

/** Soft darkening under the text so white type survives a white fridge door. */
function Scrim({ left, width, top, height, surface, strength }: {
  left: boolean; width: number; top: number; height: number; surface: string; strength: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: left ? -width + LABEL_GAP * 0.95 : -LABEL_GAP * 0.95,
        top,
        width,
        height,
        pointerEvents: 'none',
        // Transparent at both horizontal ends: a scrim with an edge reads as a
        // panel, and this design is meant to have none.
        background: `linear-gradient(${left ? 270 : 90}deg, ${rgba(surface, 0)} 0%,` +
          ` ${rgba(surface, 0.9 * strength)} 12%, ${rgba(surface, 0.58 * strength)} 52%, ${rgba(surface, 0)} 92%)`,
        WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 22%, #000 78%, rgba(0,0,0,0) 100%)',
      }}
    />
  )
}

/* ── Nodes ──────────────────────────────────────────────────────────────── */

function Dot({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox={`0 0 ${NODE} ${NODE}`} width={NODE} height={NODE} style={{ overflow: 'visible' }}>
      <circle cx={NODE / 2} cy={NODE / 2} r="8" fill={muted ? 'var(--t-text-muted)' : 'var(--t-text)'} />
    </svg>
  )
}

interface NodeProps {
  focused: boolean
  enabled: boolean
  gated: DisabledStyle
  confirm: string
  /** Characters for the live binding, or null when nothing is bound. */
  glyph: string | null
}

/** The rail marker for one row. The focused node carries the confirm glyph, and
 *  a locked row swaps its dot for a padlock so the list reads as gated without
 *  the player having to scroll onto the row first. */
function Node({ focused, enabled, gated, confirm, glyph }: NodeProps) {
  const tone = enabled ? 'var(--t-accent)' : 'var(--t-disabled)'
  const half = NODE / 2

  // Anything past two characters is a word, not a button mark, so it gets a
  // keycap wide enough to hold it rather than a circle it has to fit inside.
  const cap = enabled && confirm === 'auto' && !!glyph && glyph.length > 2
  // Clamped to the node column. A keycap wide enough for "MOUSE1" at a
  // comfortable size is wider than the gap between the rail and the label, and
  // a mark that overlaps the word it belongs to is worse than a small one.
  const capWidth = cap && glyph
    ? Math.min(LABEL_GAP - 8, Math.max(40, glyph.length * 12 + 18))
    : 0

  if (!focused) {
    if (!enabled && showsLock(gated)) {
      return (
        <span style={{ display: 'flex', color: 'var(--t-disabled)' }}>
          <LockGlyph size={30} color="currentColor" />
        </span>
      )
    }

    return (
      <svg viewBox={`0 0 ${NODE} ${NODE}`} width={NODE} height={NODE} style={{ overflow: 'visible' }}>
        <circle cx={half} cy={half} r="7.5" fill={enabled ? 'var(--t-text)' : 'var(--t-disabled)'} />
        {!enabled && gated === 'strike' && (
          <line x1={half - 13} y1={half + 13} x2={half + 13} y2={half - 13}
            stroke="var(--t-disabled)" strokeWidth="3.5" strokeLinecap="round" />
        )}
      </svg>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${NODE} ${NODE}`} width={NODE} height={NODE}
      style={{ overflow: 'visible' }}
    >
      {/* A ring fits one or two characters. "MOUSE1", "SPACE", "LB" need a
          keycap that can grow instead, or the label is squeezed into an
          illegible smear -- which is what a circle does to a word. */}
      {cap ? (
        <>
          <rect
            x={half - capWidth / 2} y={half - 17} width={capWidth} height="34" rx="9"
            fill="rgba(0,0,0,0.34)"
          />
          <rect
            x={half - capWidth / 2} y={half - 17} width={capWidth} height="34" rx="9"
            fill="none" stroke={tone} strokeWidth="3.5"
          />
        </>
      ) : (
        <>
          <circle cx={half} cy={half} r="21" fill="rgba(0,0,0,0.34)" />
          <circle cx={half} cy={half} r="21" fill="none" stroke={tone} strokeWidth="4" />
        </>
      )}

      {/* 'auto' draws whatever is actually bound, which is the only mark that
          stays true when the player swaps device mid-session. It falls back to
          the cross until the first prompt sync arrives, so the node is never
          an empty ring. */}
      {enabled && confirm === 'auto' && glyph && (
        <text
          x={half} y={half}
          textAnchor="middle" dominantBaseline="central"
          fill={tone}
          // textLength makes the fit exact instead of estimated: the label is
          // condensed to the space there is, whatever the face's metrics turn
          // out to be, so a long bind cannot spill past the keycap drawn for it.
          textLength={cap ? capWidth - 14 : undefined}
          lengthAdjust={cap ? 'spacingAndGlyphs' : undefined}
          style={{
            fontSize: cap ? 18 : glyph.length > 1 ? 17 : 24,
            fontWeight: 700,
            fontFamily: 'var(--t-font)',
            letterSpacing: glyph.length > 1 ? '0.02em' : '0',
          }}
        >
          {glyph}
        </text>
      )}

      {enabled && (confirm === 'cross' || (confirm === 'auto' && !glyph)) && (
        <path
          d={`M ${half - 8} ${half - 8} L ${half + 8} ${half + 8} M ${half + 8} ${half - 8} L ${half - 8} ${half + 8}`}
          stroke={tone} strokeWidth="4.5" strokeLinecap="round"
        />
      )}

      {enabled && confirm === 'dot' && <circle cx={half} cy={half} r="8" fill={tone} />}

      {enabled && confirm === 'mouse' && (
        <>
          <rect x={half - 7} y={half - 10} width="14" height="20" rx="7"
            fill="none" stroke={tone} strokeWidth="2.6" />
          {/* Left button, filled: the quarter of the shell above the split and
              left of the centre line. */}
          <path
            d={`M ${half - 7} ${half - 3} A 7 7 0 0 1 ${half} ${half - 10} L ${half} ${half - 3} Z`}
            fill={tone}
          />
          <line x1={half - 7} y1={half - 3} x2={half + 7} y2={half - 3} stroke={tone} strokeWidth="2.2" />
        </>
      )}

      {!enabled && showsLock(gated) && (
        <g transform={`translate(${half - 11} ${half - 11}) scale(0.92)`} style={{ color: 'var(--t-disabled)' }}>
          <rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="currentColor" />
          <path d="M 8 10.5 V 7.5 a 4 4 0 0 1 8 0 v 3" fill="none" stroke="currentColor" strokeWidth="2" />
        </g>
      )}

      {!enabled && gated === 'strike' && (
        <line x1={half - 10} y1={half + 10} x2={half + 10} y2={half - 10}
          stroke="var(--t-disabled)" strokeWidth="4" strokeLinecap="round" />
      )}
    </svg>
  )
}

/* ── Rows ───────────────────────────────────────────────────────────────── */

interface RowProps {
  y: number
  x: number
  opacity: number
  delay: number
  move: number
  left: boolean
  listWidth: number
  lines: number
  label: string
  size: number
  shadow: string
  node: ReactNode
  labelStyle?: CSSProperties
  detail?: string
  detailTone?: string
  detailLock?: boolean
  icon?: string
  iconColor?: string
  badges?: OptionBadge[]
  submenu?: string
}

function Row({
  y, x, opacity, delay, move, left, listWidth, lines, label, size, shadow, node,
  labelStyle, detail, detailTone, detailLock, icon, iconColor, badges, submenu = 'none',
}: RowProps) {
  const width = LABEL_GAP + listWidth

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: left ? LABEL_GAP / 2 - width : -LABEL_GAP / 2,
        width,
        display: 'flex',
        flexDirection: left ? 'row-reverse' : 'row',
        alignItems: 'center',
        opacity,
        transform: `translate(${x}px, calc(-50% + ${y}px))`,
        transition: `transform ${move}ms ${EASE} ${delay}ms, opacity ${move}ms ${EASE} ${delay}ms`,
        willChange: 'transform, opacity',
      }}
    >
      <div style={{ width: LABEL_GAP, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>{node}</div>

      <div style={{ width: listWidth, textAlign: left ? 'right' : 'left' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: left ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {icon && (
            <span style={{ display: 'flex', flexShrink: 0 }}>
              <OptionIcon name={icon} size={size * 0.86} weight="bold" color={iconColor ?? 'var(--t-text)'} />
            </span>
          )}

          {badges?.map((badge, i) => <Badge key={i} badge={badge} size={size} />)}

          <span
            style={{
              ...labelType(size),
              ...clampLines(lines),
              flex: '0 1 auto',
              minWidth: 0,
              lineHeight: 1.14,
              color: 'var(--t-text)',
              textShadow: shadow,
              transition: `font-size ${move}ms ${EASE}, color ${move}ms ${EASE}`,
              ...labelStyle,
            }}
          >
            {label}
          </span>

          {submenu !== 'none' && (
            <span style={{ display: 'flex', flexShrink: 0, opacity: 0.75, transform: left ? 'scaleX(-1)' : undefined }}>
              {submenu === 'chevron'
                ? <ChevronGlyph size={size * 0.74} color="var(--t-text-muted)" />
                : <OptionIcon name="more" size={size * 0.8} weight="bold" color="var(--t-text-muted)" />}
            </span>
          )}
        </div>

        {detail && (
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              flexDirection: left ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 9,
              fontSize: 'calc(24px * var(--t-type-scale))',
              fontWeight: 500,
              lineHeight: 1.3,
              color: detailTone,
              textShadow: shadow,
            }}
          >
            {detailLock && (
              <span style={{ color: 'var(--t-disabled)', display: 'flex', marginTop: 1, flexShrink: 0 }}>
                <LockGlyph size={22} color="currentColor" />
              </span>
            )}
            <span style={clampLines(2)}>{detail}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Script-supplied tag (a price, a buff, a warning) rendered as a coloured chip. */
function Badge({ badge, size }: { badge: OptionBadge; size: number }) {
  const color = badge.color ?? 'var(--t-accent)'
  const box = Math.round(size * 0.96)

  return (
    <span
      style={{
        width: box,
        height: box,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,0.42)',
        border: `2.5px solid ${color}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
      }}
    >
      <OptionIcon name={badge.icon} size={box * 0.62} weight="bold" color={color} />
    </span>
  )
}

/** Position readout for lists longer than the window. */
function Counter({ left, y, index, count, shadow }: {
  left: boolean; y: number; index: number; count: number; shadow: string
}) {
  return (
    <div
      className="num"
      style={{
        position: 'absolute',
        top: y - 14,
        left: left ? undefined : LABEL_GAP * 0.55,
        right: left ? LABEL_GAP * 0.55 : undefined,
        fontSize: 'calc(22px * var(--t-type-scale))',
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: 'var(--t-text-muted)',
        textShadow: shadow,
        whiteSpace: 'nowrap',
      }}
    >
      {index + 1} / {count}
    </div>
  )
}

/* ── State ──────────────────────────────────────────────────────────────── */

/** Index of the first row in the window. Held across renders so the list stays
 *  put while the focus moves inside it, and scrolls by one at the edges. */
function useWindowTop(options: TargetOption[], index: number, visible: number, phase: string): number {
  const top = useRef(0)
  const signature = useRef('')
  const opened = useRef(phase)

  const key = options.map((option) => option.id).join(',')

  // A submenu swaps the whole list, and a re-open starts a new interaction:
  // either way the window belongs back at the top before it is re-clamped.
  if (key !== signature.current || (phase === 'opening' && opened.current !== 'opening')) {
    signature.current = key
    top.current = 0
  }
  opened.current = phase

  const ceiling = Math.max(0, options.length - visible)
  let next = Math.min(top.current, ceiling)

  if (index < next) next = index
  else if (index > next + visible - 1) next = index - visible + 1

  top.current = next
  return next
}

/** Refusal feedback: one short shove away from the rail. */
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

/* ── World marker and cursor ────────────────────────────────────────────── */

function Indicator({ state, activateToken, tunables, reducedMotion, openMs: rawOpenMs }: IndicatorViewProps) {
  const openMs = gate(rawOpenMs, tunables, reducedMotion)
  const shape = readString(tunables, 'indicatorStyle', 'dot') as IndicatorShapeName
  const useAccent = readBool(tunables, 'indicatorAccent', false)
  const color = useAccent || state !== 'idle' ? 'var(--t-accent)' : 'var(--t-text)'
  const charged = useCharge(state, activateToken, reducedMotion)

  return (
    <div
      className="world"
      style={{
        transform: `scale(${state === 'idle' ? 0.78 : state === 'near' ? 1 : 0.9 + charged * 0.22})`,
        opacity: state === 'idle' ? 0.7 : 1,
        transition: reducedMotion ? 'none' : `transform ${openMs}ms ${EASE}, opacity 140ms ${EASE}`,
      }}
    >
      <IndicatorShape shape={shape} color={color} weight={state === 'idle' ? 8 : 11} charge={charged} />
    </div>
  )
}

/** Drives the lock-on swell when the marker is absorbed by the menu. */
function useCharge(state: string, token: number, reducedMotion: boolean) {
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
  }, [state, token, reducedMotion])

  return charge
}

function Cursor({ tunables }: CursorViewProps) {
  const shape = readString(tunables, 'cursorStyle', 'dot') as CursorShapeName
  return (
    <div className="world">
      <CursorShape shape={shape} color="var(--t-text)" weight={6} />
    </div>
  )
}

/* Condensed faces, because the reference look is a tall narrow grotesque. Each
   stack keeps a system fallback so a server with no outbound font access still
   renders the design, just wider. */
const fonts: DesignFont[] = [
  {
    key: 'barlow',
    stack: "'Barlow Semi Condensed', 'Arial Narrow', 'Segoe UI', Roboto, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&display=swap',
  },
  {
    key: 'oswald',
    stack: "'Oswald', 'Arial Narrow', 'Segoe UI', Roboto, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap',
  },
  {
    key: 'saira',
    stack: "'Saira Condensed', 'Arial Narrow', 'Segoe UI', Roboto, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&display=swap',
  },
  {
    key: 'archivo',
    stack: "'Archivo Narrow', 'Arial Narrow', 'Segoe UI', Roboto, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@500;600;700&display=swap',
  },
]

const design: DesignModule = { id: 'rail', sdk: 1, Menu, Indicator, Cursor, fonts }

registerDesign(design)

export default design
