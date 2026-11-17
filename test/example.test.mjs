// The link codecs of site/assets/js/example.js (links, reset and Save image): how a
// value is written in a link and read back. The page side is in browser-tests/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../site/assets/js/example.js';

const { codecs: C, numbers, query } = globalThis.MM.example;

test('numbers: four decimals, a fraction where decimals would lose it, never minus zero', () => {
  assert.equal(C.numbers.write([0.123456, -0, 2, 0.25, -1e-7]), '0.1235,0,2,0.25,0');
  assert.equal(C.number.write(-4 / 3), '-4/3');
  assert.equal(C.number.write(1 / 7), '1/7');
  assert.equal(C.number.write(0.3), '0.3', 'a fraction only where decimals are not exact');
  assert.equal(C.numbers.write([1e-11, -2e-12, 0.5 + 1e-10]), '0,0,0.5', 'not 0/2 or 1/2 for a rounding error');
  assert.equal(C.number.write(Math.PI), '3.1416');
  assert.equal(numbers(2).write([0.123, 1 / 3]), '0.12,1/3');
  assert.deepEqual(C.numbers.read('1/3,-0.5,.25,2,-4/3'), [1 / 3, -0.5, 0.25, 2, -4 / 3]);
  assert.deepEqual(C.numbers.read(''), []);
  for (const bad of ['x', '1,,2', '1/0', '--1', '1e3', '0x10', 'NaN', '1/-3', ' 1']) assert.throws(() => C.numbers.read(bad), bad);
});

test('rotations round-trip as four numbers, whatever the angle', () => {
  const rot = (axis, t) => {
    const n = Math.hypot(...axis), [x, y, z] = axis.map((a) => a / n), c = Math.cos(t), s = Math.sin(t), k = 1 - c;
    return [[c + x * x * k, x * y * k - z * s, x * z * k + y * s], [y * x * k + z * s, c + y * y * k, y * z * k - x * s], [z * x * k - y * s, z * y * k + x * s, c + z * z * k]];
  };
  const cases = [[[1, 0, 0], 0], [[0, 0, 1], Math.PI / 2], [[1, 2, 3], Math.PI], [[0, 1, 0], Math.PI], [[-1, 0.3, 2], 2.7], [[0.2, -0.5, 0.1], -1.1]];
  for (let i = 0; i < 20; i++) cases.push([[Math.sin(i), Math.cos(3 * i), Math.sin(7 * i) + 0.1], i * 0.37]);
  for (const [axis, t] of cases) {
    const R = rot(axis, t), text = C.rotation.write(R), back = C.rotation.read(text);
    assert.equal(text.split(',').length, 4, text);
    R.forEach((row, i) => row.forEach((v, j) => assert.ok(Math.abs(back[i][j] - v) < 3e-4, text)));
    assert.ok(+text.split(',')[0] >= 0, 'w ≥ 0, so a rotation has one way of being written');
  }
  for (const bad of ['1,0,0', '0,0,0,0', '1,0,0,x']) assert.throws(() => C.rotation.read(bad), bad);
});

test('Cartan matrices: the size, then the bonds', () => {
  const A4 = [[2, -1, 0, 0], [-1, 2, -1, 0], [0, -1, 2, -1], [0, 0, -1, 2]];
  assert.equal(C.cartan.write(A4), '4.01.12.23');
  assert.equal(C.cartan.write([[2, -1], [-2, 2]]), '2.0112');
  assert.equal(C.cartan.write([]), '0');
  assert.deepEqual(C.cartan.read('4.01.12.23'), A4);
  const big = Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => (i === j ? 2 : Math.abs(i - j) === 1 ? -((i + j) % 4 + 1) : 0)));
  big[0][11] = big[11][0] = -1;
  assert.deepEqual(C.cartan.read(C.cartan.write(big)), big);
  for (const bad of ['', 'x', '2.10', '2.02', '2.01.01', '2.011', '2.0110', '2.01x', '36']) assert.throws(() => C.cartan.read(bad), bad);
});

test('flags, whole numbers and names', () => {
  assert.equal(C.flag.write(true), '1');
  assert.equal(C.flag.read('0'), false);
  assert.equal(C.int.read('-3'), -3);
  assert.equal(C.text.read('a1-1'), 'a1-1');
  for (const [codec, bad] of [[C.flag, 'true'], [C.flag, '2'], [C.int, '1.5'], [C.int, ''], [C.text, 'a b'], [C.text, '<b>']]) assert.throws(() => codec.read(bad), bad);
});

test('a link names only what differs from the page\'s own example', () => {
  assert.equal(query({ t: 'b2', n: '0.6,0.8', k: '1' }, { t: 'a2', n: '0,1', k: '1' }), '?t=b2&n=0.6,0.8');
  assert.equal(query({ t: 'a2' }, { t: 'a2' }), '');
  assert.equal(query({ k: '-4/3', p: '' }, { k: '1', p: '0,1' }), '?k=-4/3&p=', 'commas and slashes as they are; an emptied field is named');
});
