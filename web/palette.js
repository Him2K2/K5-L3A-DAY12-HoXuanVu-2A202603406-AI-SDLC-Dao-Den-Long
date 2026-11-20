// TICKET-02 standard palette (max 10% deviation per RGB channel). Single place to change colours.
export const PAL = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  cloudSea: 0x12384a,
  lanternLit: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeStunned: 0x3a3450,
  mayShirt: 0xe8e2d0,
  mayScarf: 0xc8102e, // also Bùa Gió
  gold: 0xf2c14e, // trims, score
  drifter: 0x8fa3b8,
  uiDanger: 0xff5a5f,
  uiText: 0xf5f1e6,
};

// TICKET-03 colour-blind-friendly overrides ("Bảng màu dễ phân biệt").
export const PAL_CB = {
  shadeRim: 0x00b3ff, // was #7A3CFF
  uiDanger: 0xffffff, // was #FF5A5F, shown with a ⚠ icon
};

export const css = (hex) => `#${hex.toString(16).padStart(6, "0")}`;

// Ambient light grows with progress (ticket): 0.15 + 0.55 * lit/total.
export const ambientFor = (lit, total) => 0.15 + 0.55 * (total ? lit / total : 0);
