const { v4: uuidv4 } = require('uuid');
const { initialState, applyAction } = require('./stateMachine');
const { PERSONAS } = require('./personas');

const sessions = new Map();

function _reset() {
  sessions.clear();
}

function createSession({ topic, positionA, positionB }, rng = Math.random) {
  // Random model assignment: gemini on A if rng < 0.5, otherwise gemini on B.
  const geminiOnA = rng() < 0.5;
  const sides = {
    A: {
      position: positionA,
      persona: geminiOnA ? PERSONAS.hanjiho : PERSONAS.leeseoyeon,
      model: geminiOnA ? 'gemini' : 'nova'
    },
    B: {
      position: positionB,
      persona: geminiOnA ? PERSONAS.leeseoyeon : PERSONAS.hanjiho,
      model: geminiOnA ? 'nova' : 'gemini'
    }
  };

  const session = {
    id: uuidv4(),
    topic,
    positionA,
    positionB,
    sides,
    history: [],
    fsm: initialState(),
    createdAt: Date.now()
  };
  sessions.set(session.id, session);
  return session;
}

function getSession(id) {
  const s = sessions.get(id);
  if (!s) throw new Error(`Session not found: ${id}`);
  return s;
}

function addTurn(id, { side, action, content }) {
  const s = getSession(id);
  s.fsm = applyAction(s.fsm, action);
  s.history.push({ side, action, content, timestamp: Date.now() });
  return s;
}

function deleteSession(id) {
  sessions.delete(id);
}

function expireOlderThan(ms) {
  const cutoff = Date.now() - ms;
  for (const [id, s] of sessions.entries()) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}

module.exports = {
  createSession,
  getSession,
  addTurn,
  deleteSession,
  expireOlderThan,
  _reset
};
