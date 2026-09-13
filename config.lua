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

  -- Controller binding for the same action, as a PAD_DIGITALBUTTONANY input
  -- parameter id. nil leaves targeting keyboard-only.
  --
  -- The ids are NOT the names they look like. The full valid set, from
  -- docs.fivem.net/docs/game-references/input-mapper-parameter-ids/
  -- pad_digitalbuttonany/ :
  --
  --   L1_INDEX     R1_INDEX      shoulder buttons
  --   L2_INDEX     R2_INDEX      triggers (pressed at half travel)
  --   L3_INDEX     R3_INDEX      stick presses
  --   LUP_INDEX    LDOWN_INDEX   d-pad up / down
  --   LLEFT_INDEX  LRIGHT_INDEX  d-pad left / right
  --   RUP_INDEX    Y / Triangle      RDOWN_INDEX   A / Cross
  --   RLEFT_INDEX  X / Square        RRIGHT_INDEX  B / Circle
  --   SELECT_INDEX START_INDEX   TOUCH_INDEX
  --
  -- An id outside that set does not fail: the mapper is DIGITALBUTTON*ANY*, so
  -- with nothing specific to bind, every button on the pad triggers the action.
  -- Input.register checks the name for that reason.
  --
  -- A shoulder button, not a trigger and not the d-pad, because on a pad both
  -- of those are already carrying the game: the triggers are accelerate and
  -- aim, and the d-pad is the radio while driving. Avoid LUP_INDEX/LDOWN_INDEX
  -- for the same reason the confirm list avoids the triggers -- up and down
  -- already move the focus through the list.
  --
  -- Both this and the keyboard key are rebindable by the player in FiveM's
  -- keybind settings, and like the keyboard key, a change here only takes
  -- effect next session: ox_lib registers the bind once, at start.
  padKey = 'L1_INDEX',  -- LB / L1

  -- Interaction mode: 'hold' or 'toggle'
  mode = 'hold',

  -- Split per device, not merged into one list, because a single GTA control id
  -- is a DIFFERENT physical button depending on what the player is holding.
  -- INPUT_ATTACK is a left click on a mouse and the right trigger on a pad --
  -- which is also accelerate, so reading it on a pad confirmed an option every
  -- time the player touched the throttle. INPUT_AIM is the left trigger, with
  -- the same problem on foot. Neither is read on a pad any more.
  --
  -- Each entry may still be a plain id or a list, which is read on any device.
  confirm = {
    kbm = { 24 },        -- Left click (INPUT_ATTACK)
    pad = { 201 },       -- A / Cross (INPUT_FRONTEND_ACCEPT)
  },
  cancel = {
    kbm = { 25, 194 },   -- Right click (INPUT_AIM), Backspace (INPUT_FRONTEND_CANCEL)
    pad = { 194 },       -- B / Circle
  },
  -- The pad's up and down are the d-pad and the left stick. Rockstar's own
  -- menus treat these and the wheel as one intent (clothes_shop pairs 188/187,
  -- the car meet groups 241 with 188), so they are the same action here too --
  -- just never read on the wrong device. Note the d-pad changes radio station
  -- while driving; the game does that, not this, and it is why activation sits
  -- on a shoulder button.
  scrollUp = {
    kbm = { 241 },       -- Wheel up (INPUT_CURSOR_SCROLL_UP)
    pad = { 188 },       -- D-pad / stick up (INPUT_FRONTEND_UP)
  },
  scrollDown = {
    kbm = { 242 },       -- Wheel down
    pad = { 187 },       -- D-pad / stick down (INPUT_FRONTEND_DOWN)
  },

  -- Direct multi-key prompt (1-2 option entities, e.g. a car door offering
  -- "Slim Jim" / "Smash Window"): each option in view gets its own entry from
  -- this pool, by position, so every option is its own independently and
  -- simultaneously pressable key instead of sharing one focus+confirm cursor.
  --
  -- Pad entries were left out for a long time because the only two
  -- *frontend-safe* pad buttons -- ones that do not already double as
  -- something else while free-aiming or driving -- looked like exactly the
  -- two INPUT_FRONTEND_ACCEPT/CANCEL already spent on confirm/cancel above.
  -- That undersold what "frontend-safe" actually rules out, though: GTA's
  -- control list (docs.fivem.net/docs/game-references/controls/) has TWO
  -- more buttons in the same INPUT_FRONTEND_* family as accept/cancel --
  --
  --   203  INPUT_FRONTEND_X   -- X (Xbox) / Square (PlayStation)
  --   204  INPUT_FRONTEND_Y   -- Y (Xbox) / Triangle (PlayStation)
  --
  -- -- neither used anywhere else in this table (confirm/cancel/scrollUp/
  -- scrollDown/padKey above, or suppress below), so they're free the same
  -- way 201/202 (accept/cancel) already were.
  --
  -- "Free" only covers the id itself, not the physical button behind it --
  -- exactly the INPUT_ATTACK/INPUT_AIM lesson from the confirm/cancel
  -- comment above. Physical X also carries INPUT_JUMP (22) on foot; physical
  -- Y also carries INPUT_ENTER (23, get in the nearest vehicle) and
  -- INPUT_VEH_EXIT (75, get out of one), plus INPUT_WEAPON_SPECIAL (53) and
  -- INPUT_DROP_WEAPON (56). INPUT_ENTER in particular would have bitten
  -- immediately: the flagship use of this very prompt is a car door, so a
  -- pad player pressing "Smash Window" would have also tried to get in the
  -- car normally. All five are now in Input.suppress below, closed off the
  -- same way INPUT_FRONTEND_ACCEPT (201) already is for confirm -- suppressed
  -- controls still reach Input.directKeyPressed via IsDisabledControlJustPressed,
  -- they just stop reaching the game underneath it.
  --
  -- L3/R3 (INPUT_FRONTEND_LS 209 / INPUT_FRONTEND_RS 210 -- also unused
  -- elsewhere) were the other candidate: their real-world collisions
  -- (INPUT_DUCK 36, INPUT_LOOK_BEHIND 26, INPUT_SPECIAL_ABILITY 28/29,
  -- INPUT_ACCURATE_AIM 50) are individually milder than jump/enter-vehicle
  -- and just as closeable via suppress. X/Y won out for a reason outside the
  -- input system entirely: this change is also what first draws real button
  -- art for a pad player instead of bare text (see BUTTON_ICONS in
  -- ui/src/designs/rail/index.tsx), and the art supplied for it only covers
  -- face buttons (Xbox X/Y/A/B, PlayStation Square/Triangle/Circle/Cross) --
  -- nothing for a stick click. Picking L3/R3 would have meant the exact
  -- players this change is for still seeing a generic fallback mark instead
  -- of a real button. That gap (no stick-click art yet) is real and worth
  -- closing later if a future change wants L3/R3 for something else, but it
  -- isn't a reason to leave pad off the direct prompt entirely when a
  -- fully-covered pair of buttons was available right now.
  --
  -- Still a config-level pool, not a per-option registration API: a caller
  -- cannot yet ask for "always bind Slim Jim to E specifically," only get
  -- whichever pool entry lines up with its position in the resolved list.
  -- See docs/design-packs.md / the README for why that's a documented
  -- follow-up rather than solved here.
  directOptionKeys = {
    { kbm = { 51 }, pad = { 203 } },  -- E (INPUT_CONTEXT) / X, Square (INPUT_FRONTEND_X)
    { kbm = { 47 }, pad = { 204 } },  -- G (INPUT_DETONATE) / Y, Triangle (INPUT_FRONTEND_Y)
  },

  -- Control suppression: disable weapon and vehicle cycling during interaction.
  -- Suppressing a control does not stop this resource reading it -- the input
  -- layer checks IsDisabledControlJustPressed too -- so the ids used above can
  -- safely appear here, and the pad ones need to: the d-pad and A are bound to
  -- game actions of their own that should not fire while a menu is up. Same
  -- reasoning for X and Y now that directOptionKeys uses them -- see the
  -- comment on that table for exactly which real actions 22/23/53/56/75
  -- share a physical button with.
  suppress = {
    14, 15,          -- Weapon wheel next / prev
    16, 17,          -- Select next / prev weapon
    22,              -- Jump (physical X, shared with direct-prompt option 1)
    23,              -- Enter vehicle (physical Y, shared with direct-prompt option 2)
    24, 25,          -- Attack / aim
    53,              -- Weapon special ability (physical Y)
    56,              -- Drop weapon (physical Y)
    75,              -- Exit vehicle (physical Y)
    81, 82, 83, 84,  -- Vehicle radio and weapon cycling
    99, 100,         -- Vehicle select next / prev weapon
    115, 116,        -- Vehicle cycle weapon
    140, 141, 142,   -- Melee attacks
    187, 188,        -- Frontend up / down (d-pad, left stick)
    201,             -- Frontend accept (A / Cross)
    203, 204,        -- Frontend X / Y (X-Square, Y-Triangle -- direct prompt options)
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
