/**
 * Data-driven adventure script steps (room script.json).
 */
export class ScriptRuntime {
  constructor(services) {
    this.services = services;
  }

  test(condition) {
    if (!condition) return true;
    if (condition.all) return condition.all.every((x) => this.test(x));
    if (condition.any) return condition.any.some((x) => this.test(x));
    if (condition.not) return !this.test(condition.not);
    if (condition.flag != null) {
      const val = this.services.getFlag(condition.flag);
      return val === (condition.equals !== undefined ? condition.equals : true);
    }
    if (condition.globalFlag != null) {
      const val = this.services.getGlobalFlag?.(condition.globalFlag);
      return val === (condition.equals !== undefined ? condition.equals : true);
    }
    if (condition.hasItem) return this.services.inventory.has(condition.hasItem);
    if (condition.object) {
      return this.services.getObject(condition.object) === (condition.equals ?? true);
    }
    if (condition.scoreGte != null) return (this.services.getScore?.() || 0) >= condition.scoreGte;
    if (condition.visited) return !!this.services.hasVisited?.(condition.visited);
    if (condition.moneyGte != null) return (this.services.getMoney?.() || 0) >= condition.moneyGte;
    if (condition.timerLte) return (this.services.getTimer?.(condition.timerLte.id)?.remaining ?? Infinity) <= condition.timerLte.seconds;
    if (condition.appearance) return !!this.services.hasAppearance?.(condition.appearance);
    if (condition.relationshipGte) return (this.services.getRelationship?.(condition.relationshipGte.id) || 0) >= condition.relationshipGte.value;
    return false;
  }

  async run(steps = [], context = {}) {
    if (!Array.isArray(steps)) steps = [steps];
    for (const step of steps) {
      if (!step) continue;
      if (step.when && !this.test(step.when)) continue;
      if (step.all) {
        await this.run(step.all, context);
        continue;
      }

      if (step.say !== undefined) {
        this.services.say(step.say, step.duration, {
          speaker: step.speaker,
        });
      }
      if (step.log) this.services.log?.(step.log, step.speaker);
      if (step.setFlag) this.services.setFlag(step.setFlag, step.value ?? true);
      if (step.setFlags) {
        for (const [key, value] of Object.entries(step.setFlags)) {
          this.services.setFlag(key, value);
        }
      }
      if (step.setGlobalFlag) {
        this.services.setGlobalFlag?.(step.setGlobalFlag, step.value ?? true);
      }
      if (step.setObject) this.services.setObject(step.setObject, step.value ?? true);
      if (step.setPropState) this.services.setPropState?.(step.setPropState, step.state ?? step.value);
      if (step.give) {
        const gives = Array.isArray(step.give) ? step.give : [step.give];
        for (const id of gives) this.services.inventory.give(id);
      }
      if (step.remove) {
        const removes = Array.isArray(step.remove) ? step.remove : [step.remove];
        for (const id of removes) this.services.inventory.remove(id);
      }
      if (step.score) {
        if (typeof step.score === "object") {
          this.services.awardScore?.(
            step.score.id,
            step.score.points,
            step.score.reason || step.scoreReason || step.reason
          );
        } else this.services.addScore?.(step.score, step.scoreReason || step.reason);
      }
      if (step.sfx) this.services.sfx?.(step.sfx);
      if (step.music) this.services.music?.(step.music, { loop: step.loop !== false });
      if (step.stopMusic) this.services.stopMusic?.();
      if (step.voice) this.services.voice?.(step.voice);
      if (step.effect) this.services.startEffect?.(step.effect.id || step.effect, step.effect);
      if (step.stopEffect) this.services.stopEffect?.(step.stopEffect);
      if (step.learnLine) this.services.learnLine?.(step.learnLine);
      if (step.credit) this.services.credit?.(step.credit, step.reason);
      if (step.debit) this.services.debit?.(step.debit, step.reason);
      if (step.purchase) {
        const bought = this.services.purchase?.(step.purchase);
        if (!bought && step.purchase.failSay) this.services.say(step.purchase.failSay);
      }
      if (step.startTimer) this.services.startTimer?.(step.startTimer.id, step.startTimer.seconds, step.startTimer);
      if (step.pauseTimer) this.services.pauseTimer?.(step.pauseTimer);
      if (step.cancelTimer) this.services.cancelTimer?.(step.cancelTimer);
      if (step.equip) this.services.equip?.(step.equip.slot, step.equip.id, step.equip.tags);
      if (step.groom) this.services.groom?.(step.groom.kind, step.groom.value ?? true);
      if (step.relationship) this.services.relationship?.(step.relationship.id, step.relationship.delta);
      if (step.reputation) this.services.reputation?.(step.reputation.track, step.reputation.delta);
      if (step.minigame) this.services.playMinigame?.(step.minigame.id, step.minigame, step.minigame.stake);
      if (step.wait) await this.services.wait?.(step.wait);
      if (step.fadeOut) await this.services.fadeOut?.(step.speed);
      if (step.fadeIn) await this.services.fadeIn?.(step.speed);
      if (step.flash) await this.services.flash?.(step.flash, step.flashDuration);
      if (step.cutscene) await this.services.cutscene?.(step.cutscene);
      if (step.animate) await this.services.animate?.(step.animate, step.duration);
      if (step.win) this.services.win(typeof step.win === "string" ? step.win : step.message);
      if (step.die) this.services.die?.(typeof step.die === "string" ? step.die : step.message);
      if (step.transition) {
        await this.services.transition(step.transition, context);
      }
      if (step.enable) this.services.enableHotspot?.(step.enable);
      if (step.disable) this.services.disableHotspot?.(step.disable);
      if (step.checkpoint) this.services.checkpoint?.();
    }
  }

  select(branches = []) {
    if (!Array.isArray(branches)) return null;
    return branches.find((branch) => this.test(branch.when)) || null;
  }
}
