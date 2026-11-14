// Neon Breach palette: one night-district look, shared by every module.
// Six base colours plus the two team colours; nothing else picks a colour.
export const PALETTE = {
  sky: 0x0a0d16, // night sky / scene background
  fog: 0x0a0d16,
  asphalt: 0x171a21, // ground
  concrete: 0x2b2f3a, // walls, light grey-blue
  concreteDark: 0x1e222b, // crates, barriers
  steel: 0x3a4152, // containers, trims
  accentCyan: 0x2fd4ff, // BREACH team, neon signs, HUD accent
  accentMagenta: 0xff4d8d, // WARDEN team, warning neon
  amber: 0xffb454, // lamps, buy menu, plant site markers
  ink: 0xe8ecf2, // HUD text
  muted: 0x8b93a5, // secondary HUD text
  danger: 0xff5252, // low health, damage flash
  good: 0x59d98c, // round won, money gained
};

export const CSS = {
  accent: '#2fd4ff',
  magenta: '#ff4d8d',
  amber: '#ffb454',
  ink: '#e8ecf2',
  muted: '#8b93a5',
  danger: '#ff5252',
  good: '#59d98c',
  panel: 'rgba(10, 13, 22, 0.86)',
  hairline: 'rgba(232, 236, 242, 0.16)',
};
