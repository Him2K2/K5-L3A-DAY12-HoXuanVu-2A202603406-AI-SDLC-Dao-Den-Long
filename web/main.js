// Playable 3D build. Drives the SAME deterministic Game class as the headless
// runner, at a fixed 60 Hz, so gameplay rules match what gets graded.
import * as THREE from "three";
import { Game } from "../src/core/game.js";
import { DT, ISLAND_RADIUS } from "../src/core/config.js";

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0718, 0.018);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- static world ---
// three r160 uses physical light units: keep ambient/hemisphere generous.
scene.add(new THREE.HemisphereLight(0x8090c0, 0x2f5d50, 1.6));
const moon = new THREE.DirectionalLight(0xaabbee, 1.2);
moon.position.set(-20, 40, -10);
scene.add(moon);

const island = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 3, 2, 64),
  new THREE.MeshStandardMaterial({ color: 0x2f5d50, roughness: 1 })
);
island.position.y = -1;
scene.add(island);

const matLantern = new THREE.MeshStandardMaterial({ color: 0x5b5f6e, emissive: 0x22242c });
const matLanternLit = new THREE.MeshStandardMaterial({ color: 0xffce7a, emissive: 0xff9f3a, emissiveIntensity: 1.4 });

let game, lanternMeshes, moteMeshes, shadeMeshes, playerGroup, lantGlows;
let camYaw = 0, acc = 0, lastT = performance.now(), running = true;

function buildWorld() {
  // Clear previous instance meshes.
  for (const g of scene.children.slice()) if (g.userData.dynamic) scene.remove(g);

  // Player: body + nón lá + tiny hanging lantern.
  playerGroup = new THREE.Group();
  playerGroup.userData.dynamic = true;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8d9b8 }));
  body.position.y = 0.8;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xc89b5a }));
  hat.position.y = 1.5;
  const lamp = new THREE.PointLight(0xffb347, 30, 14, 2);
  lamp.position.set(0.6, 1.2, 0);
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd27f, emissive: 0xffb347, emissiveIntensity: 2 }));
  lampBulb.position.copy(lamp.position);
  playerGroup.add(body, hat, lamp, lampBulb);
  scene.add(playerGroup);

  lanternMeshes = {}; lantGlows = {};
  for (const l of game.lanterns) {
    const grp = new THREE.Group(); grp.userData.dynamic = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 3, 10), matLantern.clone());
    post.position.y = 1.5;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), matLantern.clone());
    head.position.y = 3.3;
    const glow = new THREE.PointLight(0xff9f3a, 0, 22, 2);
    glow.position.y = 3.3;
    grp.add(post, head, glow);
    grp.position.set(l.x, 0, l.z);
    scene.add(grp);
    lanternMeshes[l.id] = head; lantGlows[l.id] = glow;
  }

  moteMeshes = game.motes.map((m) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff1c2, emissive: 0xffd27f, emissiveIntensity: 1.6 }));
    mesh.position.set(m.x, 0.8, m.z); mesh.userData.dynamic = true;
    scene.add(mesh); return mesh;
  });

  shadeMeshes = new Map();
}

function shadeMesh() {
  const grp = new THREE.Group(); grp.userData.dynamic = true;
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0),
    new THREE.MeshStandardMaterial({ color: 0x2b1a4d, emissive: 0x3a1f66, emissiveIntensity: 0.6, flatShading: true }));
  b.position.y = 1;
  grp.add(b);
  scene.add(grp);
  return grp;
}

function newGame() {
  game = new Game({ seed: (Math.random() * 1e9) | 0 });
  buildWorld();
  document.getElementById("overlay").classList.add("hidden");
  running = true;
}

// --- input ---
const keys = {};
const prevEdge = { jump: false, interact: false, pulse: false };
addEventListener("keydown", (e) => { keys[e.code] = true; if ([ "Space","ArrowLeft","ArrowRight" ].includes(e.code)) e.preventDefault(); });
addEventListener("keyup", (e) => { keys[e.code] = false; });
let dragging = false, lastX = 0;
renderer.domElement.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; });
addEventListener("pointerup", () => { dragging = false; });
addEventListener("pointermove", (e) => { if (dragging) { camYaw -= (e.clientX - lastX) * 0.3; lastX = e.clientX; } });

function gatherInput() {
  if (keys["ArrowLeft"]) camYaw += 2.2;
  if (keys["ArrowRight"]) camYaw -= 2.2;
  let x = 0, z = 0;
  if (keys["KeyW"]) z += 1;
  if (keys["KeyS"]) z -= 1;
  // Contract: move x=+1 at yaw 0 is world +X, which is screen-LEFT for a camera
  // looking down +Z. So screen-right (D) maps to x = -1.
  if (keys["KeyD"]) x -= 1;
  if (keys["KeyA"]) x += 1;
  const heldJump = !!keys["Space"];
  const heldInteract = !!keys["KeyE"];
  const heldPulse = !!(keys["ShiftLeft"] || keys["ShiftRight"] || keys["KeyQ"]);
  const inp = {
    move: [x, z], camYaw,
    jump: heldJump && !prevEdge.jump,
    interact: heldInteract && !prevEdge.interact,
    pulse: heldPulse && !prevEdge.pulse,
  };
  prevEdge.jump = heldJump; prevEdge.interact = heldInteract; prevEdge.pulse = heldPulse;
  return inp;
}

// --- HUD ---
const $ = (id) => document.getElementById(id);
function updateHUD() {
  const lit = game.lanterns.filter((l) => l.lit).length;
  $("hud-lanterns").textContent = `${lit}/${game.lanterns.length}`;
  $("hud-carried").textContent = String(game.player.carried);
  $("hud-flames").textContent = "●".repeat(Math.max(0, game.player.flames)) || "—";
  const t = Math.max(0, game.timeLeft);
  $("hud-time").textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  $("hud-score").textContent = String(game.score);
  const cd = game.pulseCooldown, cdMax = game.t.pulse_cooldown_s;
  $("pulse-fill").style.width = `${Math.max(0, 100 * (1 - cd / cdMax))}%`;
}

function endScreen() {
  const o = $("overlay");
  $("overlay-title").textContent = game.state === "won" ? "Đảo đã sáng!" : "Màn đêm thắng rồi";
  $("overlay-sub").textContent = `Điểm: ${game.score}`;
  o.classList.remove("hidden");
}
$("replay").addEventListener("click", newGame);

// --- render loop ---
function syncVisuals() {
  const p = game.player;
  playerGroup.position.set(p.x, p.y, p.z);
  const yawRad = (camYaw * Math.PI) / 180;
  const fwdX = Math.sin(yawRad), fwdZ = Math.cos(yawRad);
  playerGroup.rotation.y = Math.atan2(fwdX, fwdZ);

  moteMeshes.forEach((mesh, i) => {
    mesh.visible = game.motes[i].active;
    mesh.position.y = 0.8 + Math.sin(performance.now() * 0.004 + i) * 0.12;
  });
  for (const l of game.lanterns) {
    lanternMeshes[l.id].material = l.lit ? matLanternLit : matLantern;
    lantGlows[l.id].intensity = l.lit ? 120 : 0;
  }
  const seen = new Set();
  for (const s of game.shades) {
    seen.add(s.id);
    let m = shadeMeshes.get(s.id);
    if (!m) { m = shadeMesh(); shadeMeshes.set(s.id, m); }
    m.position.set(s.x, 0, s.z);
    m.children[0].material.emissiveIntensity = s.state === "stunned" ? 0.1 : 0.6;
    m.scale.setScalar(s.state === "stunned" ? 0.7 : 1);
  }
  for (const [id, m] of shadeMeshes) if (!seen.has(id)) { scene.remove(m); shadeMeshes.delete(id); }

  const camDist = 15, camHeight = 10;
  camera.position.set(p.x - fwdX * camDist, p.y + camHeight, p.z - fwdZ * camDist);
  camera.lookAt(p.x, p.y + 1.5, p.z);
}

function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  while (acc >= DT) {
    if (running && game.state === "playing") {
      game.step(gatherInput());
      if (game.state !== "playing") { running = false; endScreen(); }
    } else {
      gatherInput(); // keep camera responsive after game over
    }
    acc -= DT;
  }
  syncVisuals();
  updateHUD();
  renderer.render(scene, camera);
}

newGame();
requestAnimationFrame(frame);
