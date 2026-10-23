'use strict';
window.puppetShader = `
float limb(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),.00001),0.,1.);
  return 1.-smoothstep(r,r+.002,length(pa-ba*h));
}
float oval(vec2 p,vec2 center,vec2 radius) {return 1.-smoothstep(.97,1.03,length((p-center)/radius));}
float cross2(vec2 a,vec2 b){return a.x*b.y-a.y*b.x;}
float triangle(vec2 p,vec2 a,vec2 b,vec2 c){
  float o=sign(cross2(b-a,c-a));
  float d=min(min(o*cross2(b-a,p-a)/max(length(b-a),.001),o*cross2(c-b,p-b)/max(length(c-b),.001)),o*cross2(a-c,p-c)/max(length(a-c),.001));
  return smoothstep(-.0015,.0015,d);
}
float rosette(vec2 q,float size){
  vec2 p=q/size;float r=length(p),a=atan(p.y,p.x);
  return (1.-smoothstep(.07,.12,abs(r-(.47+.13*cos(a*6.)))))*(1.-smoothstep(.85,.95,r));
}
float deerShape(vec2 q,float t,float energy){
  q.y-=sin(t*2.)*.003+sin(t*6.)*.008*energy;
  float body=oval(q,vec2(-.025,0.),vec2(.128,.048));
  float shape=max(body,limb(q,vec2(.065,.012),vec2(.125,.139),.019));
  shape=max(shape,oval(q,vec2(.147,.148),vec2(.038,.022)));
  shape=max(shape,triangle(q,vec2(.117,.15),vec2(.105,.202),vec2(.141,.171)));
  shape=max(shape,limb(q,vec2(-.14,.01),vec2(-.18,.047),.006));
  for(int i=0;i<4;i++){
    float k=float(i),x=i<2?-.10:.065,phase=k*2.1;
    float gait=sin(t*(2.+energy*5.)+phase)*(.003+energy*.034);
    vec2 hip=vec2(x+mod(k,2.)*.018,-.028),knee=vec2(x+gait,-.105),hoof=vec2(x-gait,-.202);
    shape=max(shape,limb(q,hip,knee,.0065));shape=max(shape,limb(q,knee,hoof,.004));
    shape=max(shape,limb(q,hoof,hoof+vec2(.015,-.002),.005));
  }
  shape=max(shape,limb(q,vec2(.126,.16),vec2(.118,.211),.0035));
  shape=max(shape,limb(q,vec2(.118,.211),vec2(.133,.263),.0027));
  shape=max(shape,limb(q,vec2(.121,.199),vec2(.088,.222),.0025));
  shape=max(shape,limb(q,vec2(.123,.231),vec2(.099,.258),.002));
  shape=max(shape,limb(q,vec2(.139,.168),vec2(.175,.217),.003));
  shape=max(shape,limb(q,vec2(.175,.217),vec2(.19,.261),.0025));
  shape=max(shape,limb(q,vec2(.17,.21),vec2(.204,.219),.002));
  float carving=rosette(q-vec2(-.035,0.),.043)*body;
  carving=max(carving,oval(q,vec2(.158,.156),vec2(.0035,.0035)));
  carving=max(carving,limb(q,vec2(.08,.027),vec2(.12,.13),.002));
  return shape*(1.-carving);
}
float birdShape(vec2 q,float t,float energy){
  float body=oval(q,vec2(0.,-.025),vec2(.038,.08));
  float shape=max(body,limb(q,vec2(.0,.018),vec2(-.008,.13),.014));
  shape=max(shape,limb(q,vec2(-.008,.13),vec2(.028,.195),.012));
  shape=max(shape,oval(q,vec2(.035,.205),vec2(.025,.022)));
  shape=max(shape,triangle(q,vec2(.05,.213),vec2(.1,.195),vec2(.05,.195)));
  float carving=0.;
  for(int side=0;side<2;side++){
    float s=side==0?-1.:1.;float flap=sin(t*(1.7+energy*2.))*.025;
    shape=max(shape,triangle(q,vec2(0.,.01),vec2(s*.20,.10+flap),vec2(s*.07,-.025)));
    for(int i=0;i<7;i++){
      float k=float(i);vec2 base=vec2(s*(.018+k*.014),-.006+k*.006);
      vec2 tip=vec2(s*(.13+k*.022),.125+flap-k*.009);
      shape=max(shape,limb(q,base,tip,.012-k*.0007));
      carving=max(carving,limb(q,base+vec2(0.,.012),tip*.89,.0015));
    }
  }
  for(int i=0;i<5;i++){
    float k=float(i)-2.;vec2 tip=vec2(k*.027,-.19+abs(k)*.018);
    shape=max(shape,limb(q,vec2(k*.007,-.06),tip,.012));
    carving=max(carving,limb(q,vec2(k*.007,-.09),tip*.92,.0015));
  }
  carving=max(carving,rosette(q-vec2(0.,-.015),.027)*body);
  carving=max(carving,oval(q,vec2(.042,.211),vec2(.003,.003)));
  return shape*(1.-carving);
}
float fishShape(vec2 q,float t,float energy){
  float a=sin(t*1.5)*.10; q=mat2(cos(a),-sin(a),sin(a),cos(a))*q;
  float body=oval(q,vec2(.015,0.),vec2(.127,.057));float tailSwing=sin(t*(2.+energy*5.))*.025;
  float shape=max(body,triangle(q,vec2(-.09,0.),vec2(-.22,.095+tailSwing),vec2(-.205,-.08+tailSwing)));
  shape=max(shape,triangle(q,vec2(-.04,.028),vec2(.018,.107),vec2(.078,.033)));
  shape=max(shape,triangle(q,vec2(.01,-.025),vec2(-.035,-.105),vec2(.085,-.027)));
  float carving=oval(q,vec2(.099,.017),vec2(.004,.004));
  for(int i=0;i<5;i++){
    float x=-.075+float(i)*.028;
    carving=max(carving,limb(q,vec2(x,-.025),vec2(x+.012,.027),.0015)*body);
  }
  carving=max(carving,limb(q,vec2(-.12,0.),vec2(-.197,.06+tailSwing),.0015));
  carving=max(carving,limb(q,vec2(-.12,0.),vec2(-.19,-.046+tailSwing),.0015));
  return shape*(1.-carving);
}
float figureShape(vec2 q,float t){
  float a=atan(q.y,q.x),r=length(q);
  return (1.-smoothstep(.11+.025*cos(a*8.),.115+.025*cos(a*8.),r))*(1.-rosette(q,.105));
}
float inkShape(vec2 q,float t,float energy){
  float flower=figureShape(q,t);
  float ring=1.-smoothstep(.001,.003,abs(length(q)-.17-sin(t*.6)*.004));
  return max(flower,ring*.55);
}
float symbolShape(float kind,vec2 q,float t,float energy){
  if(kind<.5)return figureShape(q,t);
  if(kind<1.5)return deerShape(q,t,energy);
  if(kind<2.5)return inkShape(q,t,energy);
  if(kind<3.5)return birdShape(q,t,energy);
  return fishShape(q,t,energy);
}
`;
