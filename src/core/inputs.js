// Resolve the sparse inputs file (contract C) into a per-tick control state,
// with buttons edge-triggered (true only on the tick their press begins).

export class BadInput extends Error {} // maps to exit code 2

export class InputTrack {
  constructor(data) {
    this.frames = [];
    if (data != null) {
      if (typeof data !== "object" || !Array.isArray(data.frames)) {
        throw new BadInput("inputs: missing frames array");
      }
      let last = -Infinity;
      for (const f of data.frames) {
        if (typeof f !== "object" || f === null) throw new BadInput("inputs: bad frame");
        if (!Number.isFinite(f.tick) || !Number.isInteger(f.tick) || f.tick < 0) {
          throw new BadInput("inputs: frame.tick must be a non-negative integer");
        }
        if (f.tick <= last) throw new BadInput("inputs: frame ticks must strictly increase");
        last = f.tick;
        if (f.move !== undefined) {
          if (!Array.isArray(f.move) || f.move.length !== 2 ||
              !f.move.every((n) => Number.isFinite(n))) {
            throw new BadInput("inputs: move must be [x,z] numbers");
          }
        }
        if (f.cam_yaw_deg !== undefined && !Number.isFinite(f.cam_yaw_deg)) {
          throw new BadInput("inputs: cam_yaw_deg must be a number");
        }
        for (const b of ["jump", "interact", "pulse", "dash", "pause"]) {
          if (f[b] !== undefined && typeof f[b] !== "boolean") {
            throw new BadInput(`inputs: ${b} must be boolean`);
          }
        }
        this.frames.push(f);
      }
    }
    this.ptr = 0;
    // Defaults before the first frame (contract C).
    this.held = {
      move: [0, 0], camYaw: 0,
      jump: false, interact: false, pulse: false, dash: false, pause: false,
    };
  }

  resolve(tick) {
    const prev = {
      jump: this.held.jump, interact: this.held.interact,
      pulse: this.held.pulse, dash: this.held.dash, pause: this.held.pause,
    };
    while (this.ptr < this.frames.length && this.frames[this.ptr].tick === tick) {
      const f = this.frames[this.ptr++];
      if (f.move !== undefined) this.held.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) this.held.camYaw = f.cam_yaw_deg;
      for (const b of ["jump", "interact", "pulse", "dash", "pause"]) {
        if (f[b] !== undefined) this.held[b] = f[b];
      }
    }
    return {
      move: this.held.move,
      camYaw: this.held.camYaw,
      jump: this.held.jump && !prev.jump,
      interact: this.held.interact && !prev.interact,
      pulse: this.held.pulse && !prev.pulse,
      dash: this.held.dash && !prev.dash,
      pause: this.held.pause && !prev.pause,
    };
  }
}
