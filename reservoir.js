// reservoir.js：槽位计算（1 基计数；池子没满返回 -1 表示追加）
export function slotFor(count, capacity) {
  if (count <= capacity) return -1;
  return (count - 1) % capacity;
}

export function poolLimit(capacity) {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    const error = new Error("capacity must be a positive integer");
    error.code = "E_BAD_CAPACITY";
    throw error;
  }
  return capacity;
}
