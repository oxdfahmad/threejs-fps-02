// Weapons: three guns with different roles, plus the viewmodel that shows
// the one in hand. Damage, fire rate, spread, recoil and reload are per
// weapon; the caller (main.js) owns hit detection, this module owns the gun's
// own state and the numbers that make each gun feel different.
import * as THREE from 'three';
import { clamp } from './util.js';

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: "VK-9 'Sidekick'",
    kind: 'pistol',
    price: 0,
    damage: 34,
    headMultiplier: 2.6,
    fireInterval: 0.16,
    auto: false,
    magSize: 12,
    reserveMax: 48,
    reloadTime: 1.15,
    spreadBase: 0.011,
    spreadMove: 0.02,
    spreadAir: 0.05,
    recoilPitch: 0.011,
    recoilYaw: 0.004,
    pellets: 1,
    range: 60,
  },
  rifle: {
    id: 'rifle',
    name: "AR-77 'Vanta'",
    kind: 'rifle',
    price: 2700,
    damage: 33,
    headMultiplier: 3.0,
    fireInterval: 0.104,
    auto: true,
    magSize: 30,
    reserveMax: 90,
    reloadTime: 2.1,
    spreadBase: 0.006,
    spreadMove: 0.035,
    spreadAir: 0.07,
    recoilPitch: 0.014,
    recoilYaw: 0.006,
    pellets: 1,
    range: 90,
  },
  shotgun: {
    id: 'shotgun',
    name: "SG-12 'Riot'",
    kind: 'shotgun',
    price: 1500,
    damage: 11,
    headMultiplier: 2.0,
    fireInterval: 0.85,
    auto: false,
    magSize: 6,
    reserveMax: 24,
    reloadTime: 2.4,
    spreadBase: 0.035,
    spreadMove: 0.05,
    spreadAir: 0.08,
    recoilPitch: 0.05,
    recoilYaw: 0.02,
    pellets: 8,
    range: 26,
  },
};

// The catalogue the buy menu shows, in menu order.
export const BUY_CATALOGUE = [
  { key: 'Digit1', weapon: 'rifle', label: 'AR-77 Vanta rifle', desc: '30-round auto · best at range' },
  { key: 'Digit2', weapon: 'shotgun', label: 'SG-12 Riot shotgun', desc: '8 pellets · deadly up close' },
  { key: 'Digit3', item: 'grenade', label: 'GL-4 frag grenade', desc: 'Throwable explosive · $300' },
  { key: 'Digit4', item: 'armor', label: 'Kevlar vest', desc: '50 armour · absorbs 60% of hits' },
];

export function createWeapon(camera, audio) {
  const state = {
    current: 'rifle',
    mag: 30,
    reserve: 90,
    reloading: false,
    reloadEndsAt: 0,
    nextShotAt: 0,
    // Ammo is kept per weapon so switching back keeps what you had.
    stores: {
      pistol: { mag: 12, reserve: 48 },
      rifle: { mag: 30, reserve: 90 },
      shotgun: { mag: 6, reserve: 24 },
    },
    owned: { pistol: true, rifle: false, shotgun: false },
    spreadHeat: 0, // grows while firing, cools while idle: spray control.
  };

  // Viewmodel: a low-poly gun built from boxes, parented to the camera.
  const viewmodel = new THREE.Group();
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.5, metalness: 0.7 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x2fd4ff,
    roughness: 0.4,
    metalness: 0.4,
    emissive: 0x2fd4ff,
    emissiveIntensity: 0.5,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.55), gunMat);
  body.position.set(0.24, -0.22, -0.45);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), gunMat);
  barrel.position.set(0.24, -0.19, -0.8);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), gunMat);
  grip.position.set(0.24, -0.32, -0.28);
  grip.rotation.x = 0.35;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.08), accentMat);
  sight.position.set(0.24, -0.14, -0.55);
  viewmodel.add(body, barrel, grip, sight);
  viewmodel.userData.baseY = -0.22;
  camera.add(viewmodel);

  // Muzzle flash: a small additive plane that lives one frame.
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), flashMat);
  flash.position.set(0.24, -0.19, -0.98);
  viewmodel.add(flash);

  function def() {
    return WEAPONS[state.current];
  }

  function switchTo(id, now) {
    if (!state.owned[id] || state.current === id) return false;
    state.stores[state.current] = { mag: state.mag, reserve: state.reserve };
    state.current = id;
    const store = state.stores[id];
    state.mag = store.mag;
    state.reserve = store.reserve;
    state.reloading = false;
    state.nextShotAt = now + 0.25; // a short draw time
    state.spreadHeat = 0;
    viewmodel.visible = true;
    return true;
  }

  function buy(id) {
    if (state.owned[id]) return false;
    state.owned[id] = true;
    const store = state.stores[id];
    state.stores[state.current] = { mag: state.mag, reserve: state.reserve };
    state.current = id;
    state.mag = store.mag;
    state.reserve = store.reserve;
    return true;
  }

  function ready(now) {
    return !state.reloading && now >= state.nextShotAt;
  }

  // Current spread in radians: base + movement + air + heat from firing.
  function spread(moveSpeed, onGround, crouched) {
    const d = def();
    let spread = d.spreadBase;
    spread += d.spreadMove * clamp(moveSpeed / 6.4, 0, 1);
    if (!onGround) spread += d.spreadAir;
    if (crouched) spread *= 0.7;
    spread += state.spreadHeat;
    return spread;
  }

  function takeRound(now) {
    if (!ready(now)) return false;
    if (state.mag <= 0) {
      audio.dryFire();
      state.nextShotAt = now + 0.3;
      return false;
    }
    state.mag -= 1;
    state.nextShotAt = now + def().fireInterval;
    state.spreadHeat = Math.min(0.03, state.spreadHeat + def().kind === 'rifle' ? 0.0022 : 0.004);
    flashMat.opacity = 0.95;
    return true;
  }

  function reload(now) {
    const d = def();
    if (state.reloading || state.mag === d.magSize || state.reserve <= 0) return false;
    state.reloading = true;
    state.reloadEndsAt = now + d.reloadTime;
    audio.reload();
    return true;
  }

  function refillAll() {
    for (const id of Object.keys(state.stores)) {
      const d = WEAPONS[id];
      state.stores[id] = { mag: d.magSize, reserve: d.reserveMax };
    }
    const store = state.stores[state.current];
    state.mag = store.mag;
    state.reserve = store.reserve;
    state.reloading = false;
  }

  function step(dt, now) {
    // Spread heat cools when the trigger is off.
    state.spreadHeat = Math.max(0, state.spreadHeat - dt * 0.045);
    // Viewmodel bob and reload dip, purely visual.
    const bob = Math.sin(now * 9) * 0.004;
    viewmodel.position.y = bob + (state.reloading ? -0.09 : 0);
    viewmodel.rotation.x = state.reloading ? 0.35 : 0;
    flashMat.opacity = Math.max(0, flashMat.opacity - dt * 14);
    if (state.reloading && now >= state.reloadEndsAt) {
      const d = def();
      const needed = d.magSize - state.mag;
      const taken = Math.min(needed, state.reserve);
      state.mag += taken;
      state.reserve -= taken;
      state.reloading = false;
    }
  }

  return { state, def, switchTo, buy, ready, spread, takeRound, reload, refillAll, step, viewmodel };
}
