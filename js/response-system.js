export class ResponseSystem {
  constructor(state) {
    this.state = state;
    this.state.responseCounts ||= {};
  }

  pick(id, definition, fallback = "That doesn't seem to work.") {
    const count = this.state.responseCounts[id] || 0;
    this.state.responseCounts[id] = count + 1;
    if (typeof definition === "string") return definition;
    const escalating = definition?.escalating || [];
    if (escalating.length) return escalating[Math.min(count, escalating.length - 1)];
    const pool = definition?.pool || [];
    if (pool.length) return pool[count % pool.length];
    return definition?.text || fallback;
  }
}
