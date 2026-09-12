Input = {}

local keybindRegistered = false

function Input.register()
  if keybindRegistered then return end
  keybindRegistered = true

  lib.addKeybind({
    name = 'osm_target',
    description = Locale('toggle_targeting'),
    defaultKey = Config.Input.key,
    defaultMapper = 'keyboard',

    -- Optional pad binding. nil leaves the keybind keyboard-only, exactly as it
    -- was; ox_lib wants the mapper and the key together, so both are nil or
    -- neither is. Players can rebind it in FiveM's own keybind settings either
    -- way -- this only decides what it starts as.
    secondaryMapper = Config.Input.padKey and 'PAD_DIGITALBUTTONANY' or nil,
    secondaryKey = Config.Input.padKey or nil,

    onPressed = function()
      if Config.Input.mode == 'toggle' then
        if Machine.isActive() then
          Machine.stop()
        else
          Machine.start()
        end
        return
      end

      Machine.start()
    end,

    onReleased = function()
      if Config.Input.mode == 'toggle' then return end
      Machine.stop()
    end,
  })
end

local DisableControlAction = DisableControlAction
local DisablePlayerFiring = DisablePlayerFiring

function Input.suppress()
  DisablePlayerFiring(cache.playerId, true)

  local list = Config.Input.suppress
  for i = 1, #list do
    DisableControlAction(0, list[i], true)
  end
end

local IsControlJustPressed = IsControlJustPressed
local IsDisabledControlJustPressed = IsDisabledControlJustPressed

---A control id, or a list of them. The list is what makes one action answer to
---both a mouse and a pad without the caller knowing which device is in the
---player's hands: the scroll wheel and the d-pad mean the same thing here, and
---GTA gives them different ids because they are different devices, not
---different intents.
---@param control number | number[]
local function pressed(control)
  if type(control) == 'table' then
    for i = 1, #control do
      if pressed(control[i]) then return true end
    end
    return false
  end

  return IsControlJustPressed(0, control) or IsDisabledControlJustPressed(0, control)
end

---Get scroll input direction: return -1 for up, 1 for down, or 0 for idle.
---@return -1 | 0 | 1
function Input.scrollDelta()
  if pressed(Config.Input.scrollUp) then return -1 end
  if pressed(Config.Input.scrollDown) then return 1 end
  return 0
end

function Input.confirmPressed()
  return pressed(Config.Input.confirm)
end

---Check cancel input. INPUT_FRONTEND_CANCEL (Backspace / B on a pad) used to be
---hardcoded here; it is in Config.Input.cancel's list now, alongside the right
---click, so every control this reads is declared in one place.
function Input.cancelPressed()
  return pressed(Config.Input.cancel)
end
