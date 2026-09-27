// samplerun.js：按采样预算处理并留账（不修改入参 state）
import { slotFor, poolLimit } from "./reservoir.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function cloneState(state) {
  return {
    pool: (state.pool || []).slice(),
    seen: state.seen || 0,
    ids: (state.ids || []).slice(),
    ledger: (state.ledger || []).map(function (row) { return [row[0], row[1]]; }),
    applied: (state.applied || []).slice()
  };
}

function validEvent(event) {
  return event !== null && typeof event === "object"
    && event.kind === "sample"
    && typeof event.sid === "string" && event.sid.length > 0
    && typeof event.value === "number" && Number.isFinite(event.value);
}

function applySample(next, sid, value, capacity) {
  const slot = slotFor(next.seen + 1, capacity);
  if (slot === -1) {
    next.pool.push(value);
  } else {
    next.pool[slot] = value;
  }
  next.seen += 1;
  next.ids.push(sid);
  next.applied.push(sid);
}

export function step(spec) {
  const capacity = poolLimit(spec.k);
  const events = spec.events || [];
  const budget = Math.max(0, Math.floor(Number(spec.budget)) || 0);
  const duplicateCode = spec.duplicate_error_code || "E_DUPLICATE_SAMPLE";
  const eventCode = spec.event_error_code || "E_BAD_EVENT";

  const next = cloneState(spec.state || {});
  let remaining = budget;
  let served = 0;
  let judged = 0;

  // 先还上一轮压在账上的样本，再处理本轮新事件（共用一份预算）。
  while (next.ledger.length > 0 && remaining > 0) {
    const row = next.ledger.shift();
    applySample(next, row[0], row[1], capacity);
    served += 1;
    remaining -= 1;
  }

  for (const event of events) {
    if (!validEvent(event)) {
      throw fail(eventCode, "invalid sample event");
    }
    if (next.applied.indexOf(event.sid) !== -1) {
      continue; // 重放：已落库的样本直接跳过，不占预算、不再记账
    }
    if (next.ids.indexOf(event.sid) !== -1) {
      throw fail(duplicateCode, "duplicate sample: " + event.sid);
    }
    if (remaining > 0) {
      applySample(next, event.sid, event.value, capacity);
      served += 1;
      remaining -= 1;
    } else {
      next.ledger.push([event.sid, event.value]);
    }
    judged += 1;
  }

  return {
    state: next,
    served,
    ledger_before: next.ledger.length,
    ledger: next.ledger,
    judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  const capacity = poolLimit(spec.k);
  const next = cloneState(spec.state || {});
  let catchup = 0;

  // 收尾不限预算，把账上样本全部落进池子。
  while (next.ledger.length > 0) {
    const row = next.ledger.shift();
    applySample(next, row[0], row[1], capacity);
    catchup += 1;
  }

  return { state: next, catchup };
}
