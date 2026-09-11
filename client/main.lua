CreateThread(function()
  -- Initialize client state: wait for ox_lib point grid and cache readiness
  Wait(0)

  Nui.loadPrefs()
  Input.register()

  -- Pre-warm DUI surfaces: initialize browsers asynchronously in background
  SetTimeout(8000, function()
    if not Surfaces.isReady() then Surfaces.init() end
  end)

  -- Client console stays silent unless diagnostics are enabled in config.lua
  if Config.Debug then
    print(('^2[osm-target] ready (framework: %s, design: %s)^7')
      :format(Bridge.Framework, Appearance.design))
  end
end)

-- Clean up runtime resources: destroy DUI instances and reset state on resource stop
AddEventHandler('onResourceStop', function(resource)
  if resource ~= GetCurrentResourceName() then return end

  Machine.abort()
  Surfaces.destroy()
  SetNuiFocus(false, false)
end)

-- Invalidate cached player state: refresh player state on client resource start
AddEventHandler('onClientResourceStart', function(resource)
  if resource ~= GetCurrentResourceName() then return end
  Bridge.InvalidatePlayerState()
end)
