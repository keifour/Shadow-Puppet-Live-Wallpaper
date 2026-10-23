(function (root) {
  'use strict';
  const SYMBOLS = {
    rise: { label: '上举 · 化羽', name: '飞鸟', mode: 3, hint: '把手臂举高，唤起飞鸟' },
    spread: { label: '展开 · 生鹿', name: '灵鹿', mode: 1, hint: '展开双臂，让灵鹿入林' },
    wave: { label: '横挥 · 游鱼', name: '游鱼', mode: 4, hint: '左右往复挥动，唤起游鱼' },
    still: { label: '静候 · 墨息', name: '墨息', mode: 2, hint: '收起双臂，自然站立，让意象散为水墨' }
  };
  function silhouetteFeatures(mask, width, height) {
    let minX=width, maxX=-1, minY=height, maxY=-1, count=0;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(mask[y*width+x]) {
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);count++;
    }
    if(!count)return null;
    const boxW=maxX-minX+1,boxH=maxY-minY+1;
    let branches=0, upperSpan=0, middleSpan=0,branchStart=1;
    for(let y=minY;y<=maxY;y++) {
      let runs=0,run=0,left=width,right=-1;
      for(let x=minX;x<=maxX+1;x++) {
        if(x<=maxX && mask[y*width+x]) {run++;left=Math.min(left,x);right=x;}
        else {if(run>=3)runs++;run=0;}
      }
      const band=(y-minY)/boxH;
      if(band<.36){if(runs>=2)branchStart=Math.min(branchStart,band);branches=Math.max(branches,runs);upperSpan=Math.max(upperSpan,right-left+1);}
      if(band>=.25&&band<.65)middleSpan=Math.max(middleSpan,right-left+1);
    }
    return { x:minX/width,y:minY/height,width:boxW/width,height:boxH/height,
      aspect:boxW/boxH,branches,branchStart,upperSpan:upperSpan/boxW,middleSpan:middleSpan/boxH,coverage:count/(width*height) };
  }
  class GestureRecognizer {
    constructor(){this.reset();}
    reset(){this.history=[];this.current='still';this.candidate='still';this.since=0;this.changed=-Infinity;this.lastSeen=null;this.lastSample=null;this.lastTime=null;this.previousMask=null;}
    update(frame, now) {
      if(frame.calibrating){this.reset();return this.result('still',0,0,false);}
      if(this.lastTime!==null&&now-this.lastTime>650){this.history=[];this.candidate='still';this.since=now;this.lastSample=null;}
      this.lastTime=now;
      const f=frame.features;
      if(!f||!frame.centroid||frame.count===0){
        this.history=[];this.lastSample=null;this.previousMask=null;this.candidate='still';this.since=now;
        if(this.lastSeen!==null&&now-this.lastSeen>1800){this.current='still';this.changed=now;}
        return this.result(this.current,0,0,false);
      }
      this.lastSeen=now;
      let position=frame.centroid,changedPixels=0;
      if(frame.mask){
        position=null;
        if(this.previousMask&&this.previousMask.length===frame.mask.length){
          let x=0,y=0;
          for(let i=0;i<frame.mask.length;i++)if(frame.mask[i]!==this.previousMask[i]){changedPixels++;x+=i%192;y+=Math.floor(i/192);}
          if(changedPixels>=24)position=[x/changedPixels/192,1-y/changedPixels/144];
        }
        // Output masks are transferred out of the worker; retain an owned copy.
        this.previousMask=frame.mask.slice();
      }
      if(this.lastSample&&now-this.lastSample.t>650){this.history=[];this.lastSample=null;}
      let speed=0;
      if(position){
        const sample={x:position[0],y:1-position[1],t:now};
        const previous=this.lastSample,dt=previous?Math.max((now-previous.t)/1000,.025):1;
        speed=previous?Math.hypot(sample.x-previous.x,sample.y-previous.y)/dt:0;
        this.lastSample=sample;this.history.push(sample);
      }
      const energy=Math.min(1,speed*.55+changedPixels/(192*144)*10);
      this.history=this.history.filter(p=>now-p.t<=1300);
      let reversals=0,lastDirection=0,lastTurningX=this.history.length?this.history[0].x:0;
      for(const p of this.history){
        const delta=p.x-lastTurningX;
        if(Math.abs(delta)>.035){const direction=Math.sign(delta);if(lastDirection&&direction!==lastDirection)reversals++;lastDirection=direction;lastTurningX=p.x;}
      }
      const xs=this.history.map(p=>p.x),ys=this.history.map(p=>p.y);
      const xTravel=xs.length?Math.max(...xs)-Math.min(...xs):0,yTravel=ys.length?Math.max(...ys)-Math.min(...ys):0;
      let next='still',score=.65;
      if(reversals>=2&&xTravel>.16&&yTravel<.20){next='wave';score=.93;}
      else if(f.branches>=2&&f.branchStart<.22&&f.upperSpan>.55&&f.y<.35&&f.height>.24&&f.aspect<1.3){next='rise';score=.85;}
      else if(f.aspect>1.18&&f.width>.36&&f.middleSpan>1.1){next='spread';score=.87;}
      if(next!==this.candidate){this.candidate=next;this.since=now;}
      const dwell=next==='still'?1800:320;
      if(next!==this.current&&now-this.since>=dwell&&now-this.changed>=1200){this.current=next;this.changed=now;}
      const stability=next===this.current?score:Math.min(.6,(now-this.since)/dwell*.6);
      return this.result(this.current,stability,energy,true);
    }
    result(key,stability,energy,present){return {key,...SYMBOLS[key],stability,energy,present};}
  }
  const exports={GestureRecognizer,silhouetteFeatures,SYMBOLS};
  if(typeof module==='object'&&module.exports)module.exports=exports;
  else Object.assign(root,exports);
})(typeof self==='object'?self:globalThis);
