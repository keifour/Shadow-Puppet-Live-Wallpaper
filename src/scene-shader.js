'use strict';
window.sceneShader = `precision mediump float;
uniform vec2 resolution,pointer,anchor;
uniform float time,theme,intensity,motion,camera,puppetMode,previousMode,transition,presence,facing;
uniform sampler2D silhouette;
${window.puppetShader}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float terrain(float x,float seed){return noise(vec2(x*3.,seed))*.17+noise(vec2(x*8.,seed))*.055+noise(vec2(x*18.,seed))*.018;}
void main(){
  vec2 uv=gl_FragCoord.xy/resolution;float aspect=resolution.x/resolution.y;vec2 p=uv*vec2(aspect,1.);
  vec3 tint=theme<.5?vec3(.30,.73,.61):theme<1.5?vec3(.58,.43,.87):vec3(.88,.39,.25);
  vec3 gold=theme<1.5?vec3(.94,.77,.45):vec3(1.,.75,.47);
  vec3 col=mix(vec3(.016,.031,.041),tint*.13,pow(uv.y,1.4));
  vec2 moonPos=vec2(.57,.72);float moon=length((uv-moonPos)*vec2(aspect,1.));
  col+=tint*.13*exp(-moon*5.5);
  float disk=1.-smoothstep(.071,.0725,moon);
  col+=mix(gold,tint,.5)*disk*.25;
  col+=gold*.055*(1.-smoothstep(.0008,.002,abs(moon-.084)));
  col+=tint*.045*(1.-smoothstep(.0006,.0015,abs(moon-.091)));
  float haze=sin(uv.x*5.+time*.035)*.015+noise(vec2(uv.x*3.,time*.025))*.025;
  for(int i=0;i<5;i++){
    float layer=float(i),height=.29-layer*.047+terrain(uv.x+layer*.29,layer+2.);
    float fill=1.-smoothstep(height,height+.003,uv.y);
    vec3 mountain=tint*(.13-layer*.019)+vec3(.006,.014,.016);
    col=mix(col,mountain,fill*.94);
    col+=tint*.038*exp(-abs(uv.y-height-haze)*55.)*(1.-layer*.15);
    col+=gold*exp(-abs(uv.y-height)*600.)*.018;
  }
  for(int i=0;i<12;i++){
    float k=float(i),x=fract(k*.313+.04),h=.065+hash(vec2(k,4.))*.13;
    vec2 tree=vec2((uv.x-x)*aspect,uv.y-.12);
    float pine=triangle(tree,vec2(-h*.19,.015),vec2(0.,h),vec2(h*.19,.015));
    pine=max(pine,triangle(tree,vec2(-h*.25,0.),vec2(0.,h*.72),vec2(h*.25,0.)));
    pine=max(pine,limb(tree,vec2(0.,-.035),vec2(0.,h*.8),.0015));
    col=mix(col,vec3(.012,.035,.034),pine*.65);
  }
  float lake=1.-smoothstep(.16,.19,uv.y);
  col=mix(col,vec3(.016,.039,.044)+tint*.025,lake*.7);
  float reflected=exp(-abs(uv.x-moonPos.x)*28.)*lake;
  float ripples=pow(max(sin(uv.y*280.+noise(vec2(uv.x*35.,time*.2))*2.+time*.7),0.),8.);
  col+=gold*reflected*ripples*.09;
  vec2 delta=(uv-pointer)*vec2(aspect,1.);float d=length(delta);
  col+=tint*exp(-d*5.)*pow(max(sin(d*52.-time*2.),0.),18.)*(.015+motion*.10)*intensity;
  vec2 q=(uv-anchor)*vec2(aspect,1.)*1.2;q.x*=facing;
  float mixAmount=smoothstep(0.,1.,transition);
  float current=symbolShape(puppetMode,q,time,motion);
  float old=transition>.999?current:symbolShape(previousMode,q,time,motion);
  vec2 inkCell=fract((q+vec2(sin(q.y*12.+time*.4)*.006,0.))*155.)-.5;
  float inkGrain=1.-smoothstep(.12,.43,length(inkCell));
  if(puppetMode>1.5&&puppetMode<2.5)current*=inkGrain;
  if(previousMode>1.5&&previousMode<2.5)old*=inkGrain;
  if(puppetMode<.5&&camera>.5){current=texture2D(silhouette,vec2(uv.x,1.-uv.y)).r;}
  if(previousMode<.5&&camera>.5){old=texture2D(silhouette,vec2(uv.x,1.-uv.y)).r;}
  float actor=mix(old,current,mixAmount);
  float halo=exp(-length(q)*7.)*.055;
  col+=gold*halo*presence;
  vec3 material=mix(gold,tint,.18)+gold*.08*sin(q.y*35.+q.x*24.);
  float papergrain=.94+.06*hash(floor(gl_FragCoord.xy));
  float line=1.-smoothstep(.0008,.002,abs(length(q)-.292));
  col+=tint*line*.12*presence;
  col=mix(col,material*papergrain*(.68+.25*intensity),actor*presence*.94);
  float burst=sin(mixAmount*3.1415926);
  vec2 cloud=q+vec2(sin(q.y*19.+time)*.007,cos(q.x*17.+time)*.007)*burst;
  vec2 cell=floor(cloud*140.),dotpos=fract(cloud*140.)-.5;
  float mote=exp(-length(dotpos)*20.)*step(.80,hash(cell));
  float envelope=exp(-abs(length(q)-(.12+mixAmount*.18))*30.);
  col+=gold*mote*envelope*burst*presence*.9;
  vec2 fireGrid=p*vec2(55.,35.),fireCell=floor(fireGrid);vec2 fire=fract(fireGrid)-.5;
  fire.y+=sin(time*.3+hash(fireCell)*25.)*.25;
  col+=mix(gold,tint,.45)*exp(-length(fire)*70.)*step(.978,hash(fireCell))*(.25+motion*.4);
  float edge=1.-smoothstep(.001,.002,abs(uv.y-.024));
  edge=max(edge,1.-smoothstep(.001,.002,abs(uv.y-.976)));
  col+=gold*edge*.06;
  col*=.80+.20*pow(max(0.,1.-length((uv-.5)*vec2(1.,.7))),.6);
  gl_FragColor=vec4(col,1.);
}`;
