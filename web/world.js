// Builds the 3D scene for one night and keeps entity meshes in sync with the Game.
// Pure presentation: nothing here changes gameplay state.
import * as THREE from "three";
import { PAL, PAL_CB, ambientFor } from "./palette.js";

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

// Shared geometries/materials (cheap to render many of them).
const G = {
  mote: new THREE.SphereGeometry(0.16, 10, 8),
  halo: new THREE.SphereGeometry(0.42, 12, 10),
  shade: new THREE.IcosahedronGeometry(0.75, 1),
  shadeRim: new THREE.IcosahedronGeometry(0.86, 1),
  eye: new THREE.SphereGeometry(0.09, 6, 6),
  post: new THREE.CylinderGeometry(0.16, 0.22, 3, 10),
  lantern: new THREE.CylinderGeometry(0.55, 0.55, 0.9, 8),
  lanternCap: new THREE.ConeGeometry(0.75, 0.45, 8),
  ring: new THREE.RingGeometry(5.85, 6, 64),
  // Colour-blind mode: an unlit lantern's paper is torn (open sector) and squashed 20%.
  lanternTorn: new THREE.CylinderGeometry(0.55, 0.55, 0.9, 8, 1, false, 0.5, Math.PI * 2 - 1.1),
  barBg: new THREE.PlaneGeometry(1.5, 0.2),
  barFill: new THREE.PlaneGeometry(1.4, 0.12).translate(0.7, 0, 0), // scales from its left edge
};
const M = {
  moteCore: new THREE.MeshBasicMaterial({ color: PAL.moteCore }),
  moteHalo: new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }),
  shadeBody: std(PAL.shadeBody, { roughness: 0.6 }),
  shadeStun: std(PAL.shadeStunned, { roughness: 0.6 }),
  shadeRim: new THREE.MeshBasicMaterial({ color: PAL.shadeRim, side: THREE.BackSide, transparent: true, opacity: 0.85 }),
  eye: new THREE.MeshBasicMaterial({ color: PAL.shadeRim }),
  post: std(PAL.wood),
  // Unlit lanterns glow faintly in their standard grey so targets read in the dark.
  lanternOff: std(PAL.lanternOff, { emissive: PAL.lanternOff, emissiveIntensity: 0.45 }),
  lanternOn: std(PAL.lanternLit, { emissive: PAL.lanternLit, emissiveIntensity: 0.9 }),
  cap: std(0x3a2a1c),
  ring: new THREE.MeshBasicMaterial({ color: PAL.lanternLit, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  lanternTorn: std(PAL.lanternOff, { emissive: PAL.lanternOff, emissiveIntensity: 0.45, side: THREE.DoubleSide }),
  barBg: new THREE.MeshBasicMaterial({ color: 0x0b0f24, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
  barFill: new THREE.MeshBasicMaterial({ color: PAL.lanternLit, depthWrite: false, side: THREE.DoubleSide }),
  barLow: new THREE.MeshBasicMaterial({ color: PAL.uiDanger, depthWrite: false, side: THREE.DoubleSide }),
  beam: new THREE.LineBasicMaterial({ color: PAL.shadeRim, transparent: true, opacity: 0.8 }),
};

// Fuel below this shows the low-fuel warning (mirrors tuning.low_fuel_threshold).
const LOW_FUEL = 30;

export class World {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.hemi = new THREE.HemisphereLight(0x9fb0ff, PAL.grass, ambientFor(0, 1) * 4);
    this.root.add(this.hemi);
    const moon = new THREE.DirectionalLight(0xc6d2ff, 1.8);
    moon.position.set(-30, 60, -20);
    this.root.add(moon);

    this._buildTerrain(game.map);
    this._buildLanterns(game);
    this._buildPads(game.map);
    this._buildCharms(game);
    this._buildPlayer();
    this._buildLeaves();
    this.motes = new Map();
    this.shades = new Map();
    this.drifters = new Map();
    this.beams = new Map(); // shade id -> drain beam line
    this.colorBlind = false;
  }

  // TICKET-03 colour-blind palette: shade rim/eyes #7A3CFF -> #00B3FF; lantern shapes differ (see sync).
  setColorBlind(on) {
    this.colorBlind = on;
    const rim = on ? PAL_CB.shadeRim : PAL.shadeRim;
    M.shadeRim.color.setHex(rim);
    M.eye.color.setHex(rim);
    M.beam.color.setHex(rim);
    M.barLow.color.setHex(on ? PAL_CB.uiDanger : PAL.uiDanger);
  }

  // ---------- static terrain ----------
  _island(r, cx = 0, cz = 0, top = 0) {
    const g = new THREE.Group();
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 72), std(PAL.grass));
    grass.position.set(cx, top - 0.3, cz);
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.2, r * 0.55, 7, 72), std(PAL.sand, { roughness: 1 }));
    rock.position.set(cx, top - 4.1, cz);
    g.add(grass, rock);
    this.root.add(g);
  }

  _buildTerrain(map) {
    const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), std(PAL.cloudSea, { roughness: 1 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -9;
    this.root.add(sea);

    if (map.night === 1) this._island(40);
    if (map.night === 2) {
      this._island(28, 0, 0);
      this._island(28, 70, 0);
      const bridge = new THREE.Group();
      for (let x = 26; x < 44; x += 0.6) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 4), std(PAL.wood));
        plank.position.set(x + 0.3, -0.08, 0);
        bridge.add(plank);
      }
      this.root.add(bridge);
    }
    if (map.night === 3) {
      this._island(45);
      // Tier 1: half annulus r 12..24 on z > 0, Y 0..3. Shape y = -world z (after rotating -90° about X).
      const s = new THREE.Shape();
      const N = 48;
      for (let i = 0; i <= N; i++) { const a = (Math.PI * i) / N; const p = [24 * Math.cos(a), -24 * Math.sin(a)]; i ? s.lineTo(...p) : s.moveTo(...p); }
      for (let i = N; i >= 0; i--) { const a = (Math.PI * i) / N; s.lineTo(12 * Math.cos(a), -12 * Math.sin(a)); }
      const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false }), std(PAL.grass));
      tier1.rotation.x = -Math.PI / 2;
      this.root.add(tier1);
      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), std(PAL.sand));
      tier2.position.y = 3;
      const tier2top = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.1, 48), std(PAL.grass));
      tier2top.position.y = 6.0;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 24), std(PAL.wood));
      tower.position.y = 10;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 2.5, 8), std(0x3a2a1c));
      roof.position.y = 15.25;
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), std(PAL.gold, { metalness: 0.6, roughness: 0.4, emissive: 0x332200 }));
      bell.position.y = 13.4;
      this.root.add(tier2, tier2top, tower, roof, bell);
      // Ramps at 30° and 150°: foot r=30 (Y0) -> top r=24 (Y3).
      for (const deg of [30, 150]) {
        const a = (deg * Math.PI) / 180;
        const len = Math.hypot(6, 3);
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), std(PAL.wood));
        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - a);
        const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(3, 6));
        ramp.quaternion.copy(qYaw).multiply(qTilt);
        ramp.position.set(27 * Math.cos(a), 1.35, 27 * Math.sin(a));
        this.root.add(ramp);
      }
    }
  }

  _buildLanterns(game) {
    this.lanterns = new Map();
    for (const l of game.lanterns) {
      const g = new THREE.Group();
      const post = new THREE.Mesh(G.post, M.post); post.position.y = 1.5;
      const body = new THREE.Mesh(G.lantern, M.lanternOff); body.position.y = 3.3;
      const cap = new THREE.Mesh(G.lanternCap, M.cap); cap.position.y = 3.95;
      const light = new THREE.PointLight(PAL.lanternLit, 0, 16, 1.6); light.position.y = 3.3;
      const ring = new THREE.Mesh(G.ring, M.ring); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.visible = false;
      const torn = new THREE.Mesh(G.lanternTorn, M.lanternTorn); torn.position.y = 3.3; torn.visible = false;
      // Fuel bar (billboarded to the camera in sync()).
      const bar = new THREE.Group();
      const fill = new THREE.Mesh(G.barFill, M.barFill); fill.position.set(-0.7, 0, 0.01);
      bar.add(new THREE.Mesh(G.barBg, M.barBg), fill);
      bar.position.y = 4.75;
      bar.visible = false;
      g.add(post, body, torn, cap, light, ring, bar);
      g.position.set(l.x, l.y, l.z);
      this.root.add(g);
      this.lanterns.set(l.id, { body, torn, light, ring, bar, fill });
    }
  }

  _buildPads(map) {
    for (const p of map.pads) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.12, 24), std(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.6 }));
      pad.position.set(p.pos[0], p.pos[1] + 0.06, p.pos[2]);
      this.root.add(pad);
    }
  }

  _buildCharms(game) {
    this.charms = new Map();
    for (const c of game.charms) {
      const g = new THREE.Group();
      const border = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.04), std(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.4 }));
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.06), std(PAL.mayScarf, { emissive: PAL.mayScarf, emissiveIntensity: 0.4 }));
      g.add(border, card);
      g.position.set(c.x, c.y + 1, c.z);
      this.root.add(g);
      this.charms.set(c.id, g);
    }
  }

  _buildPlayer() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.6, 4, 10), std(PAL.mayShirt));
    body.position.y = 0.65;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 16), std(PAL.mayScarf));
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), std(0xf1d6b8));
    head.position.y = 1.32;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.38, 20), std(PAL.sand));
    hat.position.y = 1.62;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: PAL.lanternCore }));
    lamp.position.set(0.55, 1.35, 0.1);
    const light = new THREE.PointLight(PAL.lanternLit, 14, 12, 1.4);
    light.position.copy(lamp.position);
    g.add(body, scarf, head, hat, lamp, light);
    this.root.add(g);
    this.player = g;
  }

  _buildLeaves() {
    const n = 140;
    const geo = new THREE.BufferGeometry();
    this.leafPos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.leafPos[i * 3] = (Math.random() - 0.5) * 30;
      this.leafPos[i * 3 + 1] = Math.random() * 6;
      this.leafPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(this.leafPos, 3));
    this.leaves = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9cc48a, size: 0.25, transparent: true, opacity: 0 }));
    this.root.add(this.leaves);
  }

  // ---------- dynamic sync ----------
  sync(game, now, dt, camera) {
    const p = game.player;
    this.player.position.set(p.x, p.y, p.z);
    this.player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
    // Blink while invulnerable.
    this.player.visible = !(p.invuln > 0 && Math.floor(now * 12) % 2 === 0) && !p.fallen;

    const lit = game.lanterns.filter((l) => l.lit).length;
    this.hemi.intensity = ambientFor(lit, game.lanterns.length) * 4; // ticket formula, scaled to three's physical units

    const blinkOff = Math.floor(now * 2) % 2 === 1; // 1 Hz: 0.5 s on, 0.5 s off
    for (const l of game.lanterns) {
      const v = this.lanterns.get(l.id);
      const fuel = game.fuelOut(l);
      const low = l.lit && fuel < LOW_FUEL;
      const glowing = l.lit && !(low && blinkOff);
      v.body.material = glowing ? M.lanternOn : M.lanternOff;
      v.light.intensity = glowing ? 60 * (0.35 + 0.65 * fuel / 100) : 0;
      v.ring.visible = l.lit && !low; // a weak lantern has no safe zone
      // Colour-blind mode: unlit = squashed 20% + torn paper, so lit/unlit differ by shape.
      const cbUnlit = this.colorBlind && !l.lit;
      v.body.visible = !cbUnlit;
      v.torn.visible = cbUnlit;
      v.torn.scale.y = 0.8;
      v.bar.visible = l.lit && !(low && blinkOff);
      v.fill.scale.x = Math.max(0.001, fuel / 100);
      v.fill.material = low ? M.barLow : M.barFill;
      if (camera) v.bar.quaternion.copy(camera.quaternion);
    }

    // Drain beams: a thin line from each draining shade to its lantern head.
    const live = new Set();
    for (const s of game.shades) {
      if (s.state !== "drain") continue;
      const l = game.lanterns.find((q) => q.id === s.targetId);
      if (!l) continue;
      live.add(s.id);
      let line = this.beams.get(s.id);
      if (!line) {
        line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), M.beam);
        this.beams.set(s.id, line); this.root.add(line);
      }
      const a = line.geometry.attributes.position.array;
      a[0] = s.x; a[1] = s.y; a[2] = s.z; a[3] = l.x; a[4] = l.y + 3.3; a[5] = l.z;
      line.geometry.attributes.position.needsUpdate = true;
      M.beam.opacity = 0.5 + 0.4 * Math.sin(now * 10);
    }
    for (const [id, line] of this.beams) if (!live.has(id)) { this.root.remove(line); line.geometry.dispose(); this.beams.delete(id); }

    for (const c of game.charms) {
      const g = this.charms.get(c.id);
      if (!g) continue;
      g.visible = c.available;
      g.rotation.y = now * 1.5;
      g.position.y = c.y + 1 + Math.sin(now * 2) * 0.12;
    }

    this._syncMap(this.motes, game.motes, (m) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(G.mote, M.moteCore), new THREE.Mesh(G.halo, M.moteHalo));
      return g;
    }, (g, m, i) => {
      g.position.set(m.x, m.y + 0.7 + Math.sin(now * 3 + i) * 0.12, m.z);
      g.visible = !(m.kind === "dropped" && m.ttl < 120 && Math.floor(now * 8) % 2 === 0);
    });

    this._syncMap(this.shades, game.shades, () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(G.shade, M.shadeBody);
      const rim = new THREE.Mesh(G.shadeRim, M.shadeRim);
      const e1 = new THREE.Mesh(G.eye, M.eye); e1.position.set(0.25, 0.15, 0.62);
      const e2 = new THREE.Mesh(G.eye, M.eye); e2.position.set(-0.25, 0.15, 0.62);
      g.add(body, rim, e1, e2);
      g.userData = { body, rim, born: now };
      return g;
    }, (g, s, i) => {
      const { body, rim, born } = g.userData;
      const stunned = s.state === "stunned";
      body.material = stunned ? M.shadeStun : M.shadeBody;
      rim.visible = !stunned;
      const grow = s.state === "spawning" ? Math.min(1, (now - born) / 0.5) : 1;
      g.scale.setScalar(grow * (stunned ? 0.8 : 1) * (1 + Math.sin(now * 4 + i) * 0.05));
      g.position.set(s.x, s.y + Math.sin(now * 2 + i) * 0.1, s.z);
      g.lookAt(p.x, s.y, p.z);
    });

    this._syncMap(this.drifters, game.drifters, () => {
      const geo = new THREE.PlaneGeometry(2.2, 0.35, 16, 1);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: PAL.drifter, emissive: PAL.drifter, emissiveIntensity: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
      mesh.userData.base = Float32Array.from(geo.attributes.position.array);
      return mesh;
    }, (mesh, d, i) => {
      mesh.visible = d.state !== "removed";
      mesh.material.opacity = d.state === "flee" ? 0.5 : 0.9;
      mesh.position.set(d.x, d.y, d.z);
      mesh.lookAt(p.x, d.y, p.z);
      mesh.rotateY(Math.PI / 2);
      const pos = mesh.geometry.attributes.position, base = mesh.userData.base;
      for (let k = 0; k < pos.count; k++) pos.array[k * 3 + 2] = Math.sin(base[k * 3] * 2.5 + now * 8 + i) * 0.25;
      pos.needsUpdate = true;
    });

    // Wind leaves: swirl during the 2 s warning, stream in the wind direction during a gust.
    const warn = game.windWarning, active = game.wind.active;
    const target = warn || active ? 0.9 : 0;
    this.leaves.material.opacity += (target - this.leaves.material.opacity) * Math.min(1, dt * 4);
    if (this.leaves.material.opacity > 0.01) {
      const w = (game.wind.dirDeg * Math.PI) / 180;
      const vx = active ? Math.cos(w) * 9 : Math.cos(now) * 2, vz = active ? Math.sin(w) * 9 : Math.sin(now) * 2;
      const a = this.leafPos;
      for (let k = 0; k < a.length; k += 3) {
        a[k] += vx * dt; a[k + 2] += vz * dt; a[k + 1] += Math.sin(now * 3 + k) * dt * 0.5;
        if (Math.abs(a[k]) > 15) a[k] = -Math.sign(a[k]) * 15;
        if (Math.abs(a[k + 2]) > 15) a[k + 2] = -Math.sign(a[k + 2]) * 15;
      }
      this.leaves.geometry.attributes.position.needsUpdate = true;
      this.leaves.position.set(p.x, p.y, p.z);
    }
  }

  _syncMap(map, list, make, update) {
    const seen = new Set();
    list.forEach((e, i) => {
      seen.add(e.id);
      let obj = map.get(e.id);
      if (!obj) { obj = make(e); map.set(e.id, obj); this.root.add(obj); }
      update(obj, e, i);
    });
    for (const [id, obj] of map) if (!seen.has(id)) { this.root.remove(obj); map.delete(id); }
  }

  dispose() {
    this.scene.remove(this.root);
    const shared = new Set([...Object.values(G), ...Object.values(M)]);
    this.root.traverse((o) => {
      if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
      if (o.material && !shared.has(o.material)) o.material.dispose();
    });
  }
}
