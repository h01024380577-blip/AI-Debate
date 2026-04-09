const test = require('node:test');
const assert = require('node:assert');
const { createSession, getSession, addTurn, expireOlderThan, _reset } = require('../src/sessions');

test('createSession — assigns models randomly + builds matchup', () => {
  _reset();
  const seedRng = () => 0; // deterministic: gemini -> A
  const s = createSession({
    topic: 'a vs b',
    positionA: 'a',
    positionB: 'b'
  }, seedRng);

  assert.ok(s.id);
  assert.strictEqual(s.topic, 'a vs b');
  assert.deepStrictEqual(Object.keys(s.sides).sort(), ['A', 'B']);
  assert.strictEqual(s.sides.A.model, 'gemini');
  assert.strictEqual(s.sides.B.model, 'nova');
  assert.strictEqual(s.fsm.state, 'idle');
  assert.deepStrictEqual(s.history, []);
});

test('createSession — RNG >= 0.5 puts gemini on B', () => {
  _reset();
  const s = createSession({ topic: 't', positionA: 'a', positionB: 'b' }, () => 0.9);
  assert.strictEqual(s.sides.A.model, 'nova');
  assert.strictEqual(s.sides.B.model, 'gemini');
});

test('addTurn appends to history and advances FSM', () => {
  _reset();
  const s = createSession({ topic: 't', positionA: 'a', positionB: 'b' }, () => 0);
  addTurn(s.id, { side: 'A', action: 'opening', content: 'first' });
  const after = getSession(s.id);
  assert.strictEqual(after.history.length, 1);
  assert.strictEqual(after.history[0].content, 'first');
  assert.strictEqual(after.fsm.state, 'A_opened');
});

test('expireOlderThan removes stale sessions', () => {
  _reset();
  const s = createSession({ topic: 't', positionA: 'a', positionB: 'b' });
  s.createdAt = Date.now() - 99 * 60 * 1000; // 99 min ago
  expireOlderThan(60 * 60 * 1000); // 1 hour
  assert.throws(() => getSession(s.id), /Session not found/);
});

test('getSession throws on unknown id', () => {
  _reset();
  assert.throws(() => getSession('nope'), /Session not found/);
});
