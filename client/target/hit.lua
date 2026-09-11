local Resolver = OsmTargetResolver

Hit = {}

local FLAGS = 511      -- INCLUDE_ALL
local IGNORE = 4       -- NO_COLLISION

---Scan interaction raycast: perform camera raycast to detect targeted entity.
---@return table? target
function Hit.scan()
  local origin = GetEntityCoords(cache.ped)
  local hit, entity, coords = lib.raycast.fromCamera(FLAGS, IGNORE, Config.Interaction.raycastDistance)
  local distance = #(origin - coords)

  local entityType, model, offset = 0, nil, nil

  if entity and entity ~= 0 then
    local ok, result = pcall(GetEntityType, entity)
    entityType = ok and result or 0

    if entityType > 0 then
      local okModel, resultModel = pcall(GetEntityModel, entity)
      model = okModel and resultModel or nil
      if coords then
        local okOffset, resultOffset = pcall(GetOffsetFromEntityGivenWorldCoords, entity, coords.x, coords.y, coords.z)
        offset = okOffset and resultOffset or nil
      end
    else
      entity = 0
    end
  end

  return {
    hit = hit,
    entity = entity or 0,
    entityType = entityType,
    model = model,
    coords = coords,
    offset = offset,
    distance = distance,
  }
end

local BONE_TOLERANCE = 2.0

---Create spatial attachment evaluator: verify bone or model offset matching for hit target.
function Hit.makeSpatial(target)
  local entity = target.entity
  local endCoords = target.coords
  if entity and entity ~= 0 and DoesEntityExist(entity) and target.offset then
    local ok, worldCoords = pcall(GetOffsetFromEntityInWorldCoords, entity, target.offset.x, target.offset.y, target.offset.z)
    if ok and worldCoords then endCoords = worldCoords end
  end

  return function(option)
    if entity == 0 then return false end

    if option.bones then
      local bones = option.bones
      if type(bones) == 'string' then bones = { bones } end

      local bestId, bestDistance
      for i = 1, #bones do
        local boneId = GetEntityBoneIndexByName(entity, bones[i])
        if boneId ~= -1 then
          local distance = #(endCoords - GetEntityBonePosition_2(entity, boneId))
          if distance <= BONE_TOLERANCE and (not bestDistance or distance < bestDistance) then
            bestId, bestDistance = boneId, distance
          end
        end
      end

      if not bestId then return false end
      if not option.offset then return true, bestId end
    end

    if option.offset then
      if not target.model then return false end

      local offset = option.offset
      if not option.absoluteOffset then
        local minimum, maximum = GetModelDimensions(target.model)
        offset = (maximum - minimum) * offset + minimum
      end

      local world = GetOffsetFromEntityInWorldCoords(entity, offset.x, offset.y, offset.z)
      if #(endCoords - world) > (option.offsetSize or 1.0) then return false end
    end

    return true
  end
end

---Create interaction predicate runner: execute canInteract safely within pcall wrapper.
function Hit.makeInteract(target)
  local coords = target.coords
  if target.entity and target.entity ~= 0 and DoesEntityExist(target.entity) and target.offset then
    local ok, worldCoords = pcall(GetOffsetFromEntityInWorldCoords, target.entity, target.offset.x, target.offset.y, target.offset.z)
    if ok and worldCoords then coords = worldCoords end
  end

  return function(option, distance, bone)
    local ok, allowed, reason = pcall(option.canInteract,
      target.entity ~= 0 and target.entity or nil, distance, coords, option.name, bone)
    if not ok then return false end
    return allowed, reason
  end
end

---Build resolution context: assemble player state, spatial checker, and interaction runner.
function Hit.context(target, menu)
  local coords = target.coords
  if target.entity and target.entity ~= 0 and DoesEntityExist(target.entity) and target.offset then
    local ok, worldCoords = pcall(GetOffsetFromEntityInWorldCoords, target.entity, target.offset.x, target.offset.y, target.offset.z)
    if ok and worldCoords then coords = worldCoords end
  end

  return {
    distance = target.distance,
    entity = target.entity ~= 0 and target.entity or nil,
    coords = coords,
    menu = menu,
    player = Player.state(),
    policy = Config.Options,
    spatial = Hit.makeSpatial(target),
    interact = Hit.makeInteract(target),
  }
end

---@return table[] resolved, table candidates
function Hit.resolve(target, menu)
  local candidates

  if target.zone then
    candidates = Store.candidatesForZone(target.zone, target.distance)
  else
    candidates = Store.candidatesForEntity(target.entity, target.entityType, target.model, target.distance)
  end

  return Resolver.resolve(candidates, Hit.context(target, menu)), candidates
end

---Calculate world anchor: resolve bone coordinate, model bounding center, or zone position.
---@return vector3
function Hit.anchor(target, resolved)
  if target.entity and target.entity ~= 0 and DoesEntityExist(target.entity) then
    if resolved then
      for i = 1, #resolved do
        local bone = resolved[i].bone
        if bone then
          return GetWorldPositionOfEntityBone(target.entity, bone)
        end
      end
    end

    return Discovery.entityAnchor(target.entity, target.model)
  end

  if target.zone then return target.zone.coords end

  return target.coords
end

---Calculate interaction distance: measure physical distance to bone, surface contact point, or anchor.
---@param target table
---@param anchor vector3?
---@param resolved table[]?
---@return number
function Hit.distance(target, anchor, resolved)
  local origin = GetEntityCoords(cache.ped)

  if resolved then
    for i = 1, #resolved do
      local bone = resolved[i].bone
      if bone and target.entity and target.entity ~= 0 and DoesEntityExist(target.entity) then
        local boneCoords = GetWorldPositionOfEntityBone(target.entity, bone)
        if boneCoords then return #(origin - boneCoords) end
      end
    end
  end

  if target.entity and target.entity ~= 0 and DoesEntityExist(target.entity) and target.offset then
    local ok, worldCoords = pcall(GetOffsetFromEntityInWorldCoords, target.entity, target.offset.x, target.offset.y, target.offset.z)
    if ok and worldCoords then
      return #(origin - worldCoords)
    end
  end

  if anchor then
    return #(origin - anchor)
  end

  if target.coords then
    return #(origin - target.coords)
  end

  return 0.0
end

---Calculate distance scale factor: compute non-linear scale multiplier based on target distance.
---@return number
function Hit.scaleFor(distance)
  local render = Config.Render
  if distance <= 0.01 then return render.scaleMax end

  local ratio = render.referenceDistance / distance
  local scale = ratio ^ render.scaleExponent

  if scale < render.scaleMin then return render.scaleMin end
  if scale > render.scaleMax then return render.scaleMax end
  return scale
end
