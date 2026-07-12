export class ConversationSystem {
  constructor({ state, runtime, dialogue }) {
    this.state = state;
    this.runtime = runtime;
    this.dialogue = dialogue;
    this.graphs = {};
    this.current = null;
  }

  load(graphs = {}) {
    this.graphs = graphs;
  }

  async start(id, nodeId = null) {
    const graph = this.graphs[id];
    if (!graph) throw new Error(`Unknown conversation: ${id}`);
    this.dialogue.clear();
    this.current = { id, nodeId: nodeId || graph.start };
    return this.enter(this.current.nodeId);
  }

  async enter(nodeId) {
    const graph = this.graphs[this.current.id];
    const node = graph.nodes[nodeId];
    if (!node) throw new Error(`Conversation ${this.current.id}: missing node ${nodeId}`);
    this.current.nodeId = nodeId;
    if (node.steps) await this.runtime.run(node.steps);
    const choices = (node.choices || []).filter((choice) => {
      if (choice.when && !this.runtime.test(choice.when)) return false;
      if (choice.once && this.state.conversations?.[`${this.current.id}.${choice.id}`]) return false;
      return true;
    });
    this.dialogue.say(node.text || "", node.duration, { speaker: node.speaker, choices });
    return choices;
  }

  async choose(index) {
    const choice = this.dialogue.current?.choices?.[index];
    if (!choice || !this.current) return false;
    this.state.conversations ||= {};
    this.state.conversations[`${this.current.id}.${choice.id}`] = true;
    if (choice.learn) this.learn(choice.learn);
    if (choice.steps) await this.runtime.run(choice.steps);
    if (choice.next) await this.enter(choice.next);
    else this.end();
    return true;
  }

  learn(line) {
    this.state.learnedLines ||= [];
    if (!this.state.learnedLines.includes(line)) this.state.learnedLines.push(line);
  }

  knows(line) {
    return this.state.learnedLines?.includes(line) || false;
  }

  matchResponse(line, responses = {}) {
    return responses[line] || responses.default || null;
  }

  end() {
    this.current = null;
    this.dialogue.clear();
  }
}
