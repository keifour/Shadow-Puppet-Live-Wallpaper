const { test }=require('node:test');
const assert=require('node:assert/strict');
const {GestureRecognizer,silhouetteFeatures}=require('../src/gesture-core.js');
function person(kind){
  const mask=new Uint8Array(192*144);
  const rect=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)mask[j*192+i]=255;};
  rect(86,48,22,77);rect(85,29,24,24);
  if(kind==='rise'){rect(58,10,9,65);rect(128,10,9,65);rect(62,64,72,10);}
  if(kind==='spread')rect(26,55,140,12);
  return {features:silhouetteFeatures(mask,192,144),count:1,centroid:[.5,.46],calibrating:false};
}
function hold(r,frame,start=0,end=600){let result;for(let t=start;t<=end;t+=80)result=r.update(frame,t);return result;}
test('actual silhouette features distinguish raised arms, spread arms and a neutral body',()=>{
  for(const kind of ['rise','spread','still']){const r=new GestureRecognizer();assert.equal(hold(r,person(kind)).key,kind);}
});
test('two horizontal reversals produce fish, while one translation does not',()=>{
  const r=new GestureRecognizer();let result;
  const xs=[.3,.38,.47,.58,.65,.55,.45,.35,.43,.53,.63,.54,.44,.34,.44,.55,.64];
  xs.forEach((x,i)=>result=r.update({...person('still'),centroid:[x,.46]},i*80));
  assert.equal(result.key,'wave');assert.equal(result.mode,4);
  const straight=new GestureRecognizer();
  for(let i=0;i<20;i++)assert.notEqual(straight.update({...person('still'),centroid:[.2+i*.025,.46]},i*80).key,'wave');
});
test('brief shape noise cannot switch characters and a held gesture has a cooldown',()=>{
  const r=new GestureRecognizer();hold(r,person('rise'));
  assert.equal(r.update(person('spread'),640).key,'rise');
  assert.equal(r.update(person('rise'),720).key,'rise');
  assert.equal(hold(r,person('spread'),800,1600).key,'spread');
});
test('calibration, camera gaps and empty masks cannot create stale gestures',()=>{
  const r=new GestureRecognizer();hold(r,person('spread'));
  assert.equal(r.update({count:0,features:null,centroid:null},3000).key,'still');
  assert.equal(r.update({...person('rise'),calibrating:true},3100).stability,0);
  assert.equal(silhouetteFeatures(new Uint8Array(192*144),192,144),null);
});
test('static foreground has no movement energy',()=>{
  const r=new GestureRecognizer();assert.equal(hold(r,person('spread')).energy,0);
});

test('a waving hand is detected while the body centroid stays still',()=>{
  const recognizer=new GestureRecognizer();let result;
  const positions=[28,48,68,108,145,118,98,58,28,48,68,108,145,118,98,58,28,48,68,108,145];
  for(let n=0;n<positions.length;n++){
    const mask=new Uint8Array(192*144);
    const rect=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)mask[j*192+i]=255;};
    rect(86,48,22,77);rect(85,29,24,24);rect(positions[n],52,12,12);
    result=recognizer.update({mask,features:silhouetteFeatures(mask,192,144),count:1,centroid:[.5,.5]},n*80);
  }
  assert.equal(result.key,'wave');
});
