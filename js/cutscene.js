/**
 * Linear cutscene runner: sequenced engine commands with waits.
 */
export class CutscenePlayer {
  constructor(engine) {
    this.engine = engine;
    this.playing = false;
    this._abort = false;
    this._pendingResolve = null;
    this._finalSteps = [];
  }

  get blocking() {
    return this.playing;
  }

  abort() {
    this._abort = true;
    this.engine.player.arriveAction = null;
    this.engine.player.moving = false;
    if (this._pendingResolve) this._pendingResolve();
    this._pendingResolve = null;
    this.playing = false;
  }

  async skip() {
    this.abort();
    if (this._finalSteps.length) await this.engine.runtime.run(this._finalSteps);
  }

  /**
   * @param {Array<object>} steps
   * steps: { say, wait, walkTo, face, setFlag, give, remove, fadeOut, fadeIn, flash, goto, score, sfx, music }
   */
  async play(steps = [], { final = [] } = {}) {
    if (this.playing) return;
    this.playing = true;
    this._abort = false;
    this._finalSteps = final;
    const eng = this.engine;
    try {
      for (const step of steps) {
        if (this._abort) break;
        if (step.when && eng.runtime && !eng.runtime.test(step.when)) continue;

        if (step.say) eng.dialogue.say(step.say, step.duration, { speaker: step.speaker });
        if (step.wait) await this._wait(step.wait);
        if (step.waitDialogue) {
          while (eng.dialogue.current && !this._abort) await this._wait(0.05);
        }
        if (step.face != null) eng.player.facing = step.face;
        if (step.animate) await eng.player.playAnimation(step.animate, step.duration);
        if (step.walkTo != null) {
          await new Promise((resolve) => {
            this._pendingResolve = resolve;
            eng.player.walkTo(step.walkTo, () => {
              this._pendingResolve = null;
              resolve();
            }, eng.room.walkBounds);
          });
        }
        if (step.parallel) {
          await Promise.all(step.parallel.map((branch) => this.playBranch(branch)));
        }
        if (step.setFlag) eng.state.flags[step.setFlag] = step.value ?? true;
        if (step.setFlags) Object.assign(eng.state.flags, step.setFlags);
        if (step.give) eng.inventory.give(step.give);
        if (step.remove) eng.inventory.remove(step.remove);
        if (step.score) eng.state.addScore(step.score, step.scoreReason);
        if (step.sfx) eng.audio.play("effects", step.sfx);
        if (step.music) eng.audio.play("music", step.music, { loop: !!step.loop });
        if (step.stopMusic) eng.audio.stop("music");
        if (step.fadeOut) await eng.transition.fadeOut(step.speed);
        if (step.fadeIn) await eng.transition.fadeIn(step.speed);
        if (step.flash) await eng.transition.flash(step.flash, step.flashDuration);
        if (step.die) {
          eng.die(step.die);
          break;
        }
        if (step.goto) {
          await eng.goToRoom(step.goto.room || step.goto, {
            spawnId: step.goto.spawn || step.spawn,
          });
        }
        if (step.run) await eng.runtime.run(step.run);
      }
    } finally {
      this.playing = false;
      this._pendingResolve = null;
    }
  }

  async playBranch(steps) {
    for (const step of Array.isArray(steps) ? steps : [steps]) {
      if (this._abort) return;
      if (step.wait) await this._wait(step.wait);
      if (step.say) this.engine.dialogue.say(step.say, step.duration, { speaker: step.speaker });
      if (step.animate) await this.engine.player.playAnimation(step.animate, step.duration);
      if (step.run) await this.engine.runtime.run(step.run);
    }
  }

  _wait(sec) {
    return new Promise((r) => setTimeout(r, Math.max(0, sec) * 1000));
  }
}
