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

local function pressed(control)
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

---Check cancel input: detect right click or backspace control press.
local FRONTEND_CANCEL = 194  -- INPUT_FRONTEND_CANCEL (Backspace / B)

function Input.cancelPressed()
  return pressed(Config.Input.cancel) or pressed(FRONTEND_CANCEL)
end
