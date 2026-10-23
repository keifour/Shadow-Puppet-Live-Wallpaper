'use strict';
let processor;
function fail(error) { postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
try {
  importScripts('vendor/opencv.js', 'vision-core.js');
  const initialize = () => {
    try { processor = new self.ContourProcessor(self.cv); postMessage({ type: 'ready' }); }
    catch (error) { fail(error); }
  };
  if (self.cv.Mat) initialize();
  else self.cv.onRuntimeInitialized = initialize;
} catch (error) { fail(error); }
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'reset') { processor?.reset(); return; }
    if (data.type === 'frame' && processor) {
      const started = performance.now();
      const result = processor.process(new Uint8ClampedArray(data.buffer), data.sensitivity);
      postMessage({ type: 'result', ...result, ms: performance.now() - started }, [result.mask.buffer]);
    }
  } catch (error) { fail(error); }
};
