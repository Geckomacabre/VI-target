# Interface Designs

**osm-target** ships with the **Radial Sweep** design out of the box. Additional premium designs are available as standalone add-on packs from [OsmFX Mods](https://osmfxmods.com).

Each design is packaged as a modular pack located within the `designs/` directory. See [Design Packs](./design-packs.md) for installation and management details.

The `/targetadmin` panel automatically enumerates currently installed designs. Tunable configurations are stored independently per design, preserving custom settings across design switches and pack reinstalls.

---

## 1. Radial Sweep (`radial`)

**Concept**: Options fan along a circular arc anchored directly to the targeted entity. Scrolling rotates the options through a fixed focus slot.

- **Focus Mechanics**: The active option expands into a full label plate displaying title, description, and requirements; neighboring options compress into compact icon discs that scale down with angular distance.
- **Key Tunables**:
  - `plateWidth`: Maximum width of the active label plate (300px–520px).
  - `arcSide`: Opening direction (`right`, `left`, `up`).
  - `arcSpan`: Angular spread of visible options (120°–300°).
  - `arcRadius`: Distance from the target anchor point (170px–280px).
  - `neighbours`: Number of visible neighbor discs rendered on each side.
  - `spokes` & `hubRing`: Detent tick marks and world hub anchor visibility.

---

## 2. Target VI (`targetvi`) — *Premium Pack*

**Concept**: Diegetic, panel-less design featuring high-contrast condensed typography placed directly in world space along a hairline rail.

- **Focus Mechanics**: Options are aligned along a minimalist dot rail. The focused row expands in scale and presents an action badge indicating the confirm button. Submenus display an explicit three-dot indicator badge.
- **Key Tunables**:
  - `fontFamily`: Condensed typeface selection (Barlow Semi Condensed, Saira Condensed, Oswald, Roboto Condensed, Archivo Narrow, Plus Jakarta Sans).
  - `listWidth`: Width of the text column before wrapping (320px–820px).
  - `visible`: Number of rows in view simultaneously (3–8).
  - `focusEmphasis`: Scale multiplier for the focused label (100%–140%).
  - `confirmGlyph`: Action badge graphic (`mouse`, `dot`, `none`).
  - `scrim` & `textOutline`: Soft background darkening and glyph keyline contrast.

Available at [osmfxmods.com](https://osmfxmods.com) and our [Discord](https://www.osmfxmods.com/discord).

---

## Text Fitting & Label Management

Because option labels originate from external scripts with varying lengths, text handling is fully configurable across all designs:

1. **Label Wrapping (`labelLines`)**: Under the **Typography** settings group, configure whether option text is restricted to a single line or allowed to wrap to 2 or 3 lines before applying truncation.
2. **Width Controls**: Each design provides a dedicated width control (`plateWidth`, `listWidth`, etc.) to accommodate server-specific label conventions.
3. **Texture Boundary Clipping**: Dimensions are automatically constrained within DUI canvas limits to prevent visual clipping.
