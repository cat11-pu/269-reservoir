// reservoir.js：槽位计算（没满给 -1 追加，满了按 (count-1) % capacity 取槽位）
export function slotFor(count, capacity) {
  if (count <= capacity) return -1;
  return (count - 1) % capacity;
}

export function poolLimit(capacity) {
  return capacity;
}
