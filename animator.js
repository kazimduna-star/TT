// Процедурная анимация: работают ВСЕ кости humanoid (бёдра, позвоночник, грудь, шея, голова,
// глаза, плечи, руки, кисти, ноги, стопы, носки и все 30 суставов пальцев) + мимика.
// Волосы/юбка/аксессуары (spring bones) считает сам three-vrm через vrm.update().
const cl=(v,a,b)=>Math.min(b,Math.max(a,v)), lp=(a,b,t)=>a+(b-a)*t, dm=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
const BONES=['hips','spine','chest','upperChest','neck','head','leftEye','rightEye','leftShoulder','rightShoulder',
 'leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand',
 'leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot','leftToes','rightToes'];
const FING=['Thumb','Index','Middle','Ring','Little'], PART=['Proximal','Intermediate','Distal'];

export class Animator{
  constructor(vrm){
    this.v=vrm; this.t=0; this.ph=0; this.w=0; this.r=0; this.a=0; this.g=0; this.wv=0; this.land=0; this.bl=2; this.n={};
    const add=k=>{this.n[k]=vrm.humanoid.getNormalizedBoneNode(k)};
    BONES.forEach(add);
    for(const s of ['left','right'])for(const f of FING)for(const p of PART)add(s+f+p);
    this.hy=this.n.hips.position.y;
  }
  wave(){this.wv=2.4}
  set(k,x,y,z){const b=this.n[k]; if(b)b.rotation.set(x,y,z)}

  // S: {sp — скорость, ground, vy, glide, landed}
  update(dt,S){
    const t=this.t+=dt, sp=S.sp, gr=S.ground;
    this.w=dm(this.w,gr?cl(sp/3,0,1):0,10,dt);          // вес ходьбы
    this.r=dm(this.r,cl((sp-3.5)/6,0,1),8,dt);          // вес бега
    this.a=dm(this.a,gr?0:1,14,dt);                      // в воздухе
    this.g=dm(this.g,S.glide?1:0,6,dt);                  // планер
    if(S.landed)this.land=1; this.land=dm(this.land,0,9,dt);
    if(gr)this.ph+=dt*Math.PI*sp/(1+.12*sp);
    this.wv=Math.max(0,this.wv-dt);
    const w=this.w, r=this.r, a=this.a, g=this.g, idle=(1-w)*(1-a);
    const s=Math.sin(this.ph), c=Math.cos(this.ph), br=Math.sin(t*1.7), e=0;
    const lean=(.05+.18*r)*w, hy=s*.16*w, tw=-hy, fall=cl(-S.vy/10,0,1);
    const ak=S.atk||0, q=1-ak, wa=Math.min(1,ak*6), ca=S.cast||0, ht=S.hit||0, tws=(q-.5)*-.8*wa;

    // таз, позвоночник, шея, голова
    this.n.hips.position.y=this.hy-Math.abs(s)*(.025+.04*r)*w-this.land*.1;
    this.set('hips',lp(lean*.6,1.15,g)+a*(1-g)*.1-ht*.5-ca*.1,hy+Math.sin(t*.6)*.03*idle,s*.05*w+Math.sin(t*.9)*.025*idle);
    this.set('spine',lean*.3+br*.012-g*.2-ht*.3,tw*.5+tws,-s*.03*w);
    this.set('chest',lean*.2+br*.02,tw*.5+tws,0);
    this.set('upperChest',br*.015,tw*.4,0);
    this.set('neck',-lean*.3-g*.4,0,0);
    this.set('head',-lean*.5-g*.5+ht*.4+Math.sin(t*.7)*.03*idle,hy*.4+Math.sin(t*.5)*.18*idle,Math.sin(t*.4)*.03*idle);
    this.set('leftEye',Math.sin(t*1.1)*.05,Math.sin(t*.7)*.12,0);
    this.set('rightEye',Math.sin(t*1.1)*.05,Math.sin(t*.7)*.12,0);
    this.set('leftShoulder',0,-s*.06*w,-.02-br*.01);
    this.set('rightShoulder',0,s*.06*w,.02+br*.01);

    // ноги
    const A=lp(.5,.95,r)*w, K=.5+.9*r;
    let ulL=-s*A, ulR=s*A, kL=(.1+K*Math.max(0,c))*w, kR=(.1+K*Math.max(0,-c))*w;
    ulL=lp(ulL,lp(lp(-.8,-.1,fall),.25,g),a); ulR=lp(ulR,lp(lp(-.2,-.05,fall),.3,g),a);
    kL=lp(kL,lp(lp(1.2,.2,fall),.1,g),a)+this.land*.5; kR=lp(kR,lp(lp(.5,.2,fall),.1,g),a)+this.land*.5;
    ulL-=this.land*.35; ulR-=this.land*.35;
    const sw=Math.sin(t*.8)*.03*idle;
    this.set('leftUpperLeg',ulL,0,.04+sw); this.set('rightUpperLeg',ulR,0,-.04+sw);
    this.set('leftLowerLeg',kL,0,0);        this.set('rightLowerLeg',kR,0,0);
    this.set('leftFoot',ulL*.5-kL*.3,0,0);  this.set('rightFoot',ulR*.5-kR*.3,0,0);
    this.set('leftToes',Math.max(0,ulL)*.6,0,0); this.set('rightToes',Math.max(0,ulR)*.6,0,0);

    // руки
    const aa=lp(.45,.9,r)*w, dz=lp(lp(1.3,1.1,r),lp(.75,.12,g),a)+br*.01;
    const bend=lp(.2+.15*w+.7*r*w,lp(.5,.15,g),a);
    const aL=lp(s*aa,lp(-.2,0,g),a), aR=lp(-s*aa,lp(-.2,0,g),a);
    const bL=bend+Math.max(0,-s)*.5*r*w*(1-a), bR=bend+Math.max(0,s)*.5*r*w*(1-a);
    const sw1=lp(-2.3,-.2,q);                                          // замах и удар правой рукой
    this.set('leftUpperArm',lp(aL-ht*.8,-2.5,ca),0,lp(-dz,-.3,ca));
    this.set('rightUpperArm',lp(lp(aR-ht*.8,sw1,wa),-2.5,ca),0,lp(lp(dz,.5,wa),.3,ca));
    this.set('leftLowerArm',0,-lp(bL,.4,ca),0);
    this.set('rightLowerArm',0,lp(lp(bR,1,wa),.4,ca),0);
    this.set('leftHand',0,0,br*.01);
    this.set('rightHand',0,0,e*Math.sin(t*12+1)*.25);

    // пальцы — все 30 суставов
    const cu=lp(.35,.8,r*w)*(1-a*.6);
    for(const [sd,sg] of [['left',-1],['right',1]])
      FING.forEach((f,i)=>PART.forEach((p,j)=>{
        let k=(cu*(.7+.12*i)+Math.sin(t*1.2+i)*.04)*(1+j*.25);
        if(sd==='right')k*=1-.85*e;
        if(f==='Thumb'){k*=.5; this.set(sd+f+p,0,sg*k*.6,sg*k*.6);}
        else this.set(sd+f+p,0,0,sg*k);
      }));

    // мимика
    const em=this.v.expressionManager;
    if(em){
      this.bl-=dt; let b=0;
      if(this.bl<.14)b=Math.sin(cl(this.bl/.14,0,1)*Math.PI);
      if(this.bl<0)this.bl=2+Math.random()*3;
      em.setValue('blink',b); em.setValue('happy',.12+e*.6+g*.2+ca*.4); em.setValue('aa',r*.06);
    }
  }
}
