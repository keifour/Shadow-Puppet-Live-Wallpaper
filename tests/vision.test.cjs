const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ContourProcessor } = require('../src/vision-core.js');
const runtime = new Promise((resolve, reject) => {
  const cv = require('@techstark/opencv-js');
  // OpenCV 4.x has a legacy thenable that must not be resolved directly.
  if (cv.Mat) resolve({ cv });
  else { cv.onRuntimeInitialized = () => resolve({ cv }); cv.onAbort = reject; }
});
function frame(rectangles = [], speckles = false) {
  const data = new Uint8ClampedArray(192 * 144 * 4);
  for (let i = 0; i < 192 * 144; i++) {
    let value = 30;
    const x = i % 192, y = Math.floor(i / 192);
    if (rectangles.some(([a,b,w,h]) => x >= a && x < a+w && y >= b && y < b+h)) value = 220;
    if (speckles && x % 17 === 0 && y % 13 === 0) value = 255;
    data.set([value, value, value, 255], i * 4);
  }
  return data;
}
function calibrate(p) { for (let i = 0; i < 30; i++) assert.equal(p.process(frame()).calibrating, true); }
test('background suppression, filled contours, stationary presence and recalibration', async () => {
  const { cv } = await runtime;
  const p = new ContourProcessor(cv);
  try {
    calibrate(p);
    assert.equal(p.process(frame()).count, 0);
    const result = p.process(frame([[70,40,50,60]]));
    assert.equal(result.count, 1);
    assert.ok(result.coverage > .09 && result.coverage < .15);
    assert.equal(result.mask[70 * 192 + 95], 255, 'silhouette interior must be filled');
    assert.ok(Math.abs(result.centroid[0] - 94.5/192) < .02);
    assert.ok(Math.abs(result.centroid[1] - (1 - 69.5/144)) < .02);
    for (let i = 0; i < 20; i++) assert.equal(p.process(frame([[70,40,50,60]])).count, 1);
    p.reset(); calibrate(p);
    assert.equal(p.process(frame()).coverage, 0);
    assert.throws(() => p.process(new Uint8Array(3)), /frame size/);
  } finally { p.delete(); }
});
test('isolated noise rejected, separate objects retained and repeated reset restarts calibration', async () => {
  const { cv } = await runtime;
  const p = new ContourProcessor(cv);
  try {
    calibrate(p);
    assert.equal(p.process(frame([], true)).count, 0);
    const result = p.process(frame([[20,30,30,40],[120,60,35,40]]));
    assert.equal(result.count, 2);
    for (let i = 0; i < 5; i++) { p.reset(); calibrate(p); assert.equal(p.process(frame()).count, 0); }
  } finally { p.delete(); }
});
test('sensitivity changes rebuild the background model and suppress calibration frames', async () => {
  const { cv } = await runtime;
  const p = new ContourProcessor(cv);
  try {
    calibrate(p);
    assert.equal(p.process(frame([[70,40,50,60]])).count, 1);
    const reset = p.process(frame(), .9);
    assert.equal(reset.calibrating, true);
    assert.equal(reset.coverage, 0);
    for (let i = 0; i < 29; i++) p.process(frame(), .9);
    assert.equal(p.process(frame(), .9).calibrating, false);
    assert.equal(p.process(frame([[70,40,50,60]]), .9).count, 1);
  } finally { p.delete(); }
});
