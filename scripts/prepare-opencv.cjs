const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../src/vendor');
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(require.resolve('@techstark/opencv-js'), path.join(target, 'opencv.js'));
fs.copyFileSync(require.resolve('@techstark/opencv-js/LICENSE'), path.join(target, 'OpenCV-LICENSE'));
console.log('Prepared offline OpenCV.js 4.12 runtime.');
