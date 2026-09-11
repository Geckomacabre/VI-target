-- Qbox (qbx_core) client framework adapter
if Bridge.Framework ~= 'qbox' then return end

local function playerData()
  local ok, data = pcall(function() return exports.qbx_core:GetPlayerData() end)
  return ok and data or nil
end

function Adapter.GetGroups()
  local data = playerData()
  local job = data and data.job
  if not job or not job.name then return {} end
  return { [job.name] = job.grade and job.grade.level or 0 }
end

function Adapter.GetGangs()
  local data = playerData()
  local gang = data and data.gang
  if not gang or not gang.name then return {} end
  return { [gang.name] = gang.grade and gang.grade.level or 0 }
end

function Adapter.GetCitizenId()
  local data = playerData()
  return data and data.citizenid or nil
end

-- Item count fallback: handled via ox_inventory in init.lua
function Adapter.GetItemCount(_name) return nil end

function Adapter.GetGroupLabel(name)
  local data = playerData()
  if data then
    if data.job and data.job.name == name then return data.job.label end
    if data.gang and data.gang.name == name then return data.gang.label end
  end
  local ok, jobs = pcall(function() return exports.qbx_core:GetJobs() end)
  if ok and jobs and jobs[name] then return jobs[name].label end
  local okg, gangs = pcall(function() return exports.qbx_core:GetGangs() end)
  if okg and gangs and gangs[name] then return gangs[name].label end
  return nil
end

function Adapter.GetItemLabel(_name) return nil end

function Adapter.Notify(message, kind)
  exports.qbx_core:Notify(message, kind or 'inform')
end

-- Invalidate cache helper: call latest InvalidatePlayerState reference
local function invalidate() Bridge.InvalidatePlayerState() end

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', invalidate)
RegisterNetEvent('QBCore:Client:OnJobUpdate', invalidate)
RegisterNetEvent('QBCore:Client:OnGangUpdate', invalidate)
RegisterNetEvent('QBCore:Player:SetPlayerData', invalidate)
AddEventHandler('ox_inventory:itemCount', invalidate)

Bridge.Ready = true
