export class CursorController {
  constructor({ verbs = ["Walk to", "Look at", "Use", "Talk to", "Take"] } = {}) {
    this.verbs = verbs;
    this.index = 0;
    this.item = null;
    this.valid = true;
  }

  get verb() {
    return this.item ? "Use" : this.verbs[this.index];
  }

  cycle(direction = 1) {
    this.item = null;
    this.index = (this.index + direction + this.verbs.length) % this.verbs.length;
    return this.verb;
  }

  selectVerb(verb) {
    const index = this.verbs.indexOf(verb);
    if (index >= 0) this.index = index;
    this.item = null;
  }

  selectItem(id) {
    this.item = id;
  }

  sentence(target, itemName = (id) => id) {
    if (this.item) return target ? `Use ${itemName(this.item)} with ${target}` : `Use ${itemName(this.item)} with…`;
    return target ? `${this.verb} ${target}` : this.verb;
  }

  cssCursor(hasTarget = false) {
    if (!this.valid) return "not-allowed";
    if (hasTarget || this.item) return "pointer";
    return this.verb === "Walk to" ? "crosshair" : "default";
  }
}
