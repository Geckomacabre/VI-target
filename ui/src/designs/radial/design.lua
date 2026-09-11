---Radial Sweep design pack descriptor: defines metadata, schema tunables, and design defaults.
local Designs = OsmTargetDesigns

Designs.define {
  id = 'radial',
  sdk = 1,
  version = '1.0.0',
  label = 'Radial Sweep',
  tagline = 'Options fan along an arc anchored to the entity. Scroll rotates the arc through a fixed focus slot.',
  accent = '#14b8a6',
  -- Anchor coordinate: offset fraction relative to texture center
  anchor = { x = 0.34, y = 0.0 },
  -- Dynamic anchor positioning: adjust offset based on arc opening direction
  anchorRule = {
    key = 'arcSide',
    values = {
      right = { x = 0.34, y = 0.0 },
      left = { x = -0.34, y = 0.0 },
      up = { x = 0.0, y = -0.34 },
    },
  },
  schema = Designs.extend(Designs.commonSchema(), {
    -- Plate dimensions: maximum width for active label plate
    { key = 'plateWidth', label = 'Label plate width', type = 'number', default = 440, min = 300, max = 520, step = 10, group = 'Design', unit = 'px',
      tier = 'basic', affects = 'menu',
      help = 'Maximum width of the focused option label plate.' },
    { key = 'arcSide', label = 'Arc opens', type = 'select', default = 'right', group = 'Design',
      tier = 'basic', affects = 'menu',
      help = 'Opening direction for the radial fan arc.',
      options = { { value = 'right', label = 'Right' }, { value = 'left', label = 'Left' }, { value = 'up', label = 'Up' } } },
    -- Arc geometry: angular spread and radius from world anchor
    { key = 'arcSpan', label = 'Arc span', type = 'number', default = 210, min = 120, max = 300, step = 2, group = 'Design', unit = '°',
      tier = 'advanced', affects = 'menu',
      help = 'Angular span across which visible options are spread.' },
    { key = 'arcRadius', label = 'Arc radius', type = 'number', default = 230, min = 170, max = 280, step = 2, group = 'Design', unit = 'px',
      tier = 'advanced', affects = 'menu',
      help = 'Radial distance from target entity anchor.' },
    { key = 'neighbours', label = 'Visible neighbours', type = 'number', default = 3, min = 1, max = 5, step = 1, group = 'Design',
      tier = 'advanced', affects = 'menu',
      help = 'Number of neighbor option discs rendered on either side of focus.' },
    { key = 'spokes', label = 'Spoke ticks', type = 'boolean', default = true, group = 'Design',
      tier = 'advanced', affects = 'menu',
      help = 'Show spoke tick marks on inner arc.' },
    { key = 'hubRing', label = 'Hub ring', type = 'boolean', default = true, group = 'Design',
      tier = 'advanced', affects = 'menu',
      help = 'Render anchor ring marker at target coordinates.' },
  }),
  -- Design defaults: override baseline schema defaults
  overrides = {
    accent = '#14b8a6', indicatorStyle = 'ring', cursorStyle = 'reticle',
    corner = 14, gradient = 'radial', typeCase = 'normal',
  },
}
