export class ActionQueue {
  constructor() {
    this.pending = null;
    this.running = false;
  }

  replace(action) {
    this.pending = action;
  }

  cancel() {
    this.pending = null;
  }

  async flush() {
    if (this.running || !this.pending) return;
    this.running = true;
    const action = this.pending;
    this.pending = null;
    try {
      await action();
    } finally {
      this.running = false;
      if (this.pending) await this.flush();
    }
  }
}
