const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright-core');
(async () => {
  const root = path.resolve(__dirname, '../src');
  const server = http.createServer(async (req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
    if (req.url === '/favicon.ico') { res.writeHead(204); return res.end(); }
    try {
      const target = file === root ? path.join(root, 'index.html') : file;
      res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(target)] || 'application/octet-stream');
      res.end(await fs.readFile(target));
    } catch { res.writeHead(404); res.end(); }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
    const errors = [];
    const external = [];
    page.on('request', req => { if (!req.url().startsWith(`http://127.0.0.1:${server.address().port}/`)) external.push(req.url()); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') console.error('Browser:', msg.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const modeImages = [];
    await page.mouse.move(780, 400);
    for (const mode of ['3', '4', '1']) {
      await page.locator('#puppet-mode').selectOption(mode);
      await page.waitForTimeout(1400);
      modeImages.push(await page.locator('#scene').screenshot({ path: path.join(require('node:os').tmpdir(), `shadow-puppet-mode-${mode}.png`) }));
    }
    assert.ok(!modeImages[0].equals(modeImages[1]) && !modeImages[1].equals(modeImages[2]), 'puppet modes should render different scenes');
    await page.locator('#puppet-mode').selectOption('-1');
    await page.locator('#camera').click();
    await page.waitForFunction(() => document.querySelector('#vision-state').textContent.includes('轮廓追踪'), null, { timeout: 45000 }).catch(async error => { console.error(await page.locator('#notice').textContent(), await page.locator('#vision-state').textContent()); throw error; });
    await page.waitForFunction(() => Number(document.querySelector('#mask').dataset.contours) > 0);
    const metrics = await page.locator('#vision-metrics').textContent();
    assert.equal(await page.locator('[data-demo-action=rise]').isDisabled(), true);
    await page.locator('[data-theme="2"]').click();
    assert.equal(await page.locator('.theme.active').getAttribute('data-theme'), '2');
    await page.locator('#pause').click();
    assert.equal(await page.locator('#pause').textContent(), '继续画面 ▷');
    await page.locator('#pause').click();
    await page.locator('#recalibrate').click();
    await page.waitForFunction(() => document.querySelector('#vision-state').textContent.includes('采集背景'));
    await page.waitForFunction(() => document.querySelector('#vision-state').textContent.includes('轮廓追踪'), null, { timeout: 30000 });
    await page.locator('#camera').click();
    assert.equal(await page.evaluate(() => document.querySelector('#video').srcObject), null);
    assert.equal(await page.locator('#vision-state').textContent(), 'OpenCV · 待机');
    assert.equal(await page.locator('#recalibrate').isDisabled(), true);
    // Start/stop creates and terminates the WASM worker on each camera session.
    await page.locator('#camera').click();
    await page.waitForFunction(() => document.querySelector('#status-dot').classList.contains('live'));
    await page.locator('#camera').click();
    await page.locator('[data-demo-action=wave]').click();
    await page.waitForFunction(() => document.querySelector('#scene').dataset.symbolMode === '4');
    assert.ok((await page.locator('#action-label').textContent()).includes('演示'));
    assert.equal(await page.locator('#puppet-mode').inputValue(), '-1');
    assert.deepEqual(errors, []);
    assert.deepEqual(external, [], 'camera analysis must make no external requests');
    await page.evaluate(() => {
      const camera=document.createElement('canvas');camera.width=192;camera.height=144;
      const context=camera.getContext('2d');
      let currentPose='blank',posePhase=0;
      window.drawTestPose=kind=>{
        currentPose=kind;
        context.fillStyle='rgb(25,25,25)';context.fillRect(0,0,192,144);
        context.fillStyle='rgb(235,235,235)';
        const rect=(...args)=>context.fillRect(...args);
        if(kind!=='blank'){rect(86,48,22,77);rect(85,29,24,24);}
        if(kind==='rise'){rect(58,10,9,65);rect(128,10,9,65);rect(62,64,72,10);}
        if(kind==='spread')rect(26,55,140,12);
        if(kind==='wave'){const x=[28,48,68,108,145,118,98,58][posePhase++%8];rect(x,52,12,12);}
      };
      window.drawTestPose('blank');
      navigator.mediaDevices.getUserMedia=async()=>{
        const stream=camera.captureStream(15);
        const timer=setInterval(()=>window.drawTestPose(currentPose),66);
        const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
        track.stop=()=>{clearInterval(timer);stop();};
        return stream;
      };
    });
    await page.locator('#camera').click();
    await page.waitForFunction(() => document.querySelector('#vision-state').textContent.includes('轮廓追踪'), null, {timeout:45000}).catch(async error => { console.error(await page.evaluate(()=>({state:document.querySelector('#vision-state').textContent,notice:document.querySelector('#notice').textContent,video:document.querySelector('#video').readyState}))); throw error; });
    for(const [action,mode] of [['rise','3'],['spread','1'],['wave','4']]){
      await page.evaluate(kind=>window.drawTestPose(kind), action);
      await page.waitForFunction(({action,mode}) => document.querySelector('#scene').dataset.action===action && document.querySelector('#scene').dataset.symbolMode===mode, {action,mode}, {timeout:30000});
      assert.equal(await page.locator('#puppet-mode').inputValue(), '-1');
      assert.ok((await page.locator('#action-label').textContent()).includes('轮廓感应'));
    }
    await page.locator('#camera').click();
    // A missing runtime must show a recoverable error and release camera resources.
    await page.route('**/vision-worker.js', route => route.abort());
    await page.locator('#camera').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('无法开启摄像头'));
    assert.equal(await page.locator('#camera').isDisabled(), false);
    assert.equal(await page.evaluate(() => document.querySelector('#video').srcObject), null);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(JSON.stringify({ automaticVideoActions: ['rise -> bird', 'spread -> deer', 'wave -> fish'], metrics, recalibration: true, cameraReleased: true, restart: true, workerFailureRecovery: true, errors }));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
