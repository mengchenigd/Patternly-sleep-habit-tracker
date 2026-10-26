import test from 'node:test';
import assert from 'node:assert/strict';
import { describePattern } from './public/pattern-copy.js';

test('incomplete and inconclusive observations never suggest a goal', () => {
  for (const state of ['insufficient', 'limited-variation', 'no-clear-difference', 'unknown']) {
    const copy = describePattern({ key: 'exercise', state, difference: 2 });
    assert.equal(copy.goal, null);
    assert.ok(copy.message.length);
  }
  assert.equal(describePattern(null).goal, null);
});

test('recommendations respect association direction without recommending more caffeine', () => {
  const describe = (key, difference) => describePattern({ key, difference, state: 'association' });
  assert.match(describe('exercise', 1).goal, /walk/);
  assert.equal(describe('exercise', -1).goal, null);
  assert.match(describe('caffeine', -1).goal, /smaller/);
  assert.equal(describe('caffeine', 1).goal, null);
  assert.equal(describe('mood', 1).goal, null);
  assert.match(describe('mood', -1).message, /lower/);
  assert.match(describe('screen', -1).message, /less screen/);
});
