'use strict';
let processor, gestures;
function fail(error) { postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
try {
  importScripts('vendor/opencv.js', 'vision-core.js', 'gesture-core.js');
  const initialize = () => {
    try { processor = new self.ContourProcessor(self.cv); gestures = new self.GestureRecognizer(); postMessage({ type: 'ready' }); }
    catch (error) { fail(error); }
  };
  if (self.cv.Mat) initialize();
  else self.cv.onRuntimeInitialized = initialize;
} catch (error) { fail(error); }
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'reset') { processor?.reset(); gestures?.reset(); return; }
    if (data.type === 'frame' && processor) {
      const started = performance.now();
      const result = processor.process(new Uint8ClampedArray(data.buffer), data.sensitivity);
      const features = self.silhouetteFeatures(result.mask, 192, 144);
      const action = gestures.update({ ...result, features }, performance.now());
      postMessage({ type: 'result', ...result, action, ms: performance.now() - started }, [result.mask.buffer]);
    }
  } catch (error) { fail(error); }
};
