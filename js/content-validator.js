const ID = /^[a-z0-9_-]+$/i;

export class ContentValidator {
  validateRegistry(data) {
    this.requireObject(data, "content.json");
    for (const type of ["rooms", "characters"]) {
      this.requireObject(data[type], `content.${type}`);
      for (const [id, entry] of Object.entries(data[type])) {
        if (!ID.test(id) || !entry?.path) throw new Error(`Invalid ${type} entry: ${id}`);
      }
    }
    return data;
  }

  validateRoom(room, expectedId) {
    this.requireObject(room, "room");
    if (!ID.test(room.id || "") || (expectedId && room.id !== expectedId)) {
      throw new Error(`Invalid room id: ${room.id}`);
    }
    if (!room.backdrop || !Array.isArray(room.sceneSize) || !room.slots) {
      throw new Error(`Room ${room.id} requires backdrop, sceneSize, and slots`);
    }
    for (const [id, slot] of Object.entries(room.slots)) {
      if (!ID.test(id)) throw new Error(`Room ${room.id}: invalid slot id ${id}`);
      for (const key of ["walkX", "hx", "hy", "hw", "hh"]) {
        if (slot[key] != null && !Number.isFinite(slot[key])) {
          throw new Error(`Room ${room.id}: slots.${id}.${key} must be a number`);
        }
      }
      if (!slot.noSprite && !slot.prop) {
        throw new Error(`Room ${room.id}: slots.${id}.prop is required`);
      }
    }
    for (const [direction, exit] of Object.entries(room.exits || {})) {
      if (!exit?.room || !ID.test(exit.room)) {
        throw new Error(`Room ${room.id}: exits.${direction}.room is invalid`);
      }
    }
    return room;
  }

  validateCharacter(character, expectedId) {
    if (!ID.test(character?.id || "") || character.id !== expectedId) {
      throw new Error(`Invalid character id: ${character?.id}`);
    }
    if (!character.art?.idle || !character.art?.walk) {
      throw new Error(`Character ${character.id} requires idle and walk art`);
    }
    return character;
  }

  validateScript(script) {
    if (!script) return null;
    this.requireObject(script, "script");
    if (script.version !== 1) throw new Error(`Unsupported script version: ${script.version}`);
    if (script.recipes && !Array.isArray(script.recipes)) throw new Error("script.recipes must be an array");
    for (const recipe of script.recipes || []) {
      if (!Array.isArray(recipe.items) || recipe.items.length < 2) {
        throw new Error("Each recipe requires at least two item ids");
      }
    }
    for (const [id, conversation] of Object.entries(script.conversations || {})) {
      this.requireObject(conversation.nodes, `conversation ${id}.nodes`);
      if (!conversation.start || !conversation.nodes[conversation.start]) {
        throw new Error(`Conversation ${id} has an invalid start node`);
      }
      for (const [nodeId, node] of Object.entries(conversation.nodes)) {
        for (const choice of node.choices || []) {
          if (choice.next && !conversation.nodes[choice.next]) {
            throw new Error(`Conversation ${id}.${nodeId} references missing node ${choice.next}`);
          }
        }
      }
    }
    for (const [id, game] of Object.entries(script.minigames || {})) {
      if (!Array.isArray(game.outcomes) || !game.outcomes.length) {
        throw new Error(`Minigame ${id} requires outcomes`);
      }
      let previous = 0;
      for (const outcome of game.outcomes) {
        if (outcome.chance <= previous || outcome.chance > 1) {
          throw new Error(`Minigame ${id} outcome chances must be increasing cumulative values <= 1`);
        }
        previous = outcome.chance;
      }
    }
    return script;
  }

  requireObject(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${name} must be an object`);
    }
  }
}
