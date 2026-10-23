'use strict';
const $ = id => document.getElementById(id);
const canvas = $('scene'), gl = canvas.getContext('webgl', { alpha: false, antialias: false });
const mask = $('mask'), ctx = mask.getContext('2d', { willReadFrequently: true });
const capture = document.createElement('canvas'); capture.width = 192; capture.height = 144;
const cc = capture.getContext('2d', { willReadFrequently: true });
let stream, theme = 0, sensitivity = .55, intensity = .7, paused = false, pointer = [.5, .5], motion = 0, previous, cameraBusy = false;
let noticeTimer;
function notice(text) { $('notice').textContent = text; $('notice').style.display = 'block'; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').style.display = 'none', 7000); }
if (!gl) { notice('WebGL 不可用，请确认显卡驱动与硬件加速已启用。'); throw new Error('WebGL unavailable'); }
const vertex = 'attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}';
const fragment = `precision mediump float;
uniform vec2 resolution, pointer;
uniform float time, theme, intensity, motion, camera;
uniform sampler2D silhouette;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float mountain(float x,float seed){return noise(vec2(x*3.,seed))*.24+noise(vec2(x*7.,seed))*.07;}
void main(){vec2 uv=gl_FragCoord.xy/resolution; float aspect=resolution.x/resolution.y; vec2 p=uv*vec2(aspect,1.);
vec3 tint=theme<.5?vec3(.27,.7,.56):theme<1.5?vec3(.5,.32,.91):vec3(.94,.36,.18);
vec3 col=vec3(.022,.045,.058);float moon=length((uv-vec2(.60,.68))*vec2(aspect,1.));col+=tint*.11*exp(-moon*5.);float disk=1.-smoothstep(.095,.097,moon);col+=disk*tint*.13;
for(int i=0;i<5;i++){float layer=float(i);float h=.18+layer*.075+mountain(uv.x+layer*.34,layer+2.);float fill=1.-smoothstep(h,h+.003,uv.y);col=mix(col,tint*(.035+(.11-layer*.014)),fill*.85);float ridge=exp(-abs(uv.y-h)*420.);col+=tint*ridge*.12;}
float water=1.-smoothstep(.21,.24,uv.y);float waves=sin(uv.y*210.+sin(uv.x*13.+time*.15)*2.+time*.6);col+=tint*water*max(waves,0.)*.028;
vec2 delta=(uv-pointer)*vec2(aspect,1.);float d=length(delta);float ripple=exp(-d*4.)*pow(max(sin(d*48.-time*1.8),0.),12.);col+=tint*ripple*(.08+motion*.8)*intensity;
vec2 suv=vec2(uv.x,1.-uv.y);float shape=texture2D(silhouette,suv).r;float edge=abs(shape-texture2D(silhouette,suv+vec2(.006,0.)).r)+abs(shape-texture2D(silhouette,suv+vec2(0.,.007)).r);col+=tint*(shape*.2+edge*.75)*camera*intensity;
vec2 grid=p*vec2(40.,24.);vec2 cell=floor(grid);float rnd=hash(cell);vec2 pos=fract(grid)-.5;pos.y+=sin(time*.3+rnd*20.)*.3;float particle=exp(-length(pos)*90.);col+=tint*particle*step(.92,rnd)*(.4+motion*2.);
col+=tint*.017*noise(p*5.+vec2(time*.025,0.));float vignette=1.-.3*length(uv-.5);gl_FragColor=vec4(col*vignette,1.);}`;
function shader(type, source) { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { notice('着色器编译失败，请更新显卡驱动。'); throw new Error(gl.getShaderInfoLog(s)); } return s; }
const program = gl.createProgram(); gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program); const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
const position = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
const uniforms = Object.fromEntries(['resolution','pointer','time','theme','intensity','motion','camera','silhouette'].map(n=>[n, gl.getUniformLocation(program,n)]));
const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.uniform1i(uniforms.silhouette,0);
ctx.fillStyle='#000'; ctx.fillRect(0,0,192,144);
function stopCamera(message = '演示模式 · 移动鼠标，唤起涟漪') { const active = stream; stream = null; active?.getTracks().forEach(t=>t.stop()); $('video').srcObject = null; previous = null; motion = 0; ctx.fillStyle='#000'; ctx.fillRect(0,0,192,144); $('camera').textContent='开启摄像头 ↗'; $('camera-label').textContent='摄像头尚未开启'; $('status').textContent=message; $('status-dot').classList.remove('live'); }
$('camera').onclick=async()=>{ if(cameraBusy)return; if(stream){stopCamera();return;} cameraBusy=true; $('camera').disabled=true;
try { if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前环境不支持摄像头'); stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:320},height:{ideal:240},frameRate:{ideal:15,max:15}}}); $('video').srcObject=stream; await $('video').play(); stream.getVideoTracks()[0].onended=()=>stopCamera('摄像头连接已断开 · 已切换演示'); $('camera').textContent='关闭摄像头 ◉'; $('camera-label').textContent='本地轮廓分析中'; $('status').textContent='摄像头已连接 · 挥动双手，让光影生长'; $('status-dot').classList.add('live'); } catch(e) {stopCamera();notice(`无法开启摄像头：${e.message}。可继续使用鼠标演示。`);} finally {cameraBusy=false; $('camera').disabled=false;} };
function analyze(){ if(!stream||$('video').readyState<2)return; cc.save(); cc.translate(192,0); cc.scale(-1,1); cc.drawImage($('video'),0,0,192,144); cc.restore(); const input=cc.getImageData(0,0,192,144), out=ctx.createImageData(192,144), gray=new Uint8Array(192*144); let count=0,xsum=0,ysum=0; const threshold=40-sensitivity*34;
for(let i=0;i<gray.length;i++){const j=i*4;gray[i]=input.data[j]*.299+input.data[j+1]*.587+input.data[j+2]*.114;const diff=previous?Math.abs(gray[i]-previous[i]):0; const v=diff>threshold?255:0;out.data[j]=out.data[j+1]=out.data[j+2]=v;out.data[j+3]=255;if(v){count++;xsum+=i%192;ysum+=Math.floor(i/192);}}
previous=gray;ctx.putImageData(out,0,0);motion=motion*.7+Math.min(count/1800,1)*.3;if(count>30){pointer[0]=pointer[0]*.7+xsum/count/192*.3;pointer[1]=pointer[1]*.7+(1-ysum/count/144)*.3;}}
document.querySelectorAll('.theme').forEach(button=>button.onclick=()=>{ theme=Number(button.dataset.theme);document.querySelector('.theme.active').classList.remove('active');button.classList.add('active');});
for(const name of ['sensitivity','intensity']) $(name).oninput=e=>{ const value=Number(e.target.value);$(name+'-value').textContent=value+'%';if(name==='sensitivity')sensitivity=value/100;else intensity=value/100;};
window.addEventListener('pointermove',e=>{if(!stream){pointer=[e.clientX/innerWidth,1-e.clientY/innerHeight];motion=.25;}});
$('wallpaper').onclick=async()=>{if(!window.desktop)return notice('请通过 Windows 桌面程序使用壁纸模式。');const result=await window.desktop.toggleWallpaper();if(result.error)notice(result.error);};
window.desktop?.onWallpaper(active=>document.body.classList.toggle('wallpaper',active));
$('minimize').onclick=()=>window.desktop?.minimize();
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'继续画面 ▷':'暂停画面 Ⅱ';};
window.addEventListener('beforeunload',()=>stopCamera());
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopCamera();notice('图形上下文已丢失，请重启程序。');});
let last=0,lastAnalyze=0,frames=0,fpsStart=0,elapsed=0;
function frame(now){requestAnimationFrame(frame);if(now-last<1000/30)return;const dt=Math.min((now-last)/1000,.1);last=now;if(paused)return;elapsed+=dt;if(now-lastAnalyze>1000/15){analyze();lastAnalyze=now;}if(!stream)motion*=.97;
const scale=Math.min(devicePixelRatio,1.5);const w=Math.round(innerWidth*scale),h=Math.round(innerHeight*scale);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mask);gl.uniform2f(uniforms.resolution,w,h);gl.uniform2f(uniforms.pointer,...pointer);gl.uniform1f(uniforms.time,elapsed);gl.uniform1f(uniforms.theme,theme);gl.uniform1f(uniforms.intensity,intensity);gl.uniform1f(uniforms.motion,motion);gl.uniform1f(uniforms.camera,stream?1:0);gl.drawArrays(gl.TRIANGLES,0,6);frames++;if(now-fpsStart>1000){$('fps').textContent=Math.round(frames*1000/(now-fpsStart))+' FPS';frames=0;fpsStart=now;}}
requestAnimationFrame(frame);
