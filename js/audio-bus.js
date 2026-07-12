/**
 * Simple multi-channel audio bus (music / ambience / sfx / dialogue).
 * Alias of enhanced AudioManager.
 */
export class AudioBus {
  constructor() {
    this.volumes = { music: 0.7, ambience: 0.55, effects: 0.85, dialogue: 1 };
    this.tracks = new Map();
    this.muted = false;
    this.unlocked = false;
  }

  setVolumes({ music, sfx, effects, ambience, dialogue } = {}) {
    if (music != null) this.volumes.music = music;
    if (sfx != null) this.volumes.effects = sfx;
    if (effects != null) this.volumes.effects = effects;
    if (ambience != null) this.volumes.ambience = ambience;
    if (dialogue != null) this.volumes.dialogue = dialogue;
    for (const [ch, audio] of this.tracks) {
      audio.volume = this.muted ? 0 : this.volumes[ch] ?? 1;
    }
  }

  unlock() {
    this.unlocked = true;
    for (const audio of this.tracks.values()) {
      audio.play().then(() => {}).catch(() => {});
    }
  }

  play(channel, src, { loop = false, volume } = {}) {
    if (!src || typeof Audio === "undefined") return null;
    this.stop(channel);
    const audio = new Audio(src);
    audio.loop = loop;
    const vol = volume ?? this.volumes[channel] ?? 1;
    audio.volume = this.muted ? 0 : vol;
    this.tracks.set(channel, audio);
    if (this.unlocked) audio.play().catch(() => {});
    else audio.play().then(() => { this.unlocked = true; }).catch(() => {});
    return audio;
  }

  sfx(src) {
    return this.play("effects", src, { loop: false });
  }

  music(src, { loop = true } = {}) {
    return this.play("music", src, { loop });
  }

  ambience(src, { loop = true } = {}) {
    return this.play("ambience", src, { loop });
  }

  voice(src, { duck = 0.35 } = {}) {
    const music = this.tracks.get("music");
    const ambience = this.tracks.get("ambience");
    const restore = () => {
      if (music) music.volume = this.muted ? 0 : this.volumes.music;
      if (ambience) ambience.volume = this.muted ? 0 : this.volumes.ambience;
    };
    if (music) music.volume *= duck;
    if (ambience) ambience.volume *= duck;
    const voice = this.play("dialogue", src);
    if (voice) {
      voice.addEventListener("ended", restore, { once: true });
      voice.addEventListener("error", restore, { once: true });
    } else restore();
    return voice;
  }

  stop(channel) {
    const audio = this.tracks.get(channel);
    if (audio) {
      audio.pause();
      audio.src = "";
      this.tracks.delete(channel);
    }
  }

  stopAll() {
    for (const channel of [...this.tracks.keys()]) this.stop(channel);
  }

  setMuted(m) {
    this.muted = !!m;
    for (const [ch, audio] of this.tracks) {
      audio.volume = this.muted ? 0 : this.volumes[ch] ?? 1;
    }
  }
}

// Back-compat alias
export { AudioBus as AudioManager };
