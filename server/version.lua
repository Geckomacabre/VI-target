local ENDPOINT = 'https://raw.githubusercontent.com/OsmFX-Mods/osm-target/main/version.json'

local function parse(version)
  local parts = {}
  for chunk in tostring(version):gmatch('%d+') do
    parts[#parts + 1] = tonumber(chunk)
  end
  return parts
end

---Compare version numbers: return true if candidate is newer than installed.
---@return boolean
local function isNewer(candidate, installed)
  local a, b = parse(candidate), parse(installed)
  for i = 1, math.max(#a, #b) do
    local left, right = a[i] or 0, b[i] or 0
    if left ~= right then return left > right end
  end
  return false
end

-- Perform version check: query GitHub repository for updated release version
CreateThread(function()
  if not Config.VersionCheck then return end
  Wait(5000)

  local installed = GetResourceMetadata(GetCurrentResourceName(), 'version', 0) or '0.0.0'

  PerformHttpRequest(ENDPOINT, function(status, body)
    if status ~= 200 or not body then return end

    local ok, decoded = pcall(json.decode, body)
    if not ok or type(decoded) ~= 'table' or not decoded.version then return end

    if isNewer(decoded.version, installed) then
      print(('^3[osm-target] ' .. Locale('version_outdated') .. '^7'):format(decoded.version, installed))
      if decoded.url then print(('^3[osm-target] %s^7'):format(decoded.url)) end
    end
  end, 'GET')
end)
