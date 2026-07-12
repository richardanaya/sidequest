/**
 * On-screen dialogue / narration queue.
 */
export class Dialogue {
  constructor() {
    this.current = null; // { text, t, duration }
    this.queue = [];
    this.history = [];
  }

  say(text, duration, { speaker = null, choices = null } = {}) {
    text = String(text ?? "");
    const d = duration ?? Math.min(6.5, 1.8 + text.length * 0.035);
    if (this.current && this.current.t < this.current.duration * 0.8) {
      this.queue.push({ text, duration: d, speaker, choices });
      return;
    }
    this.current = { text, t: 0, duration: d, speaker, choices };
    this.history.push({ text, speaker });
  }

  clear() {
    this.current = null;
    this.queue = [];
  }

  update(dt) {
    if (!this.current) return;
    this.current.t += dt;
    if (this.current.t >= this.current.duration) {
      this.current = null;
      if (this.queue.length) {
        const n = this.queue.shift();
        this.current = { ...n, t: 0 };
        this.history.push({ text: n.text, speaker: n.speaker });
      }
    }
  }

  get text() {
    if (!this.current) return null;
    return this.current.speaker
      ? `${this.current.speaker}: ${this.current.text}`
      : this.current.text;
  }

  advance(choice = 0) {
    const selected = this.current?.choices?.[choice];
    this.current = null;
    if (selected?.action) selected.action();
    if (this.queue.length) {
      const next = this.queue.shift();
      this.current = { ...next, t: 0 };
    }
  }
}
