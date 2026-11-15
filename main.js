import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {buildWorld} from './world.js';
import {Animator} from './animator.js';

const $=id=>document.getElementById(id),cl=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=(a,b)=>a+Math.random()*(b-a);
const R=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
R.setPixelRatio(Math.min(devicePixelRatio,1.75));R.setSize(innerWidth,innerHeight);
R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.05;
document.body.prepend(R.domElement);
const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,500);
const W=buildWorld(scene);

// ---- загрузка: модели лежат кусками (.bin), склеиваем в браузере ----
const PARTS=[['p0a.bin','p0b.bin'],['p1.bin'],['p2.bin']],MUSIC='music.bin',TOTAL=28333772+22780164+21675600;
let got=0;
async function fetchBlob(files,count=true){
  const bl=[];
  for(const f of files){
    const r=await fetch(f); if(!r.ok)throw new Error('Не найден файл '+f);
    const rd=r.body.getReader(),ch=[];
    for(;;){const {done,value}=await rd.read();if(done)break;ch.push(value);
      if(count){got+=value.length;const p=Math.min(99,got/TOTAL*100);$('prog').style.width=p+'%';$('loadpct').textContent=Math.round(p)+'%'}}
    bl.push(new Blob(ch));
  }
  return new Blob(bl);
}
const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));
async function loadVRM(files){
  const url=URL.createObjectURL(await fetchBlob(files));
  try{const g=await loader.loadAsync(url),v=g.userData.vrm;
    VRMUtils.removeUnnecessaryVertices(g.scene);VRMUtils.removeUnnecessaryJoints(g.scene);VRMUtils.rotateVRM0(v);
    v.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false}});return v}
  finally{URL.revokeObjectURL(url)}
}

// ---- звук ----
let AC;
async function startMusic(){try{const d=await AC.decodeAudioData(await (await fetchBlob([MUSIC],false)).arrayBuffer());
  const s=AC.createBufferSource(),g=AC.createGain();s.buffer=d;s.loop=true;g.gain.value=.4;s.connect(g).connect(AC.destination);s.start()}catch(e){console.warn('music',e)}}
function beep(f1,f2,dur,type='sine',vol=.12){try{const o=AC.createOscillator(),g=AC.createGain(),n=AC.currentTime;o.type=type;o.frequency.setValueAtTime(f1,n);o.frequency.exponentialRampToValueAtTime(f2,n+dur);
  g.gain.setValueAtTime(vol,n);g.gain.exponentialRampToValueAtTime(.001,n+dur);o.connect(g).connect(AC.destination);o.start();o.stop(n+dur)}catch(e){}}

// ---- состояние ----
const P={x:0,z:0,vx:0,vz:0,y:0,vy:0,face:0,hp:5,st:100,atk:0,cast:0,cd:0,skillCd:0,inv:0,hit:0,kx:0,kz:0,did:true};
const ATK=.42,CAST=.7;
let hero,enemies=[],started=false,paused=false,finished=false,gems=0,kills=0,keys={},yaw=.55,pitch=.28,dist=6.2,joy={x:0,y:0},last=performance.now(),time=0,fov=62;
const touch=matchMedia('(pointer:coarse)').matches,fx=[];
const say=t=>{$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(say.t);say.t=setTimeout(()=>$('toast').classList.remove('show'),2100)};
const collide=(o,r)=>{for(const c of W.colliders){const dx=o.x-c.x,dz=o.z-c.z,d=Math.hypot(dx,dz),m=r+c.r;if(d<m&&d>.001){o.x=c.x+dx/d*m;o.z=c.z+dz/d*m}}};

function makeEnemy(v,x,z){
  const root=v.scene;root.position.set(x,0,z);scene.add(root);
  const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x101830,depthTest:false,transparent:true,opacity:.8})),fg=new THREE.Sprite(new THREE.SpriteMaterial({color:0xff5c7c,depthTest:false}));
  bg.renderOrder=10;fg.renderOrder=11;scene.add(bg,fg);
  return {v,root,anim:new Animator(v),x,z,vx:0,vz:0,hp:4,max:4,dead:0,atkT:0,cd:1,hurt:0,kx:0,kz:0,face:0,did:true,bg,fg};
}
// эффекты: дуга удара и лунная волна
function addFx(mesh,life,fn){scene.add(mesh);fx.push({mesh,life,max:life,fn})}
function slash(){
  const m=new THREE.Mesh(new THREE.RingGeometry(1,2.1,32,1,-Math.PI/2-1.1,2.2).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xaee0ff,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));
  m.position.set(P.x,P.y+.9,P.z);m.rotation.y=P.face;addFx(m,.25,k=>{m.scale.setScalar(.8+k*.5);m.material.opacity=.9*(1-k)});
}
function wave(){
  const m=new THREE.Mesh(new THREE.RingGeometry(.6,.9,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xb892ff,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));
  m.position.set(P.x,P.y+.15,P.z);addFx(m,.6,k=>{m.scale.setScalar(1+k*6);m.material.opacity=.9*(1-k)});
}

function hurtEnemy(e,n,power){
  const dx=e.x-P.x,dz=e.z-P.z,d=Math.max(.01,Math.hypot(dx,dz));
  e.hp-=n;e.hurt=.4;e.kx=dx/d*power;e.kz=dz/d*power;e.atkT=0;beep(300,120,.15,'square',.08);
  if(e.hp<=0){e.dead=8;kills++;$('kills').textContent=kills;beep(500,80,.35,'sawtooth',.1)}
}
function attack(){
  if(!started||paused||P.atk>0||P.cd>0||P.cast>0)return;
  let best=null,bd=4.8;for(const e of enemies)if(e.dead<=0){const d=Math.hypot(e.x-P.x,e.z-P.z);if(d<bd){bd=d;best=e}}
  if(best)P.face=Math.atan2(best.x-P.x,best.z-P.z);          // автонаведение на ближайшего
  P.atk=ATK;P.cd=.5;P.did=false;slash();beep(700,350,.12,'triangle',.08);
}
function skill(){
  if(!started||paused||P.skillCd>0||P.cast>0)return;
  P.cast=CAST;P.skillCd=7;P.did=false;wave();beep(200,900,.5,'sine',.15);say('Лунная волна!');
}
function hurtPlayer(e){
  const dx=P.x-e.x,dz=P.z-e.z,d=Math.max(.01,Math.hypot(dx,dz));
  P.hp--;P.inv=1.2;P.hit=.4;P.kx=dx/d*7;P.kz=dz/d*7;beep(220,70,.25,'sawtooth',.12);
  if(P.hp<=0){P.hp=5;P.x=P.z=0;say('Ты возродилась у древних камней')}
}

// ---- шаг игры ----
function step(dt){
  const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joy.y,r=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x;
  let wx=-Math.sin(yaw)*f+Math.cos(yaw)*r,wz=-Math.cos(yaw)*f-Math.sin(yaw)*r,l=Math.hypot(wx,wz);
  if(l>1){wx/=l;wz/=l;l=1}
  const run=(keys.ShiftLeft||keys.ShiftRight||(touch&&Math.hypot(joy.x,joy.y)>.8))&&l>.1&&P.st>2;
  P.st=cl(P.st+(run?-22:14)*dt,0,100);
  const busy=P.atk>0||P.cast>0, speed=(run?7:4)*l*(busy?.35:1);
  const k=1-Math.exp(-dt*8);P.vx+=(wx*speed-P.vx)*k;P.vz+=(wz*speed-P.vz)*k;
  if(l>.1&&!busy){let d=Math.atan2(wx,wz)-P.face;d=Math.atan2(Math.sin(d),Math.cos(d));P.face+=d*(1-Math.exp(-dt*14))}
  P.kx*=Math.exp(-dt*7);P.kz*=Math.exp(-dt*7);
  P.x+=(P.vx+P.kx)*dt;P.z+=(P.vz+P.kz)*dt;collide(P,.45);
  const rad=Math.hypot(P.x,P.z);if(rad>100){P.x*=100/rad;P.z*=100/rad}
  let landed=false;const wasAir=P.y>0;
  if(keys.Space&&P.y<=0){P.vy=7.5;keys.Space=false}
  P.vy-=20*dt;P.y=Math.max(0,P.y+P.vy*dt);if(P.y===0){if(wasAir&&P.vy<-4)landed=true;P.vy=0}
  for(const n of ['atk','cast','cd','skillCd','inv','hit'])P[n]=Math.max(0,P[n]-dt);
  // удар наносит урон в середине замаха
  if(!P.did&&P.atk>0&&P.atk<ATK*.6){P.did=true;const fx_=Math.sin(P.face),fz=Math.cos(P.face);
    for(const e of enemies){if(e.dead>0)continue;const dx=e.x-P.x,dz=e.z-P.z,d=Math.hypot(dx,dz);if(d<3.3&&(dx*fx_+dz*fz)/Math.max(d,.01)>.1)hurtEnemy(e,1,6)}}
  if(!P.did&&P.cast>0&&P.cast<CAST*.7){P.did=true;for(const e of enemies)if(e.dead<=0&&Math.hypot(e.x-P.x,e.z-P.z)<6.5)hurtEnemy(e,2,11)}

  // кристаллы + подсказка
  let near=null,nd=1e9;
  for(const c of W.crystals){if(!c.alive)continue;const d=Math.hypot(c.x-P.x,c.z-P.z);
    if(d<1.6&&P.y<2.2){c.alive=false;c.g.visible=false;gems++;$('gems').textContent=gems;beep(880,1760,.35,'sine',.15);
      if(gems===10){finished=true;say('Победа! Все кристаллы собраны!');setTimeout(()=>{paused=true;$('menu').style.display='grid';$('menu').querySelector('h1').textContent='Победа!';$('menu').querySelector('p').textContent='Ты собрала все 10 лунных кристаллов и победила '+kills+' стражей.';$('start').textContent='Играть снова'},2200)}
      else say('Кристалл найден! Осталось '+(10-gems))}
    else if(d<nd){nd=d;near=c}}
  if(near){const dx=near.x-P.x,dz=near.z-P.z,fw=dx*-Math.sin(yaw)+dz*-Math.cos(yaw),rt=dx*Math.cos(yaw)+dz*-Math.sin(yaw);
    const ar=['↑','↗','→','↘','↓','↙','←','↖'][((Math.round(Math.atan2(rt,fw)/(Math.PI/4))%8)+8)%8];$('near').textContent='Ближайший кристалл '+ar+' '+Math.round(nd)+' м'}
  else $('near').textContent='';

  for(const e of enemies)stepEnemy(e,dt);

  $('hp').style.width=(P.hp/5*100)+'%';$('st').style.width=P.st+'%';
  hero.scene.position.set(P.x,P.y,P.z);hero.scene.rotation.y=P.face;
  hero.anim.update(dt,{sp:Math.hypot(P.vx,P.vz),ground:P.y<=0,vy:P.vy,glide:false,landed,atk:P.atk/ATK,cast:P.cast/CAST,hit:P.hit/.4});
  hero.update(dt);
  fov+=((run?69:62)-fov)*(1-Math.exp(-dt*4));cam.fov=fov;cam.updateProjectionMatrix();
}
function stepEnemy(e,dt){
  const v=e.v;
  if(e.dead>0){
    e.dead-=dt;const k=cl((8-e.dead)/.6,0,1);e.root.rotation.x=-k*1.45;e.root.position.y=k*.25;e.bg.visible=e.fg.visible=false;
    if(8-e.dead>1.6)e.root.visible=false;
    if(e.dead<=0){let x,z;do{const a=rnd(0,6.283),r=rnd(25,80);x=Math.cos(a)*r;z=Math.sin(a)*r}while(Math.hypot(x-P.x,z-P.z)<25);
      e.x=x;e.z=z;e.hp=e.max;e.root.rotation.x=0;e.root.position.set(x,0,z);e.root.visible=true;e.cd=1.5}
    return;
  }
  const dx=P.x-e.x,dz=P.z-e.z,d=Math.hypot(dx,dz);
  const want=(d<22&&d>1.7&&e.atkT<=0)?2.6:0, k=1-Math.exp(-dt*6);
  e.vx+=(dx/Math.max(d,.01)*want-e.vx)*k;e.vz+=(dz/Math.max(d,.01)*want-e.vz)*k;
  e.kx*=Math.exp(-dt*7);e.kz*=Math.exp(-dt*7);
  e.x+=(e.vx+e.kx)*dt;e.z+=(e.vz+e.kz)*dt;collide(e,.5);
  let df=Math.atan2(dx,dz)-e.face;df=Math.atan2(Math.sin(df),Math.cos(df));e.face+=df*(1-Math.exp(-dt*8));
  e.cd-=dt;
  if(d<2.1&&e.cd<=0&&e.atkT<=0){e.atkT=.8;e.cd=2.4;e.did=false}
  if(e.atkT>0){e.atkT-=dt;if(!e.did&&e.atkT<.4){e.did=true;if(Math.hypot(P.x-e.x,P.z-e.z)<2.7&&P.inv<=0)hurtPlayer(e)}}
  e.hurt=Math.max(0,e.hurt-dt);
  e.root.position.set(e.x,0,e.z);e.root.rotation.y=e.face;
  e.anim.update(dt,{sp:Math.hypot(e.vx,e.vz),ground:true,vy:0,glide:false,landed:false,atk:e.atkT>0?e.atkT/.8:0,hit:e.hurt/.4});
  v.update(dt);
  e.bg.visible=e.fg.visible=true;e.bg.position.set(e.x,2,e.z);e.fg.position.set(e.x,2,e.z);
  e.bg.scale.set(1.2,.13,1);e.fg.scale.set(1.2*e.hp/e.max,.1,1);
}

// ---- цикл ----
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min(.04,(now-last)/1000);last=now;time+=dt;
  if(started&&!paused)step(dt);else if(hero){hero.anim.update(dt,{sp:0,ground:true,vy:0,glide:false});hero.update(dt)}
  for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.life-=dt;f.fn(1-f.life/f.max);if(f.life<=0){scene.remove(f.mesh);fx.splice(i,1)}}
  if(hero){
    const t=new THREE.Vector3(P.x+Math.sin(yaw)*Math.cos(pitch)*dist,P.y+2.1+Math.sin(pitch)*dist,P.z+Math.cos(yaw)*Math.cos(pitch)*dist);
    cam.position.lerp(t,1-Math.exp(-dt*6));cam.position.y=Math.max(cam.position.y,.4);cam.lookAt(P.x,P.y+1.25,P.z);
  }else{cam.position.set(Math.sin(time*.12)*9,4,Math.cos(time*.12)*9);cam.lookAt(0,2,0)}
  W.update(time,dt,new THREE.Vector3(P.x,P.y,P.z),cam.position);
  R.render(scene,cam);
}
requestAnimationFrame(animate);

// ---- запуск, пауза ----
async function init(){
  AC=new(window.AudioContext||window.webkitAudioContext)();AC.resume();            // внутри клика — чтобы звук разрешился
  $('load').style.display='grid';const vs=[];
  for(let i=0;i<3;i++){vs.push(await loadVRM(PARTS[i]));$('loadtxt').textContent='Загружена модель '+(i+1)+' из 3'}
  hero=vs[0];hero.anim=new Animator(hero);hero.scene.scale.setScalar(1.05);scene.add(hero.scene);
  enemies.push(makeEnemy(vs[1],13,-8),makeEnemy(vs[2],-17,12));
  $('load').style.display='none';$('menu').style.display='none';started=true;say('Найди 10 кристаллов 💎');startMusic();
}
function setPause(v){paused=v;$('menu').style.display=v?'grid':'none';
  $('menu').querySelector('h1').textContent=v?'Пауза':'Лунные равнины';$('start').textContent=v?'Продолжить':'Начать игру'}
$('start').onclick=()=>{
  if(finished){location.reload();return}
  if(started){setPause(false);return}
  init().catch(e=>{console.error(e);$('loadtxt').textContent='Ошибка загрузки: '+e.message+'. Проверь, что все файлы загружены в репозиторий.'});
};
$('pause').onclick=()=>{if(started&&!finished)setPause(!paused)};
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space')e.preventDefault();
  if(e.code==='KeyJ'||e.code==='KeyF')attack();if(e.code==='KeyE')skill();if(e.code==='Escape'&&started&&!finished)setPause(!paused)});
addEventListener('keyup',e=>keys[e.code]=false);
$('attack').onpointerdown=e=>{e.preventDefault();attack()};$('skill').onpointerdown=e=>{e.preventDefault();skill()};$('jump').onpointerdown=e=>{e.preventDefault();keys.Space=true};

// джойстик и камера
const stick=$('stick'),nub=$('nub');let sid=null;
function moveStick(e){const r=stick.getBoundingClientRect(),m=48;let dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy);if(l>m){dx*=m/l;dy*=m/l}joy.x=dx/m;joy.y=dy/m;nub.style.transform=`translate(${dx}px,${dy}px)`}
const stopStick=()=>{sid=null;joy.x=joy.y=0;nub.style.transform=''};
stick.onpointerdown=e=>{sid=e.pointerId;stick.setPointerCapture(sid);moveStick(e)};stick.onpointermove=e=>{if(e.pointerId===sid)moveStick(e)};stick.onpointerup=stick.onpointercancel=stopStick;
let drag=false,px=0,py=0;const cv=R.domElement;
cv.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){drag=true;px=e.clientX;py=e.clientY}});
addEventListener('pointerup',()=>drag=false);
addEventListener('pointermove',e=>{if(drag&&started&&!paused){yaw-=(e.clientX-px)*.006;pitch=cl(pitch+(e.clientY-py)*.004,-.1,1.1);px=e.clientX;py=e.clientY}});
let tx=0,ty=0;cv.addEventListener('touchstart',e=>{if(e.touches.length){tx=e.touches[0].clientX;ty=e.touches[0].clientY}},{passive:true});
cv.addEventListener('touchmove',e=>{if(e.touches.length&&started&&!paused){const t=e.touches[0];yaw-=(t.clientX-tx)*.005;pitch=cl(pitch+(t.clientY-ty)*.003,-.1,1.1);tx=t.clientX;ty=t.clientY}},{passive:true});
cv.addEventListener('wheel',e=>{dist=cl(dist+e.deltaY*.005,3,12)},{passive:true});
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();R.setSize(innerWidth,innerHeight)});
