# Neon Breach — a three.js tactical FPS

A round-based tactical shooter in the Counter-Strike style, built on
three.js 0.187.0 (vendored, no network requests). You are BREACH, attacking
the Neon District: plant the spike at site A or B, or eliminate all five
WARDEN defenders. First to 5 rounds takes the match.

## How to play

Open `game/index.html` from any static server (`node serve.ts` in the dev
folder serves it on http://localhost:8080) and click to play.

- **W A S D** move · **Mouse** look · **Click** fire · **R** reload
- **Shift** sprint · **Ctrl** crouch · **Space** jump
- **1 / 2 / 3** switch weapon · **G** throw a GL-4 frag grenade
- **E** (hold) plant the spike inside site A or B
- **B** buy menu during the buy phase · **Esc** pause

## The game

- **Gunplay** — three weapons (VK-9 pistol, AR-77 rifle, SG-12 shotgun),
  each with its own damage, fire rate, spread and recoil. Headshots deal
  bonus damage; firing on the move or in the air spreads shots wide, so
  stopping to aim pays. Ammo runs out; reloads take time.
- **Movement** — acceleration, friction, crouch and jump, with AABB
  collision against the map.
- **Bots** — five WARDEN defenders with roles (site holders, lane roamers,
  a mid watcher) that walk the waypoint graph, hold angles, react to what
  they see and hear, and converge to defuse a planted spike. Two BREACH
  allies fight beside you.
- **Tactics** — a plant/defuse objective, money earned per round and per
  kill, a buy menu (rifle, shotgun, grenade, kevlar), and a 2D minimap.
- **The map** — Neon District: two sites, a mid plaza with a neon kiosk,
  lanes, corners and long sightlines, lit by cold moonlight and neon.
- **Sound** — every effect is synthesised with WebAudio; no audio files.

## Layout

- `game/index.html` — the page, HUD and overlays
- `game/src/main.js` — boot, fixed 60 Hz simulation, shooting, round flow
- `game/src/world.js` — the Neon District map, colliders, waypoints
- `game/src/player.js` — movement, collision, health and armour
- `game/src/weapon.js` — the three guns and the viewmodel
- `game/src/bots.js` — WARDEN and BREACH bot AI
- `game/src/grenade.js` — GL-4 frag grenades
- `game/src/rounds.js` — rounds, economy, the spike
- `game/src/hud.js` — HUD, buy menu, kill feed, minimap
- `game/src/input.js` — keyboard, mouse, pointer lock
- `game/src/audio.js` — procedural WebAudio sounds
- `game/src/palette.js`, `game/src/util.js` — colours and shared helpers
- `main.ts` — hands the game in (copies game/ + screenshots/, writes dossier.json)

## Screenshots

Deterministic captures via URL query, same seed each time:

- `?shot=start&seed=1` — buy phase at the attacker spawn
- `?shot=play&seed=1` — mid-round firefight on the west lane
- `?shot=end&seed=1` — round won, scoreboard up
