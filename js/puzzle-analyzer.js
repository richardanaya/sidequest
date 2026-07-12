export class PuzzleAnalyzer {
  analyze({ registry, rooms = {}, scripts = {} }) {
    const errors = [];
    const warnings = [];
    const roomIds = new Set(Object.keys(registry?.rooms || rooms));
    const graph = {};
    for (const [id, room] of Object.entries(rooms)) {
      graph[id] = [];
      for (const [direction, exit] of Object.entries(room.exits || {})) {
        if (!roomIds.has(exit.room)) errors.push(`${id}.exits.${direction}: unknown room ${exit.room}`);
        else graph[id].push(exit.room);
      }
    }
    for (const [id, script] of Object.entries(scripts)) {
      for (const [conversationId, conversation] of Object.entries(script.conversations || {})) {
        const nodes = conversation.nodes || {};
        if (!nodes[conversation.start]) errors.push(`${id}.${conversationId}: missing start node`);
        for (const [nodeId, node] of Object.entries(nodes)) {
          for (const choice of node.choices || []) {
            if (choice.next && !nodes[choice.next]) errors.push(`${id}.${conversationId}.${nodeId}: missing ${choice.next}`);
          }
        }
      }
    }
    const start = registry?.defaults?.room;
    const reached = new Set();
    const queue = start ? [start] : [];
    while (queue.length) {
      const id = queue.shift();
      if (reached.has(id)) continue;
      reached.add(id);
      queue.push(...(graph[id] || []));
    }
    for (const id of roomIds) if (start && !reached.has(id)) warnings.push(`Room ${id} is unreachable from ${start}`);
    return { valid: errors.length === 0, errors, warnings, graph };
  }
}
