-- Static configuration for osm-target.
-- Visual appearance settings are managed via the in-game admin panel (/targetadmin).

Config = {}

Config.Locale = 'en'

-- Framework selection: 'auto' | 'qbox' | 'qbcore' | 'esx' | 'ox' | 'standalone'
Config.Framework = 'auto'

-- Diagnostic overlay: toggle in-world debug visuals and resolver logs.
Config.Debug = false

-- Version check: check GitHub for newer release notices on startup.
Config.VersionCheck = true

-- Admin permission: ACE permission required for admin panel access.
Config.AcePermission = 'osm_target.admin'

Config.Commands = {
  admin = 'targetadmin',   -- Open server-wide appearance and system configuration panel
  prefs = 'targetui',      -- Open player accessibility preferences
  debug = 'targetdebug',   -- Toggle in-world diagnostics overlay
  test = 'targettest',     -- Spawn test ped with sample options

  -- Diagnostic commands: only answer while diagnostics are enabled (/targetdebug)
  explain = 'targetexplain', -- Print resolver verdicts for the entity under the crosshair
  bench = 'targetbench',     -- Benchmark world anchor calculation paths
}

Config.Input = {
  -- Keybinding: default activation key for ox_lib keybind
  key = 'LMENU',

  -- Controller binding for the same action, as an input-mapper parameter id
  -- (docs.fivem.net/docs/game-references/input-mapper-parameter-ids/
  -- pad_digitalbuttonany/). nil leaves targeting keyboard-only.
  --
  -- Avoid LUP_INDEX and LDOWN_INDEX: the d-pad's up and down already move the
  -- focus through the list, via the frontend controls below. Both this and the
  -- keyboard key are rebindable by the player in FiveM's keybind settings, and
  -- like the keyboard key, a change here only takes effect next session --
  -- ox_lib registers the bind once, at start.
  padKey = 'LLEFT_INDEX',  -- D-pad left

  -- Interaction mode: 'hold' or 'toggle'
  mode = 'hold',

  -- Each of these is a control id or a list of them, so the same action answers
  -- to whichever device the player is holding. GTA gives the mouse wheel and
  -- the pad's menu controls different ids because they are different devices,
  -- not different intents -- Rockstar's own menus read them as one and the same
  -- (see clothes_shop's 188/187 pair, or the car meet grouping 241 with 188).
  confirm = { 24, 201 },      -- Left click (INPUT_ATTACK) / A-Cross (INPUT_FRONTEND_ACCEPT)
  cancel = { 25, 194 },       -- Right click (INPUT_AIM) / B-Circle (INPUT_FRONTEND_CANCEL)
  scrollUp = { 241, 188 },    -- Wheel up (INPUT_CURSOR_SCROLL_UP) / d-pad up (INPUT_FRONTEND_UP)
  scrollDown = { 242, 187 },  -- Wheel down / d-pad down (INPUT_FRONTEND_DOWN)

  -- Control suppression: disable weapon and vehicle cycling during interaction.
  -- Suppressing a control does not stop this resource reading it -- the input
  -- layer checks IsDisabledControlJustPressed too -- so the ids used above can
  -- safely appear here, and the pad ones need to: the d-pad and A are bound to
  -- game actions of their own that should not fire while a menu is up.
  suppress = {
    14, 15,          -- Weapon wheel next / prev
    16, 17,          -- Select next / prev weapon
    24, 25,          -- Attack / aim
    81, 82, 83, 84,  -- Vehicle radio and weapon cycling
    99, 100,         -- Vehicle select next / prev weapon
    115, 116,        -- Vehicle cycle weapon
    140, 141, 142,   -- Melee attacks
    187, 188,        -- Frontend up / down (d-pad, left stick)
    201,             -- Frontend accept (A / Cross)
    257, 263, 264,   -- Alternate attack controls
    331,             -- Vehicle radio wheel
  },
}

Config.Interaction = {
  -- Max distance: interaction range limit in meters
  distance = 7.0,

  -- Raycast length: camera raycast range in meters
  raycastDistance = 12.0,

  -- Scan rate: raycast interval in milliseconds while sweeping
  scanInterval = 50,

  -- Hysteresis thresholds: angular limits and hold duration for target lock stability
  snapAngle = 4.0,      -- Degrees: angle threshold to acquire target
  releaseAngle = 6.0,   -- Degrees: angle threshold to initiate release
  releaseTime = 180,    -- Milliseconds: duration beyond release angle before menu closes

  -- Animation timings: open and close transition durations in milliseconds
  openTime = 220,
  closeTime = 160,
}

Config.Indicators = {
  -- World markers: enable floating indicator markers on interactive points
  enabled = true,

  radius = 5.0,          -- Maximum indicator visibility radius in meters
  cap = 8,               -- Maximum visible indicators per frame
  discoveryInterval = 250, -- Interval in milliseconds between discovery passes

  -- Pool caching: scan nearby entity pools with distance padding
  scanInterval = 1000,
  scanSlack = 6.0,

  -- Near state threshold: angle to transition indicator to near-focused state
  nearAngle = 12.0,

  -- Global inclusion: whether global ped/vehicle/object options generate indicators
  includeGlobals = false,
}

Config.Render = {
  -- Sprite heights: fraction of screen height at reference distance
  menuSize = 0.40,
  indicatorSize = 0.042,
  cursorSize = 0.030,

  -- Distance scaling: non-linear scaling bounds for world-space sprites
  referenceDistance = 2.5,
  scaleExponent = 0.5,
  scaleMin = 0.75,
  scaleMax = 1.15,

  -- DUI texture resolution: dimensions for runtime textures
  menuResolution = 1024,
  indicatorResolution = 256,
  cursorResolution = 128,

  -- Vertical anchor offset: vertical adjustment in meters for menu placement
  anchorLift = 0.0,
}

Config.Options = {
  -- Disabled states: render ineligible options with requirement explanation
  showDisabled = true,

  -- Opaque gates: hide options that return false without an explanatory reason
  hideUnexplained = true,

  -- Default distance: fallback range in meters for options without distance
  defaultDistance = 7.0,

  -- Focus disabled: allow navigating to disabled options to inspect requirements
  focusDisabled = true,
}

-- Default vehicle interactions: register built-in vehicle door options (ox_target parity)
-- Matches ox_target's `setr ox_target:defaults 1`. Off, a plain car shows only
-- whatever third-party resources registered on it, which on most vehicles is
-- nothing at all. On, every vehicle carries four doors, the bonnet and the
-- trunk, each anchored to its own bone so it appears only when you look at it.
Config.Defaults = {
  vehicleDoors = true,
}

-- Default design: initial design fallback used before database sync or if selected pack is missing
Config.Design = 'rail'
