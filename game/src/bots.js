// WARDEN bots: five defenders with a real brain. Each bot has a role — two
// hold the sites, two roam the lanes, one watches mid — and a state machine:
// ROUTE (walk the waypoint graph), HOLD (watch an angle), ENGAGE (shoot what
// it sees), CHASE (push a sound or a glimpse), DEFUSE (run to a planted spike
// and channel the defuse). Vision is a range + angle + line-of-sight check;
// hearing is a radius around loud events. Shooting is hitscan with reaction
// time, per-shot accuracy that worsens with distance and target speed, and
// damage falloff — so a still, aiming player is punished and a strafing one
// survives longer.
import * as THREE from 'three';
import { clamp, dist2D, angleDelta, wrapAngle } from './util.js';

const BOT_RADIUS = 0.42;
const BOT_HEIGHT = 1.75;
const BOT_SPEED = 3.4;
const BOT_HEALTH = 100;
const VIEW_RANGE = 34;
const VIEW_HALF_ANGLE = 1.05; // ~60 degrees each side
const HEAR_RADIUS = 16;

const ROLES = [
  { role: 'holdA', site: 'A', holdNode: 13, patrol: [13, 10, 16] },
  { role: 'holdB', site: 'B', holdNode: 15, patrol: [15, 18, 5] },
  { role: 'roam', holdNode: 11, patrol: [11, 7, 8, 17, 12] },
  { role: 'roam', holdNode: 8, patrol: [8, 4, 7, 11, 17] },
  { role: 'mid', holdNode: 7, patrol: [7, 11, 4, 8] },
];

// Bot skins: a capsule body in team magenta, a darker visor head, a gun bar.
function buildBotMesh(scene, color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6, metalness: 0.4 });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x2fd4ff,
    emissive: 0x2fd4ff,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.95, 10), bodyMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), darkMat);
  head.position.y = 1.72;
  head.castShadow = true;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), visorMat);
  visor.position.set(0, 1.74, 0.22);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.7), darkMat);
  gun.position.set(0.28, 1.25, 0.3);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.55, 10), darkMat);
  legs.position.y = 0.28;
  group.add(torso, head, visor, gun, legs);
  // Tag meshes so the shooter's raycast can tell head from body.
  torso.userData.part = 'body';
  head.userData.part = 'head';
  visor.userData.part = 'head';
  legs.userData.part = 'legs';
  group.traverse((child) => {
    if (child.isMesh) child.userData.botMesh = true;
  });
  scene.add(group);
  return { group, torso, head, visor, gun, legs };
}

export function createBots(scene, world, random) {
  const bots = [];
  let idCounter = 0;

  function spawn(ally, index, spawnPoint, role) {
    const color = ally ? 0x2fd4ff : 0xff4d8d;
    const parts = buildBotMesh(scene, color);
    const bot = {
      id: idCounter,
      ally,
      name: ally ? `BREACH-${index + 1}` : `WARDEN-${index + 1}`,
      role: role.role,
      parts,
      position: { x: spawnPoint.x, y: 0, z: spawnPoint.z },
      yaw: spawnPoint.yaw,
      pitch: 0,
      health: BOT_HEALTH,
      alive: true,
      state: 'hold',
      route: [],
      routeIndex: 0,
      patrolIndex: 0,
      holdNode: role.holdNode,
      patrol: role.patrol,
      target: null, // {x, y, z, kind: 'player'|'bot', ref}
      lastSeenAt: -99,
      lastSeenPos: { x: 0, y: 0, z: 0 },
      aimError: 0,
      nextShotAt: 0,
      reactionAt: 0,
      heardAt: -99,
      heardPos: { x: 0, y: 0, z: 0 },
      defuseProgress: 0,
      speed: BOT_SPEED * (0.92 + random() * 0.16),
      skill: 0.55 + random() * 0.3, // accuracy multiplier
      bobPhase: random() * Math.PI * 2,
    };
    parts.group.traverse((child) => {
      if (child.isMesh) child.userData.bot = bot;
    });
    parts.group.position.set(spawnPoint.x, 0, spawnPoint.z);
    parts.group.rotation.y = spawnPoint.yaw;
    bots.push(bot);
    idCounter += 1;
    return bot;
  }

  function spawnRound(allyCount, enemyCount) {
    for (const bot of bots) scene.remove(bot.parts.group);
    bots.length = 0;
    idCounter = 0;
    const allySpawns = world.spawns.attacker;
    const enemySpawns = world.spawns.defender;
    for (let i = 0; i < allyCount; i += 1) {
      spawn(true, i, allySpawns[i % allySpawns.length], { role: 'ally', holdNode: 4, patrol: [4, 7, 8, 11] });
    }
    for (let i = 0; i < enemyCount; i += 1) {
      spawn(false, i, enemySpawns[i % enemySpawns.length], ROLES[i % ROLES.length]);
    }
    return bots;
  }

  function setRoute(bot, nodeIndex) {
    const from = world.nearestNode(bot.position.x, bot.position.z);
    bot.route = world.findPath(from, nodeIndex);
    bot.routeIndex = 0;
    bot.state = 'route';
  }

  // Vision: in range, inside the view cone, and a clear line of sight.
  function canSee(bot, tx, tz, ty = 1.4) {
    const dx = tx - bot.position.x;
    const dz = tz - bot.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > VIEW_RANGE) return false;
    const angleTo = Math.atan2(-dx, -dz);
    if (Math.abs(angleDelta(bot.yaw, angleTo)) > VIEW_HALF_ANGLE && distance > 3) return false;
    return world.hasLineOfSight(bot.position.x, bot.position.z, tx, tz);
  }

  function hear(bot, x, z, now) {
    if (dist2D(bot.position.x, bot.position.z, x, z) > HEAR_RADIUS) return;
    bot.heardAt = now;
    bot.heardPos.x = x;
    bot.heardPos.z = z;
  }

  function hearAll(x, z, now) {
    for (const bot of bots) if (bot.alive) hear(bot, x, z, now);
  }

  // Pick the nearest visible enemy: the player first, then ally bots.
  function acquireTarget(bot, player, now) {
    let best = null;
    let bestD = Infinity;
    if (player.alive && canSee(bot, player.position.x, player.position.z, player.position.y + player.eye)) {
      best = { kind: 'player', ref: player, x: player.position.x, y: player.position.y + player.eye, z: player.position.z };
      bestD = dist2D(bot.position.x, bot.position.z, player.position.x, player.position.z);
    }
    for (const other of bots) {
      if (!other.alive || other.ally === bot.ally) continue;
      const d = dist2D(bot.position.x, bot.position.z, other.position.x, other.position.z);
      if (d < bestD && canSee(bot, other.position.x, other.position.z, 1.4)) {
        best = { kind: 'bot', ref: other, x: other.position.x, y: 1.4, z: other.position.z };
        bestD = d;
      }
    }
    if (best) {
      if (!bot.target) bot.reactionAt = now + 0.35 + random() * 0.35;
      bot.target = best;
      bot.lastSeenAt = now;
      bot.lastSeenPos.x = best.x;
      bot.lastSeenPos.z = best.z;
    }
    return bot.target;
  }

  function moveToward(bot, tx, tz, dt, speedScale = 1) {
    const dx = tx - bot.position.x;
    const dz = tz - bot.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.15) return true;
    const step = Math.min(distance, bot.speed * speedScale * dt);
    bot.position.x += (dx / distance) * step;
    bot.position.z += (dz / distance) * step;
    const targetYaw = Math.atan2(-dx, -dz);
    bot.yaw += clamp(angleDelta(bot.yaw, targetYaw), -dt * 6, dt * 6);
    world.collideCircle(bot.position, BOT_RADIUS);
    return distance < 0.4;
  }

  // One fixed step for one bot. Returns shot events for main.js to resolve.
  function stepBot(bot, dt, now, player, spikePlanted, spikeSite) {
    if (!bot.alive) return [];
    const shots = [];

    // Planted spike: defenders abandon their posts and run to defuse.
    if (!bot.ally && spikePlanted && spikeSite) {
      if (bot.state !== 'defuse' && bot.state !== 'engage') {
        setRoute(bot, world.nearestNode((spikeSite.minX + spikeSite.maxX) / 2, (spikeSite.minZ + spikeSite.maxZ) / 2));
        bot.state = 'defuse';
      }
      if (bot.state === 'defuse' && bot.route.length === 0) {
        const cx = (spikeSite.minX + spikeSite.maxX) / 2;
        const cz = (spikeSite.minZ + spikeSite.maxZ) / 2;
        if (dist2D(bot.position.x, bot.position.z, cx, cz) < 1.6) {
          bot.defuseProgress += dt;
        }
      }
    }

    const target = acquireTarget(bot, player, now);
    if (target) {
      bot.state = 'engage';
      const dx = target.x - bot.position.x;
      const dz = target.z - bot.position.z;
      const targetYaw = Math.atan2(-dx, -dz);
      bot.yaw += clamp(angleDelta(bot.yaw, targetYaw), -dt * 8, dt * 8);
      // Fire once the reaction time has passed, on a steady cadence.
      if (now >= bot.reactionAt && now >= bot.nextShotAt) {
        const distance = Math.hypot(dx, dz);
        const targetSpeed = target.kind === 'player' ? Math.hypot(target.ref.velocity.x, target.ref.velocity.z) : 2.5;
        // Accuracy: closer and slower targets are easier; skill scales it.
        let spread = 0.02 + distance * 0.0016 + targetSpeed * 0.004;
        spread /= bot.skill;
        const damage = 24 * clamp(1 - distance / 90, 0.35, 1);
        shots.push({
          from: { x: bot.position.x, y: 1.45, z: bot.position.z },
          target,
          spread,
          damage,
          shooter: bot,
        });
        bot.nextShotAt = now + 0.55 + random() * 0.5;
      }
      // Strafe a little while engaging so bots are not statues.
      bot.bobPhase += dt * 2;
      const strafe = Math.sin(bot.bobPhase) * 0.6;
      const sideX = Math.cos(bot.yaw);
      const sideZ = -Math.sin(bot.yaw);
      bot.position.x += sideX * strafe * dt;
      bot.position.z += sideZ * strafe * dt;
      world.collideCircle(bot.position, BOT_RADIUS);
    } else if (now - bot.lastSeenAt < 2.5) {
      // Lost sight recently: push the last known position.
      bot.state = 'chase';
      moveToward(bot, bot.lastSeenPos.x, bot.lastSeenPos.z, dt, 1.1);
    } else if (now - bot.heardAt < 3 && bot.heardAt > 0) {
      bot.state = 'chase';
      if (moveToward(bot, bot.heardPos.x, bot.heardPos.z, dt, 1.05)) bot.heardAt = -99;
    } else if (bot.state === 'route' && bot.route.length > 0) {
      const node = world.nodes[bot.route[bot.routeIndex]];
      if (moveToward(bot, node.x, node.z, dt)) {
        bot.routeIndex += 1;
        if (bot.routeIndex >= bot.route.length) {
          bot.route = [];
          bot.state = 'hold';
        }
      }
    } else if (bot.state === 'hold' || bot.state === 'chase') {
      // Patrol: hold a while, then walk to the next patrol node.
      bot.patrolIndex = (bot.patrolIndex + 1) % bot.patrol.length;
      if (random() < 0.02) setRoute(bot, bot.patrol[bot.patrolIndex]);
      // Slowly scan the surroundings while holding.
      bot.yaw += Math.sin(now * 0.5 + bot.id) * dt * 0.35;
    }

    // Sync the mesh: position, facing, and a walk bob.
    const moving = bot.state === 'route' || bot.state === 'chase';
    const bob = moving ? Math.sin(now * 10 + bot.id) * 0.04 : 0;
    bot.parts.group.position.set(bot.position.x, bob, bot.position.z);
    bot.parts.group.rotation.y = bot.yaw;
    return shots;
  }

  function step(dt, now, player, spikePlanted, spikeSite) {
    const shots = [];
    for (const bot of bots) {
      shots.push(...stepBot(bot, dt, now, player, spikePlanted, spikeSite));
    }
    return shots;
  }

  function damage(bot, amount, part) {
    if (!bot.alive) return false;
    let dealt = amount;
    if (part === 'head') dealt *= 2.2;
    else if (part === 'legs') dealt *= 0.75;
    bot.health -= dealt;
    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.parts.group.visible = false;
    }
    return !bot.alive;
  }

  function aliveCount(ally) {
    return bots.filter((b) => b.alive && b.ally === ally).length;
  }

  function hitMeshes() {
    const meshes = [];
    for (const bot of bots) {
      if (!bot.alive) continue;
      meshes.push(bot.parts.torso, bot.parts.head, bot.parts.visor, bot.parts.legs);
    }
    return meshes;
  }

  return {
    bots,
    spawnRound,
    step,
    damage,
    aliveCount,
    hitMeshes,
    hearAll,
    get all() {
      return bots;
    },
  };
}
