// Playable build: 3-night campaign driving the SAME deterministic Game as the headless runner.
import * as THREE from "three";
import { Game } from "../src/core/game.js";
import { DT } from "../src/core/config.js";
import { getMap } from "../src/core/maps.js";
import { World } from "./world.js";
import { Audio } from "./audio.js";
import { PAL } from "./palette.js";

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
document.getElementById("stage").appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.FogExp2(PAL.fog, 0.011);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- settings (persisted)
const SETTINGS_KEY = "ddl.settings.v1";
const settings = { volume: 0.7, sens: 1.0, colorBlind: false, camMode: "fp" }; // camMode: "fp" | "tp"
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch { /* private mode */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

const audio = new Audio();
audio.setVolume(settings.volume);

// ---------------------------------------------------------------- app state
const QUOTES = {
  1: "“Sương đen nuốt mất đèn của bến rồi, Mây ạ. Nhặt đom đóm, thắp lại năm ngọn đèn — thuyền đêm nay cần đường về.”",
  2: "“Hai hòn Cau cách nhau một nhịp cầu tre. Coi chừng Gió Lạc — tụi nó mê ánh sáng còn hơn con đấy.”",
  3: "“Tháp chuông là trái tim của quần đảo. Gió trên này dữ lắm, giữ chặt nón lá nghe con.”",
};
const app = {
  screen: "menu", // menu | intro | play | pause | settings | result | dawn
  settingsBack: "menu",
  night: 1,
  won: {}, // night -> score of won nights
  game: null,
  world: null,
  camYaw: 0,
  camPitch: 0, // degrees, view only (the sim only receives camYaw)
  lastSecond: null,
  warned: false,
};
window.__ddl = app; // inspection hook for debugging/evidence (read-only use)

const $ = (id) => document.getElementById(id);
const screens = ["menu", "intro", "pause", "settings", "result", "dawn"];
function show(screen) {
  app.screen = screen;
  for (const s of screens) $(`scr-${s}`).classList.toggle("hidden", s !== screen);
  $("hud").classList.toggle("hidden", !["play", "pause", "settings"].includes(screen) || !app.game);
  if (screen !== "play" && document.pointerLockElement) document.exitPointerLock();
}
const total = () => Object.values(app.won).reduce((a, b) => a + b, 0);

// TICKET-03 colour-blind palette: CSS (UI warning #FFFFFF + ⚠) and 3D (shade rim, lantern shapes).
function applyColorBlind() {
  document.body.classList.toggle("cb", !!settings.colorBlind);
  if (app.world) app.world.setColorBlind(!!settings.colorBlind);
}
applyColorBlind();

function loadNight(n) {
  if (app.world) app.world.dispose();
  app.night = n;
  app.game = new Game({ seed: (Math.random() * 2 ** 31) | 0, night: n });
  app.world = new World(scene, app.game);
  app.world.setColorBlind(!!settings.colorBlind);
  app.camYaw = 0;
  applyCamMode();
  app.lastSecond = null;
  app.warned = false;
  resetEdges();
  const map = getMap(n);
  $("intro-title").textContent = `Đêm ${n} — ${map.name}`;
  $("intro-quote").textContent = QUOTES[n];
  $("intro-meta").textContent = `${map.lanterns.length} Đèn Lồng Lớn · giữ ít nhất ${app.game.winNeed} đèn sáng tới bình minh · ${Math.round(app.game.timeLeft)} giây`;
  show("intro");
}

// ---------------------------------------------------------------- input
const keys = {};
const prev = { jump: false, interact: false, pulse: false, dash: false };
const resetEdges = () => { for (const k in keys) keys[k] = false; for (const k in prev) prev[k] = false; };
addEventListener("keydown", (e) => {
  if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
  if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) {
    if (app.screen === "play") return pause();
    if (app.screen === "pause") return resume();
  }
  if (e.code === "Enter" && app.screen === "intro") return beginPlay();
  if (e.code === "KeyV" && !e.repeat && app.screen === "play") {
    settings.camMode = settings.camMode === "fp" ? "tp" : "fp";
    saveSettings();
    applyCamMode();
    return;
  }
  keys[e.code] = true;
});
addEventListener("keyup", (e) => { keys[e.code] = false; });
addEventListener("blur", resetEdges);

// Mouse-look (first-person style): moving the mouse turns the view — yaw and pitch.
// Pointer lock is requested when play starts (a click), so the cursor never hits the screen edge.
const canvas = renderer.domElement;
const lockPointer = () => {
  if (canvas.requestPointerLock && document.pointerLockElement !== canvas) {
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed here */ }
  }
};
const PITCH = { fp: [-80, 80], tp: [-60, 25] };
canvas.addEventListener("mousedown", () => { if (app.screen === "play") lockPointer(); });
addEventListener("mousemove", (e) => {
  if (app.screen !== "play") return;
  const k = 0.15 * settings.sens; // degrees per pixel
  app.camYaw -= e.movementX * k;
  const [lo, hi] = PITCH[settings.camMode];
  app.camPitch = Math.max(lo, Math.min(hi, app.camPitch - e.movementY * k));
});
document.addEventListener("pointerlockchange", () => {
  // Browsers exit pointer lock on Esc without delivering the key: treat it as "pause".
  if (!document.pointerLockElement && app.screen === "play") pause();
});

function gatherInput() {
  if (keys.ArrowLeft) app.camYaw += 2.0 * settings.sens;
  if (keys.ArrowRight) app.camYaw -= 2.0 * settings.sens;
  let x = 0, z = 0;
  if (keys.KeyW || keys.ArrowUp) z += 1;
  if (keys.KeyS || keys.ArrowDown) z -= 1;
  // Contract: move x=+1 at yaw 0 is world +X = screen-LEFT for a camera looking down +Z.
  if (keys.KeyD) x -= 1;
  if (keys.KeyA) x += 1;
  const held = {
    jump: !!keys.Space,
    interact: !!keys.KeyE,
    pulse: !!(keys.KeyQ || keys.KeyF),
    dash: !!(keys.ShiftLeft || keys.ShiftRight),
  };
  const inp = { move: [x, z], camYaw: app.camYaw, pause: false };
  for (const k in held) { inp[k] = held[k] && !prev[k]; prev[k] = held[k]; }
  return inp;
}

// ---------------------------------------------------------------- flow
function beginPlay() {
  audio.unlock();
  audio.startMusic();
  audio.play("click");
  show("play");
  lockPointer(); // called from a click/Enter, so the browser allows it
}
function pause() { if (app.screen !== "play") return; show("pause"); }
function resume() { audio.play("click"); resetEdges(); show("play"); lockPointer(); }
function openSettings(back) {
  app.settingsBack = back;
  $("set-volume").value = Math.round(settings.volume * 100);
  $("set-sens").value = settings.sens;
  $("set-cb").checked = !!settings.colorBlind;
  updateSettingLabels();
  show("settings");
}
function updateSettingLabels() {
  $("lbl-volume").textContent = `${Math.round(settings.volume * 100)}%`;
  $("lbl-sens").textContent = `${(+settings.sens).toFixed(1)}×`;
}

function onGameOver(result) {
  const g = app.game;
  const lit = g.litCount(), n = g.lanterns.length;
  if (result === "won") {
    app.won[app.night] = g.score;
    audio.play("win");
    if (app.night === 3) {
      $("dawn-score").textContent = total();
      $("dawn-breakdown").textContent = [1, 2, 3].filter((k) => k in app.won).map((k) => `Đêm ${k}: ${app.won[k]}`).join(" · ");
      return show("dawn");
    }
    $("result-title").textContent = `Đêm ${app.night} — Bình minh đã tới!`;
    $("result-sub").textContent = `Giữ được ${lit}/${n} đèn sáng · Điểm Đêm này: ${g.score} · Tổng: ${total()}`;
    $("btn-next").classList.remove("hidden");
    $("btn-retry").classList.add("hidden");
  } else {
    audio.play("lose");
    const why = g.player.flames <= 0
      ? "Mây đã cạn Ngọn Lửa."
      : `Trời sáng nhưng chỉ còn ${lit}/${n} đèn sáng (cần ${g.winNeed}).`;
    $("result-title").textContent = "Màn đêm thắng rồi…";
    $("result-sub").textContent = `${why} Tổng điểm hiện tại: ${total()}`;
    $("btn-next").classList.add("hidden");
    $("btn-retry").classList.remove("hidden");
  }
  show("result");
}

const SOUND_FOR = {
  mote_picked: "pickup", lantern_lit: "lit", pulse: "pulse", player_hit: "hit", dash: "dash",
  shade_spawned: "spawn", charm_picked: "charm", drifter_steal: "steal",
  refuel: "refuel", lantern_out: "out", fuel_drain: "drain",
};

function simStep() {
  const g = app.game;
  const input = gatherInput();
  const wasGrounded = g.player.grounded;
  const events = g.step(input);
  if (input.jump && wasGrounded && !g.player.grounded) audio.play("jump");
  for (const e of events) {
    if (SOUND_FOR[e.name]) audio.play(SOUND_FOR[e.name]);
    if (e.name === "game_over") onGameOver(e.data.result);
  }
  // Countdown: one tick per second for the last 10 s.
  const s = Math.ceil(g.timeLeft);
  if (s <= 10 && s > 0 && s !== app.lastSecond) audio.play("tick");
  app.lastSecond = s;
  if (g.windWarning && !app.warned) audio.play("wind");
  app.warned = g.windWarning;
}

// ---------------------------------------------------------------- HUD
const flameSVG = (on) => `<svg viewBox="0 0 24 32" class="flame ${on ? "" : "off"}"><path d="M12 1C14 8 21 11 21 20a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 3 4 0-4 0-8 2-12z"/></svg>`;
let lastFlames = -1, lastCap = -1;
const cells = $("motebar");
const v3 = new THREE.Vector3();
const warnIcon = () => (settings.colorBlind ? "⚠ " : "");

function updateHUD() {
  const g = app.game, p = g.player;
  if (p.flames !== lastFlames) {
    $("hud-flames").innerHTML = Array.from({ length: g.t.flames }, (_, i) => flameSVG(i < p.flames)).join("");
    lastFlames = p.flames;
  }
  const t = Math.max(0, g.timeLeft);
  const timer = $("hud-time");
  const mmss = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  timer.textContent = t <= 30 ? warnIcon() + mmss : mmss;
  timer.classList.toggle("danger", t <= 30);
  const lit = g.litCount();
  $("hud-lanterns").textContent = `${lit}/${g.lanterns.length}`;
  $("hud-need").textContent = `cần ${g.winNeed}`;
  $("hud-need").classList.toggle("ok", lit >= g.winNeed);
  $("hud-score").textContent = String(total() + g.score);
  // Mote bar: one cell per unit of capacity (10..20), plus "carried / capacity".
  const cap = g.capacity;
  if (cap !== lastCap) {
    cells.innerHTML = Array.from({ length: cap }, () => '<span class="cell"></span>').join("") + '<span id="carry-text"></span>';
    lastCap = cap;
  }
  [...cells.querySelectorAll(".cell")].forEach((c, i) => c.classList.toggle("on", i < p.carried));
  $("carry-text").textContent = `${p.carried}/${cap}`;

  // Low-fuel warning for the weakest lit lantern under 30.
  let weakest = null;
  for (const l of g.lanterns) if (l.lit && g.fuelOut(l) < 30 && (!weakest || l.fuelU < weakest.fuelU)) weakest = l;
  const fw = $("fuel-warn");
  fw.classList.toggle("hidden", !weakest);
  if (weakest) fw.textContent = `${warnIcon()}Đèn ${weakest.id} sắp cạn dầu (${Math.floor(g.fuelOut(weakest))})`;

  const cd = (id, left, max, usable = true) => {
    const el = $(id);
    el.style.setProperty("--p", `${Math.round(100 * (1 - left / max))}%`);
    el.classList.toggle("ready", left === 0 && usable);
  };
  cd("cd-dash", p.charm > 0 ? 0 : p.dashCd, 90);
  cd("cd-pulse", p.pulseCd, 180, p.carried >= g.t.pulse_cost);
  $("charm-ind").classList.toggle("hidden", p.charm <= 0);
  $("charm-ind").textContent = `Bùa Gió ${Math.ceil(p.charm / 60)}s`;
  $("wind-warn").classList.toggle("hidden", !g.windWarning);

  // Interaction prompt: same eligibility as the core (unlit, or lit and not full); nearest wins.
  let near = null, nearD = Infinity;
  for (const l of g.lanterns) {
    if (l.lit && l.fuelU >= g.fuelMaxU) continue;
    const d = Math.hypot(l.x - p.x, l.z - p.z);
    if (d <= g.t.interact_radius && d < nearD) { near = l; nearD = d; }
  }
  const prompt = $("prompt");
  if (near) {
    prompt.textContent = near.lit
      ? `E — Châm dầu (${Math.floor(near.fuelU / 60)}/100)` // floor of the exact value: never shows 100 while refuelable
      : `E — ${near.everLit ? "Thắp lại" : "Nạp ánh sáng"} (${near.deposited}/${g._lightCost(near)})`;
    prompt.classList.remove("hidden");
  } else prompt.classList.add("hidden");

  // Off-screen arrow: nearest unlit lantern; if all are lit, the nearest weak (fuel < 30) one.
  let best = null, bestD = Infinity;
  const pickNearest = (pred) => {
    for (const l of g.lanterns) {
      if (!pred(l)) continue;
      const d = Math.hypot(l.x - p.x, l.z - p.z);
      if (d < bestD) { best = l; bestD = d; }
    }
  };
  pickNearest((l) => !l.lit);
  if (!best) pickNearest((l) => l.lit && g.fuelOut(l) < 30);

  const arrow = $("arrow");
  if (best) {
    v3.set(best.x, best.y + 3.3, best.z).project(camera);
    const behind = v3.z > 1;
    let nx = behind ? -v3.x : v3.x, ny = behind ? -v3.y : v3.y;
    const onScreen = !behind && Math.abs(nx) < 0.92 && Math.abs(ny) < 0.92;
    arrow.classList.toggle("hidden", onScreen);
    if (!onScreen) {
      const ang = Math.atan2(ny, nx);
      const m = Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
      const ex = (Math.cos(ang) / m) * 0.88, ey = (Math.sin(ang) / m) * 0.82;
      arrow.style.left = `${(ex * 0.5 + 0.5) * innerWidth}px`;
      arrow.style.top = `${(-ey * 0.5 + 0.5) * innerHeight}px`;
      arrow.style.transform = `translate(-50%,-50%) rotate(${-ang}rad)`;
    }
  } else arrow.classList.add("hidden");
}

// ---------------------------------------------------------------- camera + loop
// Look direction from yaw/pitch, matching the contract's camera frame: yaw 0 looks down +Z.
function lookDir() {
  const th = (app.camYaw * Math.PI) / 180, ph = (app.camPitch * Math.PI) / 180;
  return [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)];
}
const EYE_H = 1.45; // Mây's eyes, just under the nón lá
function updateCamera() {
  const p = app.game.player;
  const [dx, dy, dz] = lookDir();
  if (settings.camMode === "fp") {
    camera.position.set(p.x, p.y + EYE_H, p.z);
    camera.lookAt(p.x + dx, p.y + EYE_H + dy, p.z + dz);
  } else {
    const dist = 11, ty = Math.max(p.y, -2) + 1.4;
    camera.position.set(p.x - dx * dist, ty - dy * dist, p.z - dz * dist);
    camera.lookAt(p.x, ty, p.z);
  }
}

// First-person: hide Mây's body (keep her lantern light), show a hand-held lantern + crosshair.
const hand = new THREE.Group();
{
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: PAL.lanternLit, emissive: PAL.lanternLit, emissiveIntensity: 1.2 }));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1c }));
  cap.position.y = 0.085;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 4), new THREE.MeshBasicMaterial({ color: 0x3a2a1c }));
  string.position.y = 0.2;
  hand.add(paper, cap, string);
  hand.position.set(0.34, -0.3, -0.95); // small, lower-right, clear of the HUD cooldown icons
  hand.scale.setScalar(0.55);
  camera.add(hand);
  scene.add(camera); // children of the camera only render if the camera is in the scene
}
function applyCamMode() {
  const fp = settings.camMode === "fp";
  app.camPitch = fp ? 0 : -22;
  if (app.world) app.world.setFirstPerson(fp);
  hand.visible = fp;
  $("crosshair").classList.toggle("hidden", !fp);
  $("cam-mode").textContent = fp ? "Góc nhìn thứ nhất · V" : "Góc nhìn thứ ba · V";
}

let acc = 0, last = performance.now(), fpsFrames = 0, fpsT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (app.game) {
    if (app.screen === "play") {
      acc += dt;
      while (acc >= DT && app.screen === "play") { simStep(); acc -= DT; }
    } else acc = 0; // pause/menus: logic is fully stopped
    updateCamera(); // before sync: billboards (fuel bars) copy this frame's camera rotation
    app.world.sync(app.game, now / 1000, dt, camera);
    if (!$("hud").classList.contains("hidden")) updateHUD();
  } else {
    // Menu backdrop: slow orbit around an empty sky.
    camera.position.set(Math.sin(now / 8000) * 30, 18, Math.cos(now / 8000) * 30);
    camera.lookAt(0, 0, 0);
  }
  hand.visible = settings.camMode === "fp" && !!app.game && !app.game.player.fallen;
  renderer.render(scene, camera);
  fpsFrames++; fpsT += dt;
  if (fpsT >= 0.5) { $("fps").textContent = `${Math.round(fpsFrames / fpsT)} FPS`; fpsFrames = 0; fpsT = 0; }
}

// ---------------------------------------------------------------- buttons
const on = (id, fn) => $(id).addEventListener("click", () => { audio.unlock(); audio.play("click"); fn(); });
on("btn-start", () => { app.won = {}; loadNight(1); });
for (const n of [1, 2, 3]) on(`btn-night${n}`, () => { app.won = {}; loadNight(n); });
on("btn-menu-settings", () => openSettings("menu"));
on("btn-begin", beginPlay);
on("btn-resume", resume);
on("btn-restart", () => loadNight(app.night));
on("btn-pause-settings", () => openSettings("pause"));
on("btn-pause-menu", () => { audio.stopMusic(); app.won = {}; show("menu"); });
on("btn-settings-back", () => show(app.settingsBack));
on("btn-next", () => loadNight(app.night + 1));
on("btn-retry", () => loadNight(app.night));
on("btn-result-menu", () => { audio.stopMusic(); show("menu"); });
on("btn-dawn-menu", () => { audio.stopMusic(); app.won = {}; show("menu"); });
$("set-volume").addEventListener("input", (e) => { settings.volume = e.target.value / 100; audio.setVolume(settings.volume); updateSettingLabels(); saveSettings(); });
$("set-sens").addEventListener("input", (e) => { settings.sens = +e.target.value; updateSettingLabels(); saveSettings(); });
$("set-cb").addEventListener("change", (e) => { settings.colorBlind = e.target.checked; applyColorBlind(); saveSettings(); });

// Debug/evidence hook: advance N real sim steps + one HUD/render pass without requestAnimationFrame
// (browsers pause rAF in hidden tabs). Uses the same functions as the live loop; never called by the game.
app.debugAdvance = (ticks = 1) => {
  for (let i = 0; i < ticks && app.game.state === "playing"; i++) simStep();
  updateCamera();
  app.world.sync(app.game, performance.now() / 1000, DT, camera);
  updateHUD();
  renderer.render(scene, camera);
  return { tick: app.game.tick, state: app.game.state, screen: app.screen };
};

show("menu");
requestAnimationFrame(frame);
