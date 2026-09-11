local Schema = OsmTargetSchema

local Compat = {}

---Wrap legacy canInteract predicate: adapt legacy (entity, distance, option) parameters to internal resolver.
local function wrapLegacyCanInteract(fn, option)
  if type(fn) ~= 'function' then return nil end
  return function(entity, distance, _coords, _name, _bone)
    local ok, reason = fn(entity, distance, option)
    return ok, reason
  end
end

---Clamp interaction distance: ensure option distance does not exceed container group distance.
local function clampDistance(optionDistance, groupDistance)
  if not groupDistance then return optionDistance end
  if not optionDistance or optionDistance > groupDistance then return groupDistance end
  return optionDistance
end

---Convert options to array: flatten single options, arrays, or maps into an ordered list.
---@return table[]
function Compat.toArray(options)
  if type(options) ~= 'table' then return {} end

  -- Handle single option table: wrap isolated table into array
  if options.label and Schema.tableType(options) == 'hash' then
    return { options }
  end

  local out = {}
  local named = {}
  local numbered = {}

  -- Process sequential array elements: preserve explicitly defined order
  for i = 1, #options do
    out[#out + 1] = options[i]
  end

  for k, v in pairs(options) do
    if type(k) == 'number' then
      -- Collect sparse numeric keys: sort and append after contiguous items
      if k > #options or k < 1 or k % 1 ~= 0 then
        numbered[#numbered + 1] = { key = k, value = v }
      end
    elseif type(v) == 'table' then
      named[#named + 1] = { key = k, value = v }
    end
  end

  table.sort(numbered, function(a, b) return a.key < b.key end)
  for i = 1, #numbered do
    out[#out + 1] = numbered[i].value
  end

  table.sort(named, function(a, b) return a.key < b.key end)
  for i = 1, #named do
    local entry = named[i]
    -- Assign default label/name: preserve map key as identifier if absent
    if entry.value.label == nil then entry.value.label = entry.key end
    if entry.value.name == nil then entry.value.name = entry.key end
    out[#out + 1] = entry.value
  end

  return out
end

---Normalize ox_target option: map fields to internal schema.
function Compat.fromOx(v, ctx)
  ctx = ctx or {}

  local option = {
    label = v.label,
    description = v.description,
    name = v.name or v.label,
    icon = v.icon,
    iconColor = v.iconColor or v.iconColour,
    badges = v.badges,
    distance = clampDistance(v.distance, ctx.distance),

    groups = v.groups,
    gangs = v.gangs,
    items = v.items,
    anyItem = v.anyItem,
    citizenid = v.citizenid,

    bones = v.bones,
    offset = v.offset,
    offsetSize = v.offsetSize,
    absoluteOffset = v.absoluteOffset,

    canInteract = v.canInteract,
    hideWhenIneligible = v.hideWhenIneligible,

    onSelect = v.onSelect,
    export = v.export,
    event = v.event,
    serverEvent = v.serverEvent,
    command = v.command,
    openMenu = v.openMenu,
    menuName = v.menuName,

    order = v.num,
    resource = ctx.resource,
    dialect = Schema.DIALECTS.ox,
  }

  return option
end

---Normalize qb-target option: map fields and handle qb-specific gates.
function Compat.fromQb(v, ctx)
  ctx = ctx or {}

  local option = {
    label = v.label,
    description = v.description,
    name = v.name or v.label,
    icon = v.icon,
    iconColor = v.iconColor or v.iconColour,
    distance = clampDistance(v.distance, ctx.distance),

    -- Maintain independent gates: evaluate job and gang requirements separately
    groups = v.job,
    gangs = v.gang,
    items = v.item or v.required_item or v.items,
    anyItem = v.anyItem,
    citizenid = v.citizenid,

    bones = ctx.bones or v.bones,
    offset = v.offset,
    offsetSize = v.offsetSize,

    hideWhenIneligible = v.hideWhenIneligible,

    order = v.num,
    resource = ctx.resource,
    dialect = Schema.DIALECTS.qb,
    qb = true,
  }

  option.canInteract = wrapLegacyCanInteract(v.canInteract, v)

  -- Map action callback: preserve legacy raw entity parameter passing
  if type(v.action) == 'function' then
    option.onSelect = v.action
  end

  local kind = v.type
  if v.event then
    if kind == 'server' then
      option.serverEvent = v.event
    elseif kind == 'command' then
      option.command = v.event
    elseif kind == 'qbcommand' then
      option.qbCommand = v.event
    else
      option.event = v.event
    end
  end

  return option
end

---Normalize qtarget option: map fields and handle qtarget-specific gates.
function Compat.fromQtarget(v, ctx)
  ctx = ctx or {}

  local option = {
    label = v.label,
    description = v.description,
    name = v.name or v.label,
    icon = v.icon,
    iconColor = v.iconColor or v.iconColour,
    distance = clampDistance(v.distance, ctx.distance),

    groups = v.job,
    gangs = v.gang,
    items = v.item or v.required_item or v.items,
    anyItem = v.anyItem,
    citizenid = v.citizenid,

    bones = ctx.bones or v.bones,
    offset = v.offset,
    offsetSize = v.offsetSize,

    hideWhenIneligible = v.hideWhenIneligible,

    order = v.num,
    resource = ctx.resource,
    dialect = Schema.DIALECTS.qtarget,
    qtarget = true,
  }

  option.canInteract = wrapLegacyCanInteract(v.canInteract, v)

  if type(v.action) == 'function' then
    option.onSelect = v.action
  end

  if v.event then
    if v.type == 'server' then
      option.serverEvent = v.event
    elseif v.type == 'command' then
      option.command = v.event
    elseif v.type == 'qbcommand' then
      option.qbCommand = v.event
    else
      option.event = v.event
    end
  end

  return option
end

local CONVERTERS = {
  ox = Compat.fromOx,
  qb = Compat.fromQb,
  qtarget = Compat.fromQtarget,
}

---Normalize option list: parse and convert options for given dialect.
---@param options table  array | single option | hashmap of options
---@param dialect 'ox' | 'qb' | 'qtarget'
---@param ctx { resource: string?, distance: number?, bones: any? }?
---@return table[] internal options
function Compat.normalise(options, dialect, ctx)
  local convert = CONVERTERS[dialect or 'ox'] or Compat.fromOx
  local list = Compat.toArray(options)
  local out = {}

  for i = 1, #list do
    local v = list[i]
    if type(v) == 'table' and v.label ~= nil then
      local option = convert(v, ctx)
      option.index = #out + 1
      out[#out + 1] = option
    end
  end

  -- Apply explicit slot ordering: sort options by num property when present
  local reordered = false
  for i = 1, #out do
    if out[i].order then reordered = true break end
  end

  if reordered then
    table.sort(out, function(a, b)
      local ao = a.order or (a.index + 1000)
      local bo = b.order or (b.index + 1000)
      if ao == bo then return a.index < b.index end
      return ao < bo
    end)
    for i = 1, #out do out[i].index = i end
  end

  return out
end

---Unwrap parameter tables: extract options and context metadata.
---@return table options, table ctx
function Compat.unwrapParameters(parameters, resource, fallbackDistance)
  parameters = parameters or {}
  local options = parameters.options or parameters
  local distance = parameters.distance or fallbackDistance
  return options, { resource = resource, distance = distance }
end

OsmTargetCompat = Compat
return Compat
