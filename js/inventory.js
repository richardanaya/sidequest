/**
 * Expandable / scrollable inventory model + hit-testing geometry.
 */
export class Inventory {
  constructor({
    visible = 6,
    slot = 44,
    gap = 8,
    arrowW = 22,
    stripX = 446,
    stripY = 468,
    labelX = 420,
    labelY = 444,
  } = {}) {
    this.items = [];
    this.selected = null;
    this.scroll = 0;
    this.expanded = false;
    this.expandedPage = 0;

    this.INV_VISIBLE = visible;
    this.INV_SLOT = slot;
    this.INV_GAP = gap;
    this.INV_ARROW_W = arrowW;
    this.INV_STRIP_X = stripX;
    this.INV_Y = stripY;
    this.INV_X = labelX;
    this.INV_LABEL_Y = labelY;
    this.INV_EXP_COLS = 6;
    this.INV_EXP_SLOT = 56;
    this.INV_EXP_GAP = 10;
  }

  get length() {
    return this.items.length;
  }

  has(id) {
    return this.items.includes(id);
  }

  give(id) {
    if (!this.items.includes(id)) this.items.push(id);
    this.ensureVisible(this.items.length - 1);
  }

  remove(id) {
    this.items = this.items.filter((x) => x !== id);
    if (this.selected === id) this.selected = null;
    this.clampScroll();
  }

  clampScroll() {
    const maxScroll = Math.max(0, this.items.length - this.INV_VISIBLE);
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
  }

  ensureVisible(index) {
    if (index < 0) return;
    if (index < this.scroll) this.scroll = index;
    if (index >= this.scroll + this.INV_VISIBLE) {
      this.scroll = index - this.INV_VISIBLE + 1;
    }
    this.clampScroll();
  }

  scrollBy(delta) {
    this.scroll += delta;
    this.clampScroll();
  }

  toggleExpanded() {
    this.expanded = !this.expanded;
  }

  stripSlot(visibleIndex) {
    return {
      x: this.INV_STRIP_X + visibleIndex * (this.INV_SLOT + this.INV_GAP),
      y: this.INV_Y,
      w: this.INV_SLOT,
      h: this.INV_SLOT,
    };
  }

  arrowRects() {
    const left = {
      x: this.INV_X,
      y: this.INV_Y,
      w: this.INV_ARROW_W,
      h: this.INV_SLOT,
      dir: -1,
    };
    const rightX =
      this.INV_STRIP_X +
      this.INV_VISIBLE * (this.INV_SLOT + this.INV_GAP) -
      this.INV_GAP +
      4;
    const right = {
      x: rightX,
      y: this.INV_Y,
      w: this.INV_ARROW_W,
      h: this.INV_SLOT,
      dir: 1,
    };
    return { left, right };
  }

  expandButtonRect() {
    return { x: this.INV_X, y: this.INV_LABEL_Y - 2, w: 200, h: 20 };
  }

  expandedLayout(W, UI_TOP, TOP_BAR) {
    const cols = this.INV_EXP_COLS;
    const slot = this.INV_EXP_SLOT;
    const gap = this.INV_EXP_GAP;
    const n = Math.max(this.items.length, cols);
    const maxRows = Math.max(2, Math.floor((UI_TOP - TOP_BAR - 96) / (slot + gap)));
    const rows = Math.min(maxRows, Math.max(2, Math.ceil(Math.max(n, cols) / cols)));
    const gridW = cols * slot + (cols - 1) * gap;
    const gridH = rows * slot + (rows - 1) * gap;
    const pad = 20;
    const headH = 36;
    const boxW = gridW + pad * 2;
    const boxH = gridH + pad * 2 + headH;
    const boxX = Math.round((W - boxW) / 2);
    const boxY = Math.round((UI_TOP - boxH) / 2 + TOP_BAR * 0.3);
    const pageSize = cols * rows;
    const pages = Math.max(1, Math.ceil(this.items.length / pageSize));
    this.expandedPage = Math.max(0, Math.min(this.expandedPage, pages - 1));
    return { cols, rows, slot, gap, pad, headH, boxX, boxY, boxW, boxH, gridW, gridH, pageSize, pages, start: this.expandedPage * pageSize };
  }

  expandedSlotRect(index, layout) {
    const col = index % layout.cols;
    const row = Math.floor(index / layout.cols);
    const gx = layout.boxX + layout.pad;
    const gy = layout.boxY + layout.pad + layout.headH;
    return {
      x: gx + col * (layout.slot + layout.gap),
      y: gy + row * (layout.slot + layout.gap),
      w: layout.slot,
      h: layout.slot,
    };
  }

  seed(ids) {
    for (const id of ids) this.give(id);
  }
}
