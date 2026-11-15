import * as THREE from 'three';
const rnd=(a,b)=>a+Math.random()*(b-a);
export function glowTex(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.3,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}

export function buildWorld(scene){
  const GT=glowTex(), colliders=[], up=new THREE.Vector3(0,1,0);
  scene.background=new THREE.Color(0x141f45); scene.fog=new THREE.Fog(0x1b2a58,25,150);
  scene.add(new THREE.HemisphereLight(0x8fa8ee,0x1d3a3c,1.15));
  const moonL=new THREE.DirectionalLight(0xbcd0ff,2.3); moonL.castShadow=true; moonL.shadow.mapSize.set(2048,2048);
  const sc=moonL.shadow.camera; sc.left=sc.bottom=-36; sc.right=sc.top=36; sc.near=1; sc.far=140; moonL.shadow.bias=-.0004; moonL.shadow.normalBias=.04;
  scene.add(moonL,moonL.target);

  // небо: градиент, звёзды, луна
  const skyG=new THREE.Group(); scene.add(skyG);
  skyG.add(new THREE.Mesh(new THREE.SphereGeometry(450,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    vertexShader:'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 p;void main(){float h=clamp(p.y,0.,1.);vec3 c=mix(vec3(.2,.26,.5),vec3(.02,.04,.17),pow(h,.5));c+=vec3(.25,.12,.3)*pow(1.-h,6.);gl_FragColor=vec4(c,1.);}'})));
  const sp=[];for(let i=0;i<1400;i++){const a=rnd(0,6.283),e=Math.acos(rnd(.02,1)),r=420;sp.push(Math.sin(e)*Math.cos(a)*r,Math.cos(e)*r,Math.sin(e)*Math.sin(a)*r)}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  skyG.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,fog:false})));
  const moon=new THREE.Mesh(new THREE.SphereGeometry(16,32,24),new THREE.MeshBasicMaterial({color:0xf6f1dc,fog:false})); moon.position.set(-130,170,-250);
  const mg=new THREE.Sprite(new THREE.SpriteMaterial({map:GT,color:0xb9ccff,blending:THREE.AdditiveBlending,fog:false,depthWrite:false,transparent:true})); mg.scale.set(190,190,1); mg.position.copy(moon.position);
  skyG.add(moon,mg);

  // земля с текстурой травы
  const gc=document.createElement('canvas');gc.width=gc.height=256;const gx=gc.getContext('2d');gx.fillStyle='#5f9c78';gx.fillRect(0,0,256,256);
  for(let i=0;i<4500;i++){gx.fillStyle=`hsla(${120+Math.random()*60},40%,${25+Math.random()*28}%,.35)`;gx.fillRect(Math.random()*256,Math.random()*256,2+Math.random()*3,2+Math.random()*3)}
  const gt=new THREE.CanvasTexture(gc);gt.wrapS=gt.wrapT=THREE.RepeatWrapping;gt.repeat.set(45,45);gt.colorSpace=THREE.SRGBColorSpace;gt.anisotropy=4;
  const ground=new THREE.Mesh(new THREE.CircleGeometry(130,96),new THREE.MeshStandardMaterial({map:gt,color:0x9fb4e8,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  // горы по краю
  const hm=new THREE.MeshStandardMaterial({color:0x2c3f73,roughness:1,flatShading:true});
  for(let i=0;i<26;i++){const a=i/26*6.283,r=100+(i%3)*8,h=18+(i*7%19),m=new THREE.Mesh(new THREE.ConeGeometry(12,h,7),hm);m.position.set(Math.cos(a)*r,h/2-1,Math.sin(a)*r);scene.add(m)}

  // озеро
  const lake={x:-34,z:-30,r:11};
  const water=new THREE.Mesh(new THREE.CircleGeometry(lake.r,48),new THREE.MeshStandardMaterial({color:0x1d5090,metalness:.6,roughness:.12,emissive:0x0a2a5a}));
  water.rotation.x=-Math.PI/2;water.position.set(lake.x,.04,lake.z);scene.add(water);colliders.push({x:lake.x,z:lake.z,r:lake.r-.6});

  // кольцо древних камней на старте
  const rm=new THREE.MeshStandardMaterial({color:0x6c7798,roughness:.8,emissive:0x2a46a0,emissiveIntensity:.6});
  for(let i=0;i<8;i++){const a=i/8*6.283,x=Math.cos(a)*9,z=Math.sin(a)*9,m=new THREE.Mesh(new THREE.BoxGeometry(1.1,3.2+(i%2),.7),rm);
    m.position.set(x,1.7,z);m.rotation.y=-a;m.castShadow=m.receiveShadow=true;scene.add(m);colliders.push({x,z,r:.8})}

  // сосны (инстансы)
  const T=260,tr=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.25,2,6).translate(0,1,0),new THREE.MeshStandardMaterial({color:0x5b4436}),T);
  const c1=new THREE.InstancedMesh(new THREE.ConeGeometry(1.7,3.4,7).translate(0,3.2,0),new THREE.MeshStandardMaterial({flatShading:true}),T);
  const c2=new THREE.InstancedMesh(new THREE.ConeGeometry(1.2,2.8,7).translate(0,5,0),new THREE.MeshStandardMaterial({flatShading:true}),T);
  tr.castShadow=c1.castShadow=c2.castShadow=true;
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),col=new THREE.Color(),lk=[0x1f6a55,0x2b7d5c,0x2a5f7a];
  for(let k=0;k<T;){const a=rnd(0,6.283),r=rnd(14,95),x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(Math.hypot(x-lake.x,z-lake.z)<lake.r+2)continue;
    const s=rnd(.8,1.5);m4.compose(new THREE.Vector3(x,0,z),q.setFromAxisAngle(up,rnd(0,6.28)),new THREE.Vector3(s,s*rnd(.9,1.3),s));
    tr.setMatrixAt(k,m4);c1.setMatrixAt(k,m4);c2.setMatrixAt(k,m4);col.setHex(lk[k%3]);c1.setColorAt(k,col);c2.setColorAt(k,col);colliders.push({x,z,r:.5*s});k++}
  scene.add(tr,c1,c2);

  // трава и светящиеся цветы
  const GN=7000,gr=new THREE.InstancedMesh(new THREE.ConeGeometry(.06,.55,3).translate(0,.27,0),new THREE.MeshStandardMaterial({color:0x4da177,roughness:1}),GN);
  for(let k=0;k<GN;k++){const a=rnd(0,6.283),r=Math.sqrt(Math.random())*100;m4.compose(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r),q.setFromAxisAngle(up,rnd(0,6.28)),new THREE.Vector3(1,rnd(.6,1.6),1));gr.setMatrixAt(k,m4)}
  scene.add(gr);
  const FN=500,fl=new THREE.InstancedMesh(new THREE.SphereGeometry(.1,6,5).translate(0,.45,0),new THREE.MeshBasicMaterial(),FN),fk=[0x7fd8ff,0xff9fe0,0xffe58a];
  for(let k=0;k<FN;k++){const a=rnd(0,6.283),r=Math.sqrt(Math.random())*95;m4.makeTranslation(Math.cos(a)*r,0,Math.sin(a)*r);fl.setMatrixAt(k,m4);fl.setColorAt(k,col.setHex(fk[k%3]))}
  scene.add(fl);

  // лунные кристаллы
  const crystals=[],gm=new THREE.MeshStandardMaterial({color:0x63eaff,emissive:0x1aa0d8,emissiveIntensity:1.2,metalness:.3,roughness:.15});
  const bm=new THREE.MeshBasicMaterial({color:0x7fe9ff,transparent:true,opacity:.14,blending:THREE.AdditiveBlending,depthWrite:false});
  for(let i=0;i<10;){const a=i/10*6.283+rnd(-.25,.25),r=rnd(14,70),x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(colliders.some(c=>Math.hypot(c.x-x,c.z-z)<c.r+2))continue;
    const g=new THREE.Group(),m=new THREE.Mesh(new THREE.OctahedronGeometry(.55),gm);m.scale.y=1.6;m.castShadow=true;
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GT,color:0x66e8ff,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));gl.scale.set(3.2,3.2,1);
    const bm2=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,40,10,1,true),bm);bm2.position.y=20;
    g.add(m,gl,bm2);g.position.set(x,1.2,z);scene.add(g);crystals.push({g,m,x,z,alive:true});i++}

  // светлячки
  const FF=160,fa=new Float32Array(FF*3),fg=new THREE.BufferGeometry();
  for(let i=0;i<FF;i++)fa.set([rnd(-30,30),rnd(.3,4),rnd(-30,30)],i*3);
  fg.setAttribute('position',new THREE.BufferAttribute(fa,3));
  const ff=new THREE.Points(fg,new THREE.PointsMaterial({map:GT,color:0xd8ff7a,size:.7,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));ff.frustumCulled=false;scene.add(ff);

  function update(t,dt,pp,cp){
    moonL.position.set(pp.x-28,pp.y+46,pp.z+24);moonL.target.position.copy(pp);skyG.position.copy(cp);
    crystals.forEach((c,i)=>{if(!c.alive)return;c.m.rotation.y=t*1.8;c.g.position.y=1.2+Math.sin(t*2+i)*.2});
    for(let i=0;i<FF;i++){const j=i*3;fa[j]+=Math.sin(t*.7+i)*dt*.8;fa[j+1]+=Math.cos(t*1.1+i*2)*dt*.3;fa[j+2]+=Math.cos(t*.6+i)*dt*.8;
      fa[j+1]=Math.min(4.5,Math.max(.3,fa[j+1]));
      if(Math.abs(fa[j]-pp.x)>32||Math.abs(fa[j+2]-pp.z)>32){fa[j]=pp.x+rnd(-30,30);fa[j+2]=pp.z+rnd(-30,30)}}
    fg.attributes.position.needsUpdate=true;
  }
  return {colliders,crystals,update};
}
