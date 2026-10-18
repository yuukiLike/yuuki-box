import assert from 'node:assert/strict';
import test from 'node:test';
import { compareLookup, formatBytes, kvBytes } from '../src/lib/lab-models.mjs';
import { createAdder } from '../../docs/wasm/labs/wasm-add.mjs';

const example = { sequences: 1, layers: 32, tokens: 4096, kvHeads: 8, headDim: 128, bytesPerElement: 2 };

test('KV example is 512 MiB; context growth, concurrent sequences and head sharing scale independently', () => {
  assert.equal(kvBytes(example), 512 * 1024 ** 2);
  assert.equal(kvBytes({ ...example, tokens: 8192 }), 1024 ** 3);
  assert.equal(kvBytes({ ...example, sequences: 4 }), 2 * 1024 ** 3);
  assert.equal(kvBytes({ ...example, tokens: 8192, kvHeads: 4 }), kvBytes(example));
  assert.equal(formatBytes(kvBytes(example)), '512 MiB');
  assert.equal(formatBytes(128), '128 B');
});

test('invalid or imprecise memory inputs are rejected', () => {
  for (const tokens of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => kvBytes({ ...example, tokens }), RangeError);
  }
  assert.throws(() => kvBytes({ ...example, sequences: Number.MAX_SAFE_INTEGER }), RangeError);
});

test('lookup paths return the same object while the array scan depends on position', () => {
  const first = compareLookup(1000, 1);
  const last = compareLookup(1000, 1000);
  assert.equal(first.sameResult, true);
  assert.equal(last.sameResult, true);
  assert.equal(first.comparisons, 1);
  assert.equal(last.comparisons, 1000);
  assert.equal(last.indexEntries, 1000);
  assert.throws(() => compareLookup(10, 11), RangeError);
});

test('the actual Wasm module adds, wraps i32 boundaries, and refuses incompatible input', async () => {
  const add = await createAdder();
  assert.equal(add(21, 21), 42);
  assert.equal(add(-3, 5), 2);
  assert.equal(add(2147483647, 1), -2147483648);
  assert.equal(add(-2147483648, -1), 2147483647);
  for (const invalid of [0.5, Infinity, NaN, 2147483648]) {
    assert.throws(() => add(invalid, 1), RangeError);
  }
});
