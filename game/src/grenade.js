// GL-4 frag grenades: thrown on an arc, they bounce off walls and the floor,
// beep twice, then explode — area damage with falloff, a flash of light and
// a shockwave ring. One module owns every live grenade; main.js reads the
// explosion events it reports.
import * as THREE from 'three';

const GRAVITY = 14;
const FUSE = 1.6;
const BLAST_RADIUS = 6.5;
const BLAST_DAMAGE = 110;
const BOUNCE = 0.45;

export function createGrenades(scene) {
  const live = [];
  const ballGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const ballMat = new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.4, metalness: 0.8 });
  const ringGeo = new THREE.RingGeometry(0.3, 0.55, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffb454,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  function throwGrenade(from, direction, audio) {
    const mesh = new THREE.Mesh(ballGeo, ballMat);
    mesh.position.copy(from);
    scene.add(mesh);
    const ring = new THREE.Mesh(ringGeo, ringMat.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(from);
    ring.visible = false;
    scene.add(ring);
    live.push({
      mesh,
      ring,
      velocity: {
        x: direction.x * 13,
        y: direction.y * 13 + 4.5,
        z: direction.z * 13,
      },
      fuse: FUSE,
      beeped: false,
      exploded: false,
      ringAge: 0,
    });
    audio.beep();
  }

  // Returns explosion events {x, y, z, radius, damage} for main.js to apply.
  function step(dt, world, audio) {
    const events = [];
    for (let i = live.length - 1; i >= 0; i -= 1) {
      const g = live[i];
      if (g.exploded) {
        g.ringAge += dt;
        const t = g.ringAge / 0.6;
        if (t >= 1) {
          scene.remove(g.ring);
          live.splice(i, 1);
        } else {
          const scale = 1 + t * BLAST_RADIUS * 2;
          g.ring.scale.set(scale, scale, 1);
          g.ring.material.opacity = 0.85 * (1 - t);
        }
        continue;
      }
      g.fuse -= dt;
      if (g.fuse < 0.8 && !g.beeped) {
        g.beeped = true;
        audio.plantTick();
      }
      g.velocity.y -= GRAVITY * dt;
      const pos = g.mesh.position;
      pos.x += g.velocity.x * dt;
      pos.y += g.velocity.y * dt;
      pos.z += g.velocity.z * dt;
      // Floor bounce.
      if (pos.y < 0.09) {
        pos.y = 0.09;
        g.velocity.y = Math.abs(g.velocity.y) * BOUNCE;
        g.velocity.x *= 0.7;
        g.velocity.z *= 0.7;
      }
      // Wall bounce: reuse the map's circle collision, then reflect velocity.
      const before = { x: pos.x, z: pos.z };
      world.collideCircle(pos, 0.09);
      if (pos.x !== before.x) g.velocity.x = -g.velocity.x * BOUNCE;
      if (pos.z !== before.z) g.velocity.z = -g.velocity.z * BOUNCE;
      if (g.fuse <= 0) {
        g.exploded = true;
        g.ring.visible = true;
        g.ring.position.set(pos.x, 0.05, pos.z);
        scene.remove(g.mesh);
        audio.explosion();
        events.push({ x: pos.x, y: pos.y, z: pos.z, radius: BLAST_RADIUS, damage: BLAST_DAMAGE });
      }
    }
    return events;
  }

  function reset() {
    for (const g of live) {
      scene.remove(g.mesh);
      scene.remove(g.ring);
    }
    live.length = 0;
  }

  return { throwGrenade, step, reset, get count() { return live.length; } };
}
