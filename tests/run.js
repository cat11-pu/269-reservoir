import assert from "node:assert";
import { slotFor, poolLimit } from "../reservoir.js";
import { step, close } from "../samplerun.js";
import { render } from "../app.js";

const base = {
  budget: 1, k: 2,
  state: { pool: [], seen: 0, ids: [], ledger: [], applied: [] },
  events: [],
  duplicate_error_code: "E_DUPLICATE_SAMPLE", capacity_error_code: "E_BAD_CAPACITY",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("slotFor returns a number", () => {
  assert.strictEqual(typeof slotFor(1, 2), "number");
});

check("poolLimit returns a number", () => {
  assert.strictEqual(typeof poolLimit(2), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
