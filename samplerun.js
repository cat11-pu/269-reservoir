// samplerun.js：按采样预算处理样本，用尽预算的样本压账，收尾时补齐
import { slotFor } from "./reservoir.js";

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validCapacity(k) {
  return Number.isInteger(k) && k > 0;
}

function validEvent(event) {
  return Boolean(event)
    && typeof event === "object"
    && event.kind === "sample"
    && (typeof event.sid === "string" || typeof event.sid === "number")
    && event.value !== undefined && event.value !== null;
}

function cloneState(state) {
  return {
    pool: state.pool.slice(),
    seen: state.seen,
    ids: state.ids.slice(),
    ledger: state.ledger.map(function (row) { return [row[0], row[1]]; }),
    applied: state.applied.slice()
  };
}

// 把一条样本按取模槽位放进池子，并推进已处理计数。
function place(state, sid, value, capacity) {
  const slot = slotFor(state.seen + 1, capacity);
  if (slot === -1) {
    state.pool.push(value);
  } else {
    state.pool[slot] = value;
  }
  state.seen += 1;
  if (state.ids.indexOf(sid) === -1) state.ids.push(sid);
  if (state.applied.indexOf(sid) === -1) state.applied.push(sid);
}

export function step(spec) {
  const capacity = spec.k;
  if (!validCapacity(capacity)) throw failure("E_BAD_CAPACITY", "容量必须是正整数");
  const events = spec.events === undefined ? [] : spec.events;
  if (!Array.isArray(events)) throw failure("E_BAD_EVENT", "事件表必须是数组");

  const state = cloneState(spec.state);
  let budget = Number.isFinite(spec.budget) ? Math.max(0, Math.trunc(spec.budget)) : 0;
  let served = 0;
  let judged = 0;

  // 每轮先消耗新预算还上一轮压下来的账。
  const carried = state.ledger.splice(0, Math.min(budget, state.ledger.length));
  for (const row of carried) {
    place(state, row[0], row[1], capacity);
    budget -= 1;
    served += 1;
  }

  for (const event of events) {
    if (!validEvent(event)) throw failure("E_BAD_EVENT", "事件不合法");
    if (state.applied.indexOf(event.sid) !== -1) continue;
    if (state.ids.indexOf(event.sid) !== -1) {
      throw failure("E_DUPLICATE_SAMPLE", "样本编号已出现过：" + event.sid);
    }
    judged += 1;
    if (budget > 0) {
      place(state, event.sid, event.value, capacity);
      budget -= 1;
      served += 1;
    } else {
      state.ledger.push([event.sid, event.value]);
    }
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return [row[0], row[1]]; }),
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  const capacity = spec.k;
  if (!validCapacity(capacity)) throw failure("E_BAD_CAPACITY", "容量必须是正整数");
  const state = cloneState(spec.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    const row = state.ledger.shift();
    place(state, row[0], row[1], capacity);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
