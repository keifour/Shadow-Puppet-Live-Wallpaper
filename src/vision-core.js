/* Shared by the analysis worker and deterministic Node tests. */
(function (root) {
  'use strict';
  class ContourProcessor {
    constructor(cv, width = 192, height = 144) {
      this.cv = cv; this.width = width; this.height = height;
      this.source = new cv.Mat(height, width, cv.CV_8UC4);
      this.gray = new cv.Mat(); this.blurred = new cv.Mat();
      this.foreground = new cv.Mat(); this.clean = new cv.Mat();
      this.mask = cv.Mat.zeros(height, width, cv.CV_8UC1);
      this.kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
      this.reset();
    }
    reset(sensitivity = this.sensitivity ?? .55) {
      this.sensitivity = Math.max(0, Math.min(1, sensitivity));
      this.background?.delete();
      this.background = new this.cv.BackgroundSubtractorMOG2(300, 48 - this.sensitivity * 40, false);
      this.calibration = 30;
    }
    process(rgba, sensitivity = .55) {
      const cv = this.cv;
      if (rgba.length !== this.width * this.height * 4) throw new Error('Invalid frame size');
      sensitivity = Math.max(0, Math.min(1, sensitivity));
      if (sensitivity !== this.sensitivity) this.reset(sensitivity);
      this.source.data.set(rgba);
      cv.cvtColor(this.source, this.gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(this.gray, this.blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
      const calibrating = this.calibration > 0;
      this.background.apply(this.blurred, this.foreground, calibrating ? .2 : .001);
      if (calibrating) this.calibration--;
      this.mask.setTo(new cv.Scalar(0));
      let area = 0, xsum = 0, ysum = 0, count = 0;
      if (!calibrating) {
        cv.morphologyEx(this.foreground, this.clean, cv.MORPH_OPEN, this.kernel);
        cv.morphologyEx(this.clean, this.clean, cv.MORPH_CLOSE, this.kernel);
        const contours = new cv.MatVector(), hierarchy = new cv.Mat();
        try {
          cv.findContours(this.clean, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
          const minArea = 25 + (1 - sensitivity) * 100;
          for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            try {
              const size = cv.contourArea(contour);
              if (size < minArea) continue;
              const m = cv.moments(contour, false);
              if (m.m00 === 0) continue;
              cv.drawContours(this.mask, contours, i, new cv.Scalar(255), -1);
              area += size; xsum += m.m10; ysum += m.m01; count++;
            } finally { contour.delete(); }
          }
        } finally { contours.delete(); hierarchy.delete(); }
      }
      return {
        mask: this.mask.data.slice(), count, area,
        centroid: area > 0 ? [xsum / area / this.width, 1 - ysum / area / this.height] : null,
        coverage: cv.countNonZero(this.mask) / (this.width * this.height),
        calibrating, progress: (30 - this.calibration) / 30
      };
    }
    delete() {
      for (const name of ['source', 'gray', 'blurred', 'foreground', 'clean', 'mask', 'kernel', 'background']) {
        this[name]?.delete(); this[name] = null;
      }
    }
  }
  if (typeof module === 'object' && module.exports) module.exports = { ContourProcessor };
  else root.ContourProcessor = ContourProcessor;
})(typeof self === 'object' ? self : globalThis);
