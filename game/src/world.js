// Neon District: the map. One flat arena, 64 x 44 metres, two bomb sites
// (A warehouse north-west, B market south-east), a mid plaza with a neon
// kiosk, and lanes that force real choices: long sightlines down mid, close
// corners around the sites. Everything is boxes; every box that blocks
// movement is an AABB collider, and only colliders taller than eye height
// block line of sight. No file is loaded: the ground texture is painted on a
// canvas at runtime and the skyline is geometry.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { dist2D } from './util.js';

const BOUNDS = { minX: -32, maxX: 32, minZ: -22, maxZ: 22 };
const EYE_BLOCK_HEIGHT = 1.4;

// Each entry: centre x/z, footprint w/d, height h, colour, optional emissive
// glow (neon trims) and a flag for crates the player can see over.
const BOXES = [
  // Perimeter walls.
  { x: 0, z: -22.5, w: 66, d: 1, h: 5, c: PALETTE.concrete },
  { x: 0, z: 22.5, w: 66, d: 1, h: 5, c: PALETTE.concrete },
  { x: -32.5, z: 0, w: 1, d: 46, h: 5, c: PALETTE.concrete },
  { x: 32.5, z: 0, w: 1, d: 46, h: 5, c: PALETTE.concrete },
  // Interior walls: each leaves a gap so every lane stays passable.
  { x: -20, z: -6, w: 8, d: 1, h: 4, c: PALETTE.concrete }, // A approach wall
  { x: 20, z: 6, w: 8, d: 1, h: 4, c: PALETTE.concrete }, // B approach wall
  { x: -12, z: 8, w: 1, d: 10, h: 4, c: PALETTE.concrete }, // west-mid divider
  { x: 12, z: -8, w: 1, d: 10, h: 4, c: PALETTE.concrete }, // east-mid divider
  { x: -16, z: -17, w: 1, d: 6, h: 4, c: PALETTE.concrete }, // A site wall
  { x: 16, z: 17, w: 1, d: 6, h: 4, c: PALETTE.concrete }, // B site wall
  // Mid kiosk: the neon heart of the map.
  { x: 0, z: 0, w: 8, d: 5, h: 3.5, c: PALETTE.steel, glow: PALETTE.accentCyan, glowH: 0.35 },
  // A-site containers.
  { x: -27, z: -16, w: 5, d: 2.2, h: 2.6, c: PALETTE.steel, glow: PALETTE.accentMagenta, glowH: 0.25 },
  { x: -19, z: -18, w: 2.2, d: 4, h: 2.6, c: PALETTE.concreteDark },
  // B-site stalls.
  { x: 27, z: 16, w: 5, d: 2.2, h: 2.6, c: PALETTE.steel, glow: PALETTE.amber, glowH: 0.25 },
  { x: 19, z: 18, w: 2.2, d: 4, h: 2.6, c: PALETTE.concreteDark },
  // Cover crates (low ones do not block sight).
  { x: -6, z: 12, w: 2, d: 2, h: 1.2, c: PALETTE.concreteDark },
  { x: 6, z: 12, w: 2, d: 2, h: 1.2, c: PALETTE.concreteDark },
  { x: -16, z: 4, w: 2.4, d: 2.4, h: 2.2, c: PALETTE.concreteDark },
  { x: 16, z: -4, w: 2.4, d: 2.4, h: 2.2, c: PALETTE.concreteDark },
  { x: -4, z: -4, w: 2, d: 2, h: 1.2, c: PALETTE.concreteDark },
  { x: 4, z: 4, w: 2, d: 2, h: 1.2, c: PALETTE.concreteDark },
  { x: -28, z: -10, w: 2, d: 2, h: 1.2, c: PALETTE.concreteDark },
  { x: -20, z: -18, w: 2, d: 2, h: 1.2, c: PALETTE.concreteDark },
  { x: 28, z: 10, w: 2, d: 2, h: 1.2, c: PALETTE.concreteDark },
  { x: 20, z: 18, w: 2, d: 2, h: 1.2, c: PALETTE.concreteDark },
  { x: 0, z: -14, w: 3, d: 1.5, h: 1.2, c: PALETTE.concreteDark },
  { x: -10, z: -2, w: 2, d: 2, h: 2.2, c: PALETTE.concreteDark },
  { x: 10, z: 2, w: 2, d: 2, h: 2.2, c: PALETTE.concreteDark },
];

// Waypoint graph the bots walk. Nodes are hand-placed on open ground; edges
// are hand-checked so no route crosses a wall.
const NODES = [
  { x: 0, z: 18 }, // 0 attacker spawn
  { x: -10, z: 15 }, // 1
  { x: 10, z: 15 }, // 2
  { x: -18, z: 10 }, // 3 west lane
  { x: 0, z: 10 }, // 4 mid south
  { x: 18, z: 10 }, // 5 east lane
  { x: -26, z: 2 }, // 6 west mid
  { x: -8, z: 2 }, // 7 mid west
  { x: 8, z: 2 }, // 8 mid east
  { x: 24, z: 2 }, // 9 east mid
  { x: -26, z: -8 }, // 10 A south
  { x: 0, z: -8 }, // 11 mid north
  { x: 24, z: -8 }, // 12 north east
  { x: -24, z: -14 }, // 13 site A
  { x: 0, z: -18 }, // 14 defender spawn
  { x: 24, z: 14 }, // 15 site B
  { x: -8, z: -11 }, // 16 A approach
  { x: 8, z: -14 }, // 17 north mid-east
  { x: 16, z: 6 }, // 18 B approach
  { x: -6, z: 14 }, // 19 spawn west pocket
  { x: 6, z: 14 }, // 20 spawn east pocket
];
const EDGES = [
  [0, 1], [0, 2], [0, 4], [0, 19], [0, 20],
  [1, 3], [1, 19], [2, 5], [2, 20],
  [3, 6], [4, 7], [4, 8], [5, 9],
  [6, 10], [7, 8], [7, 11], [8, 9], [8, 11],
  [9, 18], [10, 13], [10, 16], [11, 14], [11, 16], [11, 17],
  [12, 14], [12, 17], [13, 16], [14, 17], [15, 18], [15, 5],
  [16, 17], [17, 12], [18, 5],
];

function groundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#171a21';
  ctx.fillRect(0, 0, 256, 256);
  // Asphalt speckle.
  for (let i = 0; i < 900; i += 1) {
    const shade = 18 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgb(${shade},${shade + 3},${shade + 8})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // Faint paving grid.
  ctx.strokeStyle = 'rgba(232,236,242,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 11);
  return texture;
}

export function createWorld(scene) {
  const colliders = [];
  const tallColliders = [];
  const shootables = [];
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = new Map();

  function materialFor(color, emissive) {
    const key = `${color}:${emissive ?? 0}`;
    if (!materials.has(key)) {
      materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.85,
          metalness: 0.15,
          emissive: emissive ?? 0x000000,
          emissiveIntensity: emissive ? 0.9 : 0,
        }),
      );
    }
    return materials.get(key);
  }

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(66, 46),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  shootables.push(ground);

  // Site floor decals: a glowing outline on the ground marks each plant zone.
  function siteDecal(site, color) {
    const geo = new THREE.PlaneGeometry(site.maxX - site.minX, site.maxZ - site.minZ);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((site.minX + site.maxX) / 2, 0.02, (site.minZ + site.maxZ) / 2);
    scene.add(mesh);
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(site.minX, 0.03, site.minZ),
        new THREE.Vector3(site.maxX, 0.03, site.minZ),
        new THREE.Vector3(site.maxX, 0.03, site.maxZ),
        new THREE.Vector3(site.minX, 0.03, site.maxZ),
      ]),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
    );
    scene.add(edge);
  }

  for (const box of BOXES) {
    const mesh = new THREE.Mesh(boxGeometry, materialFor(box.c, box.glow));
    mesh.scale.set(box.w, box.h, box.d);
    mesh.position.set(box.x, box.h / 2, box.z);
    mesh.castShadow = box.h > 1.5;
    mesh.receiveShadow = true;
    scene.add(mesh);
    shootables.push(mesh);
    const collider = {
      minX: box.x - box.w / 2,
      maxX: box.x + box.w / 2,
      minZ: box.z - box.d / 2,
      maxZ: box.z + box.d / 2,
      h: box.h,
    };
    colliders.push(collider);
    if (box.h > EYE_BLOCK_HEIGHT) tallColliders.push(collider);
    // Neon trim along the top edge of glowing boxes.
    if (box.glow) {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(box.w + 0.06, box.glowH, box.d + 0.06),
        new THREE.MeshBasicMaterial({ color: box.glow }),
      );
      trim.position.set(box.x, box.h - box.glowH / 2, box.z);
      scene.add(trim);
    }
  }

  // Distant skyline: dark towers beyond the walls, a few lit windows.
  const skyline = new THREE.Group();
  const towerMat = new THREE.MeshBasicMaterial({ color: 0x11141d });
  const windowMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentCyan, transparent: true, opacity: 0.55 });
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  const winGeo = new THREE.PlaneGeometry(1, 0.5);
  const towerSpots = [
    [-48, -34, 14, 22], [48, -36, 18, 30], [-52, 10, 12, 16], [52, 8, 15, 24],
    [-40, 34, 16, 26], [42, 34, 13, 18], [-18, -42, 20, 34], [20, -42, 16, 28],
    [-60, -14, 10, 20], [60, -16, 12, 22],
  ];
  for (const [x, z, w, h] of towerSpots) {
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.scale.set(w, h, w);
    tower.position.set(x, h / 2, z);
    skyline.add(tower);
    const windows = new THREE.Mesh(winGeo, windowMat);
    windows.scale.set(w * 0.6, 1, 1);
    windows.position.set(x, h * 0.55, z + w / 2 + 0.05);
    skyline.add(windows);
  }
  scene.add(skyline);

  const sites = {
    A: { minX: -30, maxX: -17, minZ: -20, maxZ: -8, label: 'A' },
    B: { minX: 17, maxX: 30, minZ: 8, maxZ: 20, label: 'B' },
  };
  siteDecal(sites.A, PALETTE.accentMagenta);
  siteDecal(sites.B, PALETTE.amber);

  // Lighting: cold moonlight with soft shadows, warm lamps over each site.
  const hemi = new THREE.HemisphereLight(0x8fa3c7, 0x1a1410, 0.85);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xbfd4ff, 1.5);
  moon.position.set(-18, 30, -12);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -36;
  moon.shadow.camera.right = 36;
  moon.shadow.camera.top = 26;
  moon.shadow.camera.bottom = -26;
  moon.shadow.camera.far = 80;
  scene.add(moon);
  for (const [x, z, color] of [[-24, -14, 0xff4d8d], [24, 14, 0xffb454], [0, 18, 0x2fd4ff], [0, -18, 0xff4d8d]]) {
    const lamp = new THREE.PointLight(color, 18, 26, 1.8);
    lamp.position.set(x, 6, z);
    scene.add(lamp);
  }

  // Waypoint adjacency.
  const adjacency = NODES.map(() => []);
  for (const [a, b] of EDGES) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }

  return {
    bounds: BOUNDS,
    colliders,
    tallColliders,
    shootables,
    sites,
    spawns: {
      // Yaw 0 faces north (-z): attackers spawn south and look up the map;
      // defenders spawn north and look south (yaw PI).
      attacker: [
        { x: -4, z: 19, yaw: 0 },
        { x: 0, z: 19.5, yaw: 0 },
        { x: 4, z: 19, yaw: 0 },
      ],
      defender: [
        { x: -6, z: -19, yaw: Math.PI },
        { x: 0, z: -19.5, yaw: Math.PI },
        { x: 6, z: -19, yaw: Math.PI },
        { x: -12, z: -17, yaw: Math.PI },
        { x: 12, z: -17, yaw: Math.PI },
      ],
    },
    nodes: NODES,
    adjacency,
    nearestNode(x, z) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < NODES.length; i += 1) {
        const d = dist2D(x, z, NODES[i].x, NODES[i].z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    // Breadth-first route between two nodes; returns node indices.
    findPath(from, to) {
      if (from === to) return [from];
      const prev = new Array(NODES.length).fill(-1);
      const queue = [from];
      prev[from] = from;
      while (queue.length > 0) {
        const current = queue.shift();
        for (const next of adjacency[current]) {
          if (prev[next] !== -1) continue;
          prev[next] = current;
          if (next === to) {
            const path = [to];
            let node = to;
            while (node !== from) {
              node = prev[node];
              path.unshift(node);
            }
            return path;
          }
          queue.push(next);
        }
      }
      return [from, to];
    },
    inSite(x, z, site) {
      return x >= site.minX && x <= site.maxX && z >= site.minZ && z <= site.maxZ;
    },
    // Push a circle (player/bot) out of every collider it overlaps.
    collideCircle(pos, radius) {
      for (const c of colliders) {
        const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pushLeft = pos.x - c.minX + radius;
          const pushRight = c.maxX - pos.x + radius;
          const pushUp = pos.z - c.minZ + radius;
          const pushDown = c.maxZ - pos.z + radius;
          const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
          if (min === pushLeft) pos.x = c.minX - radius;
          else if (min === pushRight) pos.x = c.maxX + radius;
          else if (min === pushUp) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
      }
      pos.x = Math.max(BOUNDS.minX + radius, Math.min(BOUNDS.maxX - radius, pos.x));
      pos.z = Math.max(BOUNDS.minZ + radius, Math.min(BOUNDS.maxZ - radius, pos.z));
    },
    // 2D segment vs tall colliders: true when nothing tall stands between.
    hasLineOfSight(ax, az, bx, bz) {
      for (const c of tallColliders) {
        if (segmentHitsBox(ax, az, bx, bz, c)) return false;
      }
      return true;
    },
  };
}

// Slab test for a 2D segment against an AABB.
function segmentHitsBox(ax, az, bx, bz, box) {
  const dx = bx - ax;
  const dz = bz - az;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (ax < box.minX || ax > box.maxX) return false;
  } else {
    let t1 = (box.minX - ax) / dx;
    let t2 = (box.maxX - ax) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (az < box.minZ || az > box.maxZ) return false;
  } else {
    let t1 = (box.minZ - az) / dz;
    let t2 = (box.maxZ - az) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}
