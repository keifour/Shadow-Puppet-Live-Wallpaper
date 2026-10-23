'use strict';
// Procedural cut-paper shapes: driven by position/energy, never semantic recognition.
window.puppetShader = `
float limb(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa=p-a, ba=b-a;
  float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
  return 1.-smoothstep(r,r+.003,length(pa-ba*h));
}
float oval(vec2 p,vec2 center,vec2 radius) {
  return 1.-smoothstep(.96,1.04,length((p-center)/radius));
}
float deerShape(vec2 q,float t,float energy) {
  q.y-=sin(t*4.)*.008*energy;
  float body=oval(q,vec2(0.,0.),vec2(.145,.062));
  float shape=max(body,limb(q,vec2(.09,.015),vec2(.16,.12),.024));
  shape=max(shape,oval(q,vec2(.17,.127),vec2(.045,.03)));
  shape=max(shape,oval(q,vec2(.155,.159),vec2(.014,.028)));
  shape=max(shape,limb(q,vec2(-.13,.01),vec2(-.19,.06),.009));
  for(int i=0;i<4;i++) {
    float k=float(i), x=i<2?-.09:.09;
    float gait=sin(t*(2.+energy*5.)+k*2.4)*(.008+energy*.04);
    vec2 hip=vec2(x,-.035), knee=vec2(x+gait,-.115), hoof=vec2(x-gait,-.20);
    shape=max(shape,limb(q,hip,knee,.009));
    shape=max(shape,limb(q,knee,hoof,.006));
    shape=max(shape,limb(q,hoof,hoof+vec2(.018,-.003),.007));
  }
  shape=max(shape,limb(q,vec2(.155,.15),vec2(.139,.25),.005));
  shape=max(shape,limb(q,vec2(.139,.21),vec2(.101,.239),.004));
  shape=max(shape,limb(q,vec2(.144,.19),vec2(.174,.216),.004));
  shape=max(shape,limb(q,vec2(.169,.15),vec2(.202,.246),.005));
  shape=max(shape,limb(q,vec2(.193,.22),vec2(.226,.229),.004));
  shape=max(shape,limb(q,vec2(.183,.19),vec2(.161,.22),.004));
  float eye=oval(q,vec2(.184,.138),vec2(.004,.004));
  float carving=body*step(.92,sin(q.x*115.)*sin(q.y*115.));
  return shape*(1.-max(eye,carving));
}
float figureShape(vec2 q,float t) {
  float shape=oval(q,vec2(0.,.14),vec2(.035,.042));
  shape=max(shape,oval(q,vec2(0.,.02),vec2(.055,.09)));
  shape=max(shape,limb(q,vec2(-.035,.08),vec2(-.10,.02),.012));
  shape=max(shape,limb(q,vec2(-.10,.02),vec2(-.15,.10+sin(t)*.02),.009));
  shape=max(shape,limb(q,vec2(.035,.08),vec2(.10,.12),.012));
  shape=max(shape,limb(q,vec2(.10,.12),vec2(.14,.20+sin(t)*.02),.009));
  shape=max(shape,limb(q,vec2(-.02,-.04),vec2(-.05,-.18),.012));
  return max(shape,limb(q,vec2(.02,-.04),vec2(.07,-.18),.012));
}`;
