const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseHelperResult } = require('../src/wallpaper-bridge.cjs');
test('native helper protocol accepts all supported modes and a UTF-8 BOM', () => {
  for (const mode of ['classic', 'raised', 'window']) assert.equal(parseHelperResult('\uFEFF'+JSON.stringify({ok:true,mode})).mode, mode);
});
test('localized PowerShell exception output is replaced by a stable Chinese error', () => {
  assert.throws(() => parseHelperResult(JSON.stringify({ok:false,code:'DESKTOP_HOST_UNAVAILABLE',message:'garbled output'}), new Error('exit 1')), /未找到兼容的 Windows 桌面图层/);
  assert.throws(() => parseHelperResult('bad powershell output'), /未返回有效结果/);
  assert.throws(() => parseHelperResult('', { killed: true }), /响应超时/);
  assert.throws(() => parseHelperResult(JSON.stringify({ok:true,mode:'unknown'})), /未知/);
});
