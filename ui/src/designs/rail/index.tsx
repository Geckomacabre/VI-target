import {
  ChevronGlyph, CursorShape, EASE, IndicatorShape, LockGlyph, OptionIcon,
  amp, clampLines, disabledStyle, duration, gate, gatedLabel, intensity, labelLines, labelType,
  readBool, readNumber, readString, registerDesign, rgba, showsLock,
  useEffect, useRef, useState,
} from '@host'
import type {
  CSSProperties, CursorShapeName, CursorViewProps, DesignFont, DesignModule, DisabledStyle,
  IndicatorShapeName, IndicatorViewProps, InputDevice, InputPrompts, MenuViewProps, OptionBadge,
  ReactNode, TargetOption,
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

/** The characters to draw for a raw binding label, or null when there is
 *  nothing bound. Shared by the rail's own confirm glyph and, for the direct
 *  multi-key prompt, each option's own independently bound key - both are
 *  live `GetControlInstructionalButton` text, just read from a different spot
 *  in the payload. */
function resolveGlyph(label: string | undefined, device: InputDevice | undefined): string | null {
  const trimmed = label?.trim()
  if (!trimmed) return null

  if (device === 'pad') {
    const mapped = PAD_GLYPHS[normalise(trimmed)]
    if (mapped) return mapped
  }

  return renderable(trimmed) ? trimmed : '•'
}

/** The characters to draw for the rail's shared confirm binding. */
function glyphFor(input: InputPrompts | undefined): string | null {
  return resolveGlyph(input?.confirm, input?.device)
}

function Menu({
  options, focus, rejectToken, phase, emptyLabel, input, tunables, reducedMotion,
  openMs: rawOpenMs, mode = 'list', collapseLabel = '',
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

  const entering = phase === 'opening'
  const closing = phase === 'closing'
  const travel = amp(38, tunables, reducedMotion)
  const stagger = 24 * intensity(tunables, reducedMotion)
  const rowX = entering ? (left ? -travel : travel) : nudge * (left ? -1 : 1)

  const shadow = keyline <= 0
    ? 'none'
    : `0 ${(2 * keyline).toFixed(1)}px ${(12 * keyline).toFixed(1)}px rgba(0,0,0,${(0.9 * keyline).toFixed(2)}),` +
      ` 0 0 ${(4 + 5 * keyline).toFixed(1)}px rgba(0,0,0,${(0.85 * keyline).toFixed(2)})`

  const count = options.length
  const index = count === 0 ? 0 : Math.min(Math.max(focus - 1, 0), count - 1)
  const span = ((visible - 1) / 2) * rowGap

  // Called unconditionally, ahead of the collapsed/direct early returns below:
  // `mode` is a prop that can change value between renders (a collapsed
  // prompt becomes a list the moment the player presses the expand key), and
  // React requires every render to call the same hooks in the same order --
  // this one just goes unused whenever the result isn't the scrolling list.
  const top = useWindowTop(options, index, visible, phase)

  // Two shapes that never scroll: a single collapsed row for a 3+ option
  // entity before the list opens, and every option shown at once (1-2 of
  // them) each with its own key, for an entity that never opens a list at
  // all. Both skip the rail entirely -- there is nothing here to scroll.
  if (mode === 'collapsed') {
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
        <CollapsedPrompt
          left={left}
          x={rowX}
          opacity={entering || closing ? 0 : 1}
          move={move}
          label={collapseLabel}
          glyph={glyphFor(input)}
          confirm={confirm}
          gated={gated}
          shadow={shadow}
        />
      </div>
    )
  }

  if (mode === 'direct') {
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
        <DirectPrompt
          options={options}
          left={left}
          x={rowX}
          entering={entering}
          closing={closing}
          move={move}
          stagger={stagger}
          rowGap={rowGap}
          listWidth={listWidth}
          lines={lines}
          gated={gated}
          confirm={confirm}
          device={input?.device}
          shadow={shadow}
        />
      </div>
    )
  }

  // Slot mode parks the focused row on the anchor; list mode holds the list
  // still and only scrolls once the focus reaches an edge of the window.
  const shift = slotted ? -index * rowGap : -span - top * rowGap

  const first = slotted ? 0 : top
  const last = slotted ? count - 1 : Math.min(count - 1, top + visible - 1)
  const moreUp = count > 0 && (slotted ? index > 0 : top > 0)
  const moreDown = count > 0 && (slotted ? index < count - 1 : last < count - 1)

  // Where the rows actually reach, which is short of the window whenever the
  // list is shorter than it or the focus has run to one end of it. The rail and
  // the scrim are cut to this, so neither trails off into empty space.
  const headY = count === 0 ? 0 : Math.max(-span, first * rowGap + shift)
  const footY = count === 0 ? 0 : Math.min(span, last * rowGap + shift)

  // Ghost rows past the window fade the rest of the way to nothing over this
  // much extra travel, and the rail line is cut to fade out over the exact
  // same distance so neither one reads brighter than the other at the same
  // point on screen. Only rows within `span` of the focus (the window itself)
  // read at full/near-full opacity; anything past it -- window edge through
  // the ghost zone -- is what "the two immediate neighbours" plus a fading
  // tail actually looks like once there is more than one row either side.
  const GHOST = rowGap * 1.6
  const railHead = headY - (moreUp ? GHOST : rowGap * 0.5)
  const railFoot = footY + (moreDown ? GHOST : rowGap * 0.5)

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

      {railStyle === 'line' && count > 0 && <Rail head={railHead} foot={railFoot} coreHead={headY} coreFoot={footY} />}

      {moreUp && railStyle !== 'none' && <Caret y={headY - rowGap * 0.52} up />}
      {moreDown && railStyle !== 'none' && <Caret y={footY + rowGap * 0.52} up={false} />}

      {count === 0 && (
        <Row
          y={0} x={rowX}
          opacity={entering || closing ? 0 : 0.78}
          delay={0} move={move} left={left} listWidth={listWidth} lines={lines}
          label={emptyLabel} size={34} shadow={shadow}
          node={<Dot muted />}
        />
      )}

      {options.map((option, i) => {
        const y = i * rowGap + shift
        const dist = Math.abs(y)
        // Past the window, a ghost row fades linearly the rest of the way to
        // nothing over GHOST px, ending at exactly the point the rail line
        // (below) also reaches transparent -- neither one stays lit past
        // where the other has already faded out.
        if (dist > span + GHOST) return null

        const focused = i === index
        const barred = !option.enabled
        let base: number
        if (focused) {
          base = 1
        } else if (dist <= span) {
          base = 0.74 - 0.32 * (dist / Math.max(span, 1))
        } else {
          base = 0.42 * (1 - (dist - span) / GHOST)
        }
        const detail = showSubtext
          ? (focused ? (option.enabled ? option.description : option.reason) : (barred ? option.reason : undefined))
          : undefined

        return (
          <Row
            key={option.id}
            y={y}
            x={rowX}
            opacity={
              entering || closing
                ? 0
                : base * (barred && gated === 'dim' ? 0.7 : 1)
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
 *  something longer rather than a hard bar that stops mid-air -- over exactly
 *  the same span the rows themselves fade over (`head`/`foot` already include
 *  the ghost-row travel), so the line never reads brighter than the text and
 *  dots sitting at the same height. `coreHead`/`coreFoot` are where the
 *  full-opacity window actually starts and ends; between those two points the
 *  line stays fully lit, ramping to nothing exactly at `head`/`foot`. */
function Rail({ head, foot, coreHead, coreFoot }: {
  head: number; foot: number; coreHead: number; coreFoot: number
}) {
  const total = Math.max(1, foot - head)
  const topPct = ((coreHead - head) / total) * 100
  const botPct = ((coreFoot - head) / total) * 100

  return (
    <div
      style={{
        position: 'absolute',
        left: -2,
        top: head,
        width: 4,
        height: total,
        borderRadius: 2,
        background:
          `linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--t-outline) ${topPct.toFixed(1)}%,` +
          ` var(--t-outline) ${botPct.toFixed(1)}%, rgba(0,0,0,0) 100%)`,
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
        {/* Solid, not a hollow stroked ring - a thin dark outline is enough to
            separate it from a bright background without reading as a circle
            you're meant to look through. */}
        <circle
          cx={half} cy={half} r="7.5"
          fill={enabled ? '#ffffff' : 'var(--t-disabled)'}
          stroke="rgba(0,0,0,0.55)" strokeWidth="1.5"
        />
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
      {/* Solid white, the key glyph cut out in black on top of it - not a dark
          disc with a coloured ring and a coloured mark. A ring fits one or two
          characters; "MOUSE1", "SPACE", "LB" need a keycap that can grow
          instead, or the label is squeezed into an illegible smear. Locked
          rows keep the same white field and cut the padlock into it instead of
          a glyph, so the mark language stays one thing throughout. */}
      {cap ? (
        <rect
          x={half - capWidth / 2} y={half - 17} width={capWidth} height="34" rx="9"
          fill={enabled ? '#ffffff' : 'var(--t-disabled)'}
        />
      ) : (
        <circle cx={half} cy={half} r="21" fill={enabled ? '#ffffff' : 'var(--t-disabled)'} />
      )}

      {/* 'auto' draws whatever is actually bound, which is the only mark that
          stays true when the player swaps device mid-session. It falls back to
          the cross until the first prompt sync arrives, so the node is never
          an empty circle. */}
      {enabled && confirm === 'auto' && glyph && (
        <text
          x={half} y={half}
          textAnchor="middle" dominantBaseline="central"
          fill="#0a0c0d"
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
          stroke="#0a0c0d" strokeWidth="4.5" strokeLinecap="round"
        />
      )}

      {enabled && confirm === 'dot' && <circle cx={half} cy={half} r="8" fill="#0a0c0d" />}

      {enabled && confirm === 'mouse' && (
        <>
          <rect x={half - 7} y={half - 10} width="14" height="20" rx="7"
            fill="none" stroke="#0a0c0d" strokeWidth="2.6" />
          {/* Left button, filled: the quarter of the shell above the split and
              left of the centre line. */}
          <path
            d={`M ${half - 7} ${half - 3} A 7 7 0 0 1 ${half} ${half - 10} L ${half} ${half - 3} Z`}
            fill="#0a0c0d"
          />
          <line x1={half - 7} y1={half - 3} x2={half + 7} y2={half - 3} stroke="#0a0c0d" strokeWidth="2.2" />
        </>
      )}

      {!enabled && showsLock(gated) && (
        <g transform={`translate(${half - 11} ${half - 11}) scale(0.92)`} style={{ color: '#0a0c0d' }}>
          <rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="currentColor" />
          <path d="M 8 10.5 V 7.5 a 4 4 0 0 1 8 0 v 3" fill="none" stroke="currentColor" strokeWidth="2" />
        </g>
      )}

      {!enabled && gated === 'strike' && (
        <line x1={half - 10} y1={half + 10} x2={half + 10} y2={half - 10}
          stroke="#0a0c0d" strokeWidth="4" strokeLinecap="round" />
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
      {/* 'fill' is the solid-shape Phosphor variant - a filled bolt, an eye
          drawn as a solid iris with the pupil cut out of it - matching the
          reference's badges instead of the thin outline strokes 'bold' draws. */}
      <OptionIcon name={badge.icon} size={box * 0.62} weight="fill" color={color} />
    </span>
  )
}

/* ── Prompts that never scroll ──────────────────────────────────────────────
   Two shapes an entity can present instead of the rail list above:
   `mode: 'collapsed'` for 3+ options before the list is opened, and
   `mode: 'direct'` for the 1-2 option case where every option is shown at
   once, each independently pressable. Neither has a window to scroll, so
   neither uses the rail, the scrim, or the fade math above. */

/** A dark badge carrying three stacked dots -- the same "opens something more"
 *  language the row `submenu` mark uses elsewhere, reused here to say the
 *  same thing about the list this prompt expands into. */
function SubmenuDots({ size }: { size: number }) {
  const dot = size * 0.15

  return (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: size * 0.14,
        background: 'rgba(0,0,0,0.55)',
        border: '1.5px solid rgba(255,255,255,0.18)',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: dot, height: dot, borderRadius: '50%', background: '#ffffff' }} />
      ))}
    </span>
  )
}

interface CollapsedPromptProps {
  left: boolean
  x: number
  opacity: number
  move: number
  label: string
  glyph: string | null
  confirm: string
  gated: DisabledStyle
  shadow: string
}

/** The single row shown for a 3+ option entity before its list is opened: the
 *  bound expand key, a "more options" indicator, and the entity's own label.
 *  Pressing that key is what swaps this for the ordinary scrolling list --
 *  the host just starts sending `mode: 'list'` on the next `menu:open`, so
 *  there is nothing here to drive that transition beyond rendering it. */
function CollapsedPrompt({ left, x, opacity, move, label, glyph, confirm, gated, shadow }: CollapsedPromptProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: left ? undefined : -LABEL_GAP / 2,
        right: left ? -LABEL_GAP / 2 : undefined,
        display: 'flex',
        flexDirection: left ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 14,
        opacity,
        transform: `translate(${x}px, -50%)`,
        transition: `transform ${move}ms ${EASE}, opacity ${move}ms ${EASE}`,
        willChange: 'transform, opacity',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ width: LABEL_GAP, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <Node focused enabled gated={gated} confirm={confirm} glyph={glyph} />
      </div>

      <SubmenuDots size={30} />

      <span
        style={{
          ...labelType(34),
          color: 'var(--t-text)',
          textShadow: shadow,
        }}
      >
        {label}
      </span>
    </div>
  )
}

interface DirectPromptProps {
  options: TargetOption[]
  left: boolean
  x: number
  entering: boolean
  closing: boolean
  move: number
  stagger: number
  rowGap: number
  listWidth: number
  lines: number
  gated: DisabledStyle
  confirm: string
  device: InputDevice | undefined
  shadow: string
}

/** Every option shown at once (1-2 of them), each bound to its own key and
 *  each independently, simultaneously pressable -- no shared focus cursor,
 *  no scrolling. `option.directKey` is resolved through the same live-binding
 *  glyph table the rail's own confirm node uses, just read per-option instead
 *  of off the one shared `input.confirm`. */
function DirectPrompt({
  options, left, x, entering, closing, move, stagger, rowGap, listWidth, lines, gated, confirm, device, shadow,
}: DirectPromptProps) {
  const span = ((options.length - 1) / 2) * rowGap

  return (
    <>
      {options.map((option, i) => (
        <Row
          key={option.id}
          y={i * rowGap - span}
          x={x}
          opacity={entering || closing ? 0 : 1}
          delay={entering ? i * stagger : 0}
          move={move}
          left={left}
          listWidth={listWidth}
          lines={lines}
          label={option.label}
          size={34}
          shadow={shadow}
          labelStyle={option.enabled ? undefined : gatedLabel(gated)}
          node={
            <Node
              focused
              enabled={option.enabled}
              gated={gated}
              confirm={confirm}
              glyph={resolveGlyph(option.directKey, device)}
            />
          }
        />
      ))}
    </>
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
