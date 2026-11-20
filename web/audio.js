// All sound is synthesised with WebAudio at runtime — no external audio assets (see CREDITS.md).
// Event -> sound map (AC3.10):
//   mote_picked: pickup | lantern_lit: lit | pulse: pulse | player_hit: hit | jump: jump
//   dash: dash | won: win | lost: lose | shade_spawned: spawn | last 10 s: tick
//   charm_picked: charm | drifter_steal: steal | wind warning: wind
//   (Phase 3) refuel: refuel | lantern_out: out | fuel_drain: drain

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.volume = 0.7;
    this.musicTimer = null;
  }

  // Must be called from a user gesture (browser autoplay policy).
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
    this._noiseBuf = this._makeNoise();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 1.0;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 1234567; // deterministic LCG so the noise texture is the same each run
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
    return buf;
  }

  _tone(freq, dur, { type = "sine", gain = 0.3, attack = 0.005, at = 0, slideTo = null, dest = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest || this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  _noise(dur, { gain = 0.3, freq = 1200, q = 1, type = "bandpass", at = 0, sweepTo = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case "pickup": this._tone(880, 0.12, { type: "triangle", gain: 0.18 }); this._tone(1320, 0.1, { type: "sine", gain: 0.12, at: 0.05 }); break;
      case "lit": [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.6, { type: "triangle", gain: 0.2, at: i * 0.08 })); break;
      case "pulse": this._tone(220, 0.5, { type: "sine", gain: 0.35, slideTo: 880 }); this._noise(0.4, { gain: 0.15, freq: 600, sweepTo: 3000 }); break;
      case "hit": this._tone(140, 0.35, { type: "sawtooth", gain: 0.25, slideTo: 60 }); this._tone(150, 0.3, { type: "square", gain: 0.08 }); break;
      case "jump": this._tone(330, 0.15, { type: "sine", gain: 0.18, slideTo: 660 }); break;
      case "dash": this._noise(0.22, { gain: 0.25, freq: 2500, sweepTo: 400, q: 0.7 }); break;
      case "win": [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.9, { type: "triangle", gain: 0.22, at: i * 0.12 })); break;
      case "lose": [392, 330, 262, 196].forEach((f, i) => this._tone(f, 0.7, { type: "sine", gain: 0.22, at: i * 0.18 })); break;
      case "spawn": this._tone(70, 0.8, { type: "sawtooth", gain: 0.12, slideTo: 45 }); this._noise(0.6, { gain: 0.08, freq: 300, type: "lowpass" }); break;
      case "tick": this._tone(1000, 0.06, { type: "square", gain: 0.1 }); break;
      case "charm": [784, 988, 1175].forEach((f, i) => this._tone(f, 0.3, { type: "triangle", gain: 0.18, at: i * 0.05 })); break;
      case "steal": this._tone(600, 0.3, { type: "sine", gain: 0.18, slideTo: 200 }); break;
      case "wind": this._noise(1.6, { gain: 0.18, freq: 400, sweepTo: 1400, q: 0.5 }); break;
      case "click": this._tone(660, 0.05, { type: "sine", gain: 0.12 }); break;
      case "refuel": [440, 554].forEach((f, i) => this._tone(f, 0.25, { type: "triangle", gain: 0.16, at: i * 0.06 })); break;
      case "out": this._tone(392, 0.9, { type: "sine", gain: 0.2, slideTo: 98 }); this._noise(0.5, { gain: 0.08, freq: 500, type: "lowpass" }); break;
      case "drain": this._tone(110, 0.4, { type: "sawtooth", gain: 0.07, slideTo: 80 }); break;
    }
  }

  // Night music: a slow pentatonic pad + sparse chimes, scheduled every bar.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 330]];
    const chime = [660, 740, 880, 990, 1110];
    let bar = 0;
    const playBar = () => {
      const ch = chords[bar % chords.length];
      ch.forEach((f) => this._tone(f, 3.8, { type: "sine", gain: 0.12, attack: 1.2, dest: this.musicGain }));
      if (bar % 2 === 0) this._tone(chime[(bar * 3) % chime.length], 1.5, { type: "triangle", gain: 0.07, at: 1.5, dest: this.musicGain });
      bar++;
    };
    playBar();
    this.musicTimer = setInterval(playBar, 4000);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
