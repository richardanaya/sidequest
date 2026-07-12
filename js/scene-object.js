export class SceneObject {
  constructor(id, definition, persisted = {}) {
    this.id = id;
    this.definition = definition;
    this.state = persisted.state || definition.initialState || "default";
  }

  setState(state) {
    if (!this.definition.states?.[state]) throw new Error(`${this.id}: unknown state ${state}`);
    this.state = state;
  }

  get visual() {
    return this.definition.states?.[this.state] || this.definition.states?.default || {};
  }

  applyTo(hotspot) {
    return { ...hotspot, ...this.visual, id: hotspot.id };
  }
}

export class SceneObjectManager {
  constructor(state) {
    this.state = state;
    this.objects = new Map();
  }

  load(roomId, definitions = {}) {
    this.roomId = roomId;
    this.objects.clear();
    const persisted = this.state.room(roomId).sceneObjects ||= {};
    for (const [id, definition] of Object.entries(definitions)) {
      const object = new SceneObject(id, definition, persisted[id]);
      this.objects.set(id, object);
    }
  }

  setState(id, state) {
    const object = this.objects.get(id);
    if (!object) throw new Error(`Unknown scene object: ${id}`);
    object.setState(state);
    this.state.room(this.roomId).sceneObjects[id] = { state };
    return object;
  }
}
