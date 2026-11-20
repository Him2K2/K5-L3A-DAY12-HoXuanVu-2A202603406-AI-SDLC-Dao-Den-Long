// Fails if game.contract.json's tuning drifts from the code's DEFAULT_TUNING.
import fs from "node:fs";
import url from "node:url";
import path from "node:path";
import { DEFAULT_TUNING } from "../src/core/config.js";

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const contract = JSON.parse(fs.readFileSync(path.join(root, "game.contract.json"), "utf8"));

function eq(a, b) {
  if (typeof a === "object" && a && typeof b === "object" && b) {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => eq(a[k], b[k]));
  }
  return a === b;
}

if (!eq(contract.tuning, DEFAULT_TUNING)) {
  console.error("MISMATCH between game.contract.json tuning and DEFAULT_TUNING:");
  console.error("contract:", JSON.stringify(contract.tuning));
  console.error("code    :", JSON.stringify(DEFAULT_TUNING));
  process.exit(1);
}
// v1.3: required commands present and pointing at files that exist.
const need = ["contract_version", "team", "build_cmd", "run_cmd", "headless_cmd", "bench_cmd", "soak_cmd"];
const missing = need.filter((k) => typeof contract[k] !== "string" || !contract[k]);
if (missing.length) { console.error("MISSING contract keys:", missing.join(", ")); process.exit(1); }
if (contract.contract_version !== "1.3") { console.error(`contract_version is ${contract.contract_version}, expected 1.3`); process.exit(1); }
for (const k of ["run_cmd", "headless_cmd", "bench_cmd", "soak_cmd"]) {
  const script = contract[k].split(/\s+/).find((w) => w.endsWith(".js"));
  if (!script || !fs.existsSync(path.join(root, script))) { console.error(`${k}: script not found (${contract[k]})`); process.exit(1); }
}
console.log("OK: game.contract.json v1.3 — tuning matches code DEFAULT_TUNING; run/headless/bench/soak commands resolve.");
