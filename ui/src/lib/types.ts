export type SurfaceKind = 'app' | 'menu' | 'indicator' | 'cursor'
export type IndicatorState = 'idle' | 'near' | 'active'

/** Badge icon and color styling descriptor for an option item. */
export interface OptionBadge {
  icon: string
  color?: string
}

/** Resolved target option data model. */
export interface TargetOption {
  id: number
  label: string
  description?: string
  icon?: string
  iconColor?: string
  badges?: OptionBadge[]
  /** Eligibility flag: false indicates player cannot confirm action. */
  enabled: boolean
  /** Requirement explanation displayed for ineligible options. */
  reason?: string
  /** Focusable flag: allows inspecting requirements on disabled options. */
  focusable: boolean
  /** Indicates option opens a submenu. */
  submenu: boolean
}

export interface MenuOpenPayload {
  options: TargetOption[]
  focus: number
  menu?: string
  empty: boolean
  emptyLabel: string
}

export interface MenuFocusPayload {
  focus: number
}

/** Appearance sync payload containing active design tokens and player preferences. */
export interface AppearancePayload {
  design: string
  /** Installed pack version for client cache busting. */
  version?: string
  tunables: Tunables
  /** World anchor offset fraction relative to sprite center. */
  anchor?: { x: number; y: number }
  prefs: Preferences
  timings: { open: number; close: number }
}

export interface Preferences {
  scale: number
  volume: number
  muted: boolean
  reducedMotion: boolean
}

/** Tunable configuration key-value map. */
export type Tunables = Record<string, string | number | boolean>

export type ControlType = 'color' | 'number' | 'select' | 'boolean'

/** Preview surface target associated with a specific control. */
export type ControlAffects = 'menu' | 'locked' | 'motion' | 'indicator' | 'cursor' | 'sound'

export interface DesignControl {
  key: string
  label: string
  type: ControlType
  default: string | number | boolean
  group: string
  help?: string
  unit?: string
  min?: number
  max?: number
  step?: number
  options?: { value: string; label: string; title?: string }[]
  widget?: 'select' | 'segmented'
  /** Tier visibility categorization for administrative controls. */
  tier?: 'basic' | 'advanced'
  affects?: ControlAffects
}

/** Dynamic anchor rule mapping tunable options to coordinate offsets. */
export interface AnchorRule {
  /** Tunable key to switch on. */
  key: string
  /** Anchor offset coordinate mapping per tunable value. */
  values: Record<string, { x: number; y: number }>
}

export interface DesignManifestEntry {
  id: string
  label: string
  tagline: string
  accent: string
  anchor?: { x: number; y: number }
  anchorRule?: AnchorRule
  /** Visual prominence flag in administration UI. */
  exclusive?: boolean
  /** Pack version string for cache-busting bundle URL. */
  version?: string
  schema: DesignControl[]
  /** Baseline default values merged with design-specific overrides. */
  defaults?: Tunables
}

export interface StoredConfig {
  design: string
  designs: Record<string, Tunables>
  system: Record<string, string | number | boolean>
}

export interface AdminOpenPayload {
  config: StoredConfig
  designs: DesignManifestEntry[]
  prefs: Preferences
}

export interface DesignRuntime {
  tunables: Tunables
  reducedMotion: boolean
  /** Scaled animation duration in milliseconds. */
  openMs: number
  closeMs: number
}

export interface MenuViewProps extends DesignRuntime {
  options: TargetOption[]
  focus: number
  /** Token sequence counter triggering refusal feedback animation. */
  rejectToken: number
  phase: 'opening' | 'open' | 'closing'
  emptyLabel: string
}

export interface IndicatorViewProps extends DesignRuntime {
  state: IndicatorState
  /** Token sequence counter triggering indicator activation animation. */
  activateToken: number
}

export interface CursorViewProps extends DesignRuntime {}

/** Dynamic web font declaration for design packs. */
export interface DesignFont {
  /** Tunable key selecting this font family. */
  key: string
  /** CSS font stack string. */
  stack: string
  /** Stylesheet URL to inject dynamically if not already loaded. */
  href?: string
}

/** Design pack component module definition interface. */
export interface DesignModule {
  id: string
  /** Target SDK version supported by design module. */
  sdk: number
  Menu: React.ComponentType<MenuViewProps>
  Indicator: React.ComponentType<IndicatorViewProps>
  Cursor: React.ComponentType<CursorViewProps>
  /** Dynamic web typography definitions registered by design module. */
  fonts?: DesignFont[]
}
