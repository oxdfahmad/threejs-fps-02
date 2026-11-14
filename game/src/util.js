// Small shared helpers: a seeded RNG for deterministic captures, clamps and
// the vector math the hot loops use without allocating. No module here touches
// the DOM or the renderer; everything is pure numbers.
export function mulberry32(initial) {
  let a = initial >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Angle helpers keep yaw/pitch wrapped so turns never drift past +/-PI.
export function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function angleDelta(from, to) {
  return wrapAngle(to - from);
}

// Distance on the ground plane only; the map is flat, so y never matters here.
export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// A tiny reusable scratch object so raycasts and direction math in the hot
// loop never allocate a new THREE.Vector3 per frame.
export function makeScratch() {
  return { x: 0, y: 0, z: 0 };
}
