# Compatibility Guide

**osm-target** provides comprehensive drop-in compatibility for existing FiveM targeting libraries. Existing resources designed for `ox_target`, `qb-target`, or `qtarget` function seamlessly without code modifications.

---

## Supported Dialects

All primary exports from supported targeting systems are implemented:

```lua
-- ox_target syntax
exports.ox_target:addLocalEntity(ped, { ... })

-- qb-target syntax
exports['qb-target']:AddBoxZone('bank_vault', coords, 1.5, 1.6, { ... }, { options = { ... } })

-- qtarget syntax
exports.qtarget:AddCircleZone('general_store', coords, 1.5, { ... }, { options = { ... } })
```

Dialect options are automatically parsed and translated into the unified internal schema by `shared/compat.lua`.

---

## Automatic Gate Resolution

Legacy options declaring requirements via `job`, `gang`, `groups`, `item`, `required_item`, or `items` automatically benefit from formatted requirement messages on disabled options:

```lua
-- Legacy declaration
options = {
    {
        label = 'Crack Safe',
        item = 'lockpick',
        action = function(entity) ... end
    }
}
```

When a player lacks the lockpick, the menu automatically renders a disabled entry stating: **Requires Lockpick**.

---

## Extended `canInteract` Signature

In addition to standard boolean returns, `canInteract` can return a custom reason string when rejecting an interaction:

```lua
canInteract = function(entity, distance, coords, name, bone)
    if GetVehicleEngineHealth(entity) > 900 then
        return false, 'Engine is not damaged'
    end
    return true
end
```

- Returning `false, 'Reason'` displays the option in a disabled state with the custom reason.
- Returning a bare `false` hides the option by default, preserving legacy target behavior. This default can be modified globally via `Config.Options.hideUnexplained = false` or per option via `hideWhenIneligible = false`.

---

## Icon Resolution & Fallbacks

- **Phosphor Icon Identifiers**: Direct icon names (`'lockpick'`, `'car'`, `'wrench'`, `'shield'`).
- **FontAwesome Classes**: Legacy FontAwesome classes (`'fas fa-car'`, `'fas fa-user-shield'`) are dynamically resolved through an internal alias map.
- **Fallbacks**: Unmapped icon references automatically render a neutral mark to ensure UI layout stability.

---

## Behavioral Notes

1. **Mouse Aiming**: osm-target utilizes mouse wheel scrolling for option selection and does not capture NUI focus during standard targeting interactions. `EnableNUI` and `DisableNUI` calls from legacy scripts are safely handled without interfering with mouse aim.
2. **PolyZone Shims**: `qb-target` zone creation functions return a lightweight zone shim supporting `:destroy()` and `:isPointInside(coords)`.
3. **Vertical Bounding**: `minZ` and `maxZ` bounds are mapped to true 3D bounding boxes to ensure vertical zoning accuracy.
