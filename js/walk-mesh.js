/**
 * Walkable polygons + simple pathfinding (grid A* on the walk mesh AABB).
 */
export class WalkMesh {
  /**
   * @param {Array<{x:number,y:number}>[]} polygons - scene-space polygons (floors)
   * @param {{x:number,y:number,w:number,h:number}[]} [blockers] - solid rects
   */
  constructor(polygons = [], blockers = []) {
    this.polygons = polygons;
    this.blockers = blockers;
  }

  static fromRoomPack(pack) {
    const floorY = pack.floorY_scene ?? 373;
    const w = pack.sceneSize?.[0] || 960;
    const bounds = pack.walkBounds || { min: 70, max: w - 70 };
    // Default: thin walk band along floor line
    const defaultPoly = [
      { x: bounds.min, y: floorY - 8 },
      { x: bounds.max, y: floorY - 8 },
      { x: bounds.max, y: floorY + 12 },
      { x: bounds.min, y: floorY + 12 },
    ];
    const polys = pack.walkMesh?.polygons?.length
      ? pack.walkMesh.polygons
      : [defaultPoly];
    const blockers = pack.walkMesh?.blockers || [];
    return new WalkMesh(polys, blockers);
  }

  pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  inBlocker(x, y) {
    return this.blockers.some(
      (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
    );
  }

  contains(x, y) {
    if (this.inBlocker(x, y)) return false;
    return this.polygons.some((p) => this.pointInPoly(x, y, p));
  }

  /** Clamp a point to nearest walkable location (simple search). */
  clamp(x, y) {
    if (this.contains(x, y)) return { x, y };
    let best = null;
    let bestD = Infinity;
    for (const poly of this.polygons) {
      // sample edges
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        for (let t = 0; t <= 1; t += 0.05) {
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;
          if (this.inBlocker(px, py)) continue;
          const d = (px - x) ** 2 + (py - y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { x: px, y: py };
          }
        }
      }
    }
    return best || { x, y };
  }

  /**
   * Path from (x0,y0) to (x1,y1). For 2D side adventures we often keep y fixed
   * on the floor band — if both points share a horizontal walk band, return [start, end].
   */
  findPath(x0, y0, x1, y1) {
    const start = this.clamp(x0, y0);
    const goal = this.clamp(x1, y1);
    // Prefer straight line if clear (sample)
    if (this.lineClear(start.x, start.y, goal.x, goal.y)) {
      return [start, goal];
    }
    // Grid A* over bounding box of all polys
    const path = this.aStar(start, goal);
    return path.length ? path : [start, goal];
  }

  lineClear(x0, y0, x1, y1, steps = 24) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (!this.contains(x, y)) return false;
    }
    return true;
  }

  aStar(start, goal) {
    const cell = 20;
    const key = (x, y) => `${Math.round(x / cell)},${Math.round(y / cell)}`;
    const open = [{ x: start.x, y: start.y, g: 0, f: 0, parent: null }];
    const openMap = new Map([[key(start.x, start.y), open[0]]]);
    const closed = new Set();
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    let guard = 0;
    while (open.length && guard++ < 4000) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      openMap.delete(key(cur.x, cur.y));
      const ck = key(cur.x, cur.y);
      if (closed.has(ck)) continue;
      closed.add(ck);
      if (Math.hypot(cur.x - goal.x, cur.y - goal.y) < cell * 1.2) {
        const path = [{ x: goal.x, y: goal.y }];
        let p = cur;
        while (p) {
          path.push({ x: p.x, y: p.y });
          p = p.parent;
        }
        return path.reverse();
      }
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx * cell;
        const ny = cur.y + dy * cell;
        if (!this.contains(nx, ny)) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const g = cur.g + Math.hypot(dx, dy) * cell;
        const h = Math.hypot(nx - goal.x, ny - goal.y);
        const existing = openMap.get(nk);
        if (existing && existing.g <= g) continue;
        const node = { x: nx, y: ny, g, f: g + h, parent: cur };
        open.push(node);
        openMap.set(nk, node);
      }
    }
    return [start, goal];
  }

  drawDebug(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#44ff88";
    for (const poly of this.polygons) {
      if (!poly.length) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#ff4444";
    for (const b of this.blockers) ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.restore();
  }
}
