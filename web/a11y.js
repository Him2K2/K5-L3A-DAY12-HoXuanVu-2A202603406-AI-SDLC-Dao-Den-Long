// TICKET-04 §4 accessibility helpers: key rebinding, visual captions, screen flash.

export const ACTIONS = ["forward", "back", "left", "right", "jump", "dash", "interact", "pulse", "pause"];
export const ACTION_LABELS = {
  forward: "Tiến", back: "Lùi", left: "Sang trái", right: "Sang phải",
  jump: "Nhảy", dash: "Lướt", interact: "Tương tác (thắp / châm dầu)", pulse: "Tỏa Sáng", pause: "Tạm dừng",
};
export const DEFAULT_KEYS = {
  forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD",
  jump: "Space", dash: "ShiftLeft", interact: "KeyE", pulse: "KeyQ", pause: "KeyP",
};
// Esc always pauses (browsers use it to release the mouse) and ◀ ▶ turn the camera: not bindable.
export const RESERVED = new Set(["Escape", "ArrowLeft", "ArrowRight"]);

export function keyLabel(code) {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map = { Space: "Space", ShiftLeft: "Shift trái", ShiftRight: "Shift phải", ControlLeft: "Ctrl trái",
    ControlRight: "Ctrl phải", AltLeft: "Alt trái", AltRight: "Alt phải", ArrowUp: "↑", ArrowDown: "↓", Enter: "Enter", Tab: "Tab" };
  return map[code] || code;
}

// Returns the action already using `code` (other than `action`), or null.
export function conflictFor(keys, action, code) {
  for (const a of ACTIONS) if (a !== action && keys[a] === code) return a;
  return null;
}

// Renders the rebinding list. Clicking a key button waits for the next key press.
export function buildKeyList(container, settings, { onChange, notify }) {
  let waiting = null;
  const render = () => {
    container.innerHTML = ACTIONS.map((a) => `
      <div class="keyrow">
        <span>${ACTION_LABELS[a]}</span>
        <button class="keybtn ${waiting === a ? "waiting" : ""}" data-action="${a}">${waiting === a ? "Nhấn phím…" : keyLabel(settings.keys[a])}</button>
      </div>`).join("");
    container.querySelectorAll(".keybtn").forEach((b) => b.addEventListener("click", () => { waiting = b.dataset.action; notify(""); render(); }));
  };
  // Capture phase so the game never sees the key being assigned.
  addEventListener("keydown", (e) => {
    if (!waiting) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === "Escape") { waiting = null; render(); return; }
    if (RESERVED.has(e.code)) { notify(`Phím ${keyLabel(e.code)} dành riêng cho camera/tạm dừng — chọn phím khác.`); return; }
    const clash = conflictFor(settings.keys, waiting, e.code);
    if (clash) { notify(`⚠ Phím ${keyLabel(e.code)} đang dùng cho "${ACTION_LABELS[clash]}". Đổi phím đó trước hoặc chọn phím khác.`); return; }
    settings.keys[waiting] = e.code;
    waiting = null;
    notify("Đã lưu.");
    onChange();
    render();
  }, true);
  render();
  return { render, cancel: () => { waiting = null; render(); } };
}

// Visual captions (subtitles for sound cues). Each stays ~3 s; at most 4 on screen.
export function makeCaptions(el) {
  return (text, kind = "") => {
    const d = document.createElement("div");
    d.className = `caption ${kind}`;
    d.textContent = text;
    el.appendChild(d);
    while (el.children.length > 4) el.firstChild.remove();
    setTimeout(() => d.remove(), 3200);
  };
}

// Full-screen flash (hit = red, lit = warm). Skipped entirely when reduced motion is on.
export function makeFlash(el, isReduced) {
  return (kind) => {
    if (isReduced()) return;
    el.className = "";
    void el.offsetWidth; // restart the CSS animation
    el.className = `flash-${kind}`;
  };
}
