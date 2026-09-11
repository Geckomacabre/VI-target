-- QBCore (qb-core) client framework adapter
if Bridge.Framework ~= 'qbcore' then return end

local QBCore = exports['qb-core']:GetCoreObject()

local function playerData()
  return QBCore.Functions.GetPlayerData()
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

---Count inventory items: aggregate item quantity across player inventory slots.
function Adapter.GetItemCount(name)
  local data = playerData()
  local inventory = data and data.items
  if not inventory then return nil end

  local total = 0
  for _, slot in pairs(inventory) do
    if slot and slot.name == name then
      total = total + (slot.amount or slot.count or 0)
    end
  end
  return total
end

function Adapter.GetGroupLabel(name)
  local data = playerData()
  if data then
    if data.job and data.job.name == name then return data.job.label end
    if data.gang and data.gang.name == name then return data.gang.label end
  end
  local shared = QBCore.Shared
  if shared then
    if shared.Jobs and shared.Jobs[name] then return shared.Jobs[name].label end
    if shared.Gangs and shared.Gangs[name] then return shared.Gangs[name].label end
  end
  return nil
end

function Adapter.GetItemLabel(name)
  local items = QBCore.Shared and QBCore.Shared.Items
  local item = items and items[name]
  return item and (item.label or item.name) or nil
end

function Adapter.Notify(message, kind)
  QBCore.Functions.Notify(message, kind == 'inform' and 'primary' or kind)
end

-- Invalidate cache helper: call latest InvalidatePlayerState reference
local function invalidate() Bridge.InvalidatePlayerState() end

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', invalidate)
RegisterNetEvent('QBCore:Client:OnJobUpdate', invalidate)
RegisterNetEvent('QBCore:Client:OnGangUpdate', invalidate)
RegisterNetEvent('QBCore:Player:SetPlayerData', invalidate)
AddEventHandler('ox_inventory:itemCount', invalidate)

Bridge.Ready = true
