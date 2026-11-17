/* KNIGHT DUEL: ONLINE WORLD (Stage 1). Separate module: the duel code and the WebRTC 1v1 mode are untouched.
   Reuses: makeChar/poseUpdate (knight models), ACTIVE (account + character), SB (Supabase client), scene/camera/renderer.
   Stage 1 = shared town hub (Square, Market, Guild, Tavern, Colosseum gate), collision, deterministic NPCs, live players. */
(function(){'use strict';
const ZMIN=5.2,ZMAX=8.6,PMIN=.2,PMAX=.6,TURN=2.4,W=window.WORLD={on:false},HALF=172,WALK=4.6,BOX=[],CIR=[],mats={},remotes=new Map();
let TOWN=null,me=null,myKey='',ch=null,dlg=null,near=null,saved=null,tSend=0,lastS={x:1e9,z:0,y:0},sNote='',hudS='',camYaw=0,camPitch=.36,camDist=7,dragCam=false,lastPX=0,lastPY=0,inArena=false;
const camGoal=new THREE.Vector3(),mat=c=>mats[c]||(mats[c]=new THREE.MeshStandardMaterial({color:c,roughness:.92,flatShading:true}));
const WK=['sword','hammer','gaunt','bow'],okW=w=>WK.includes(w)?w:'sword',okG=g=>g=='female'?'female':'male',okC=(c,d)=>Number.isInteger(c)&&c>=0&&c<=0xffffff?c:d;

/* ---------- town geometry: the layout follows the supplied map image (1 px = 0.12 m, origin = main plaza, north = +z) ---------- */
const S=.12,PX=1100,PY=930,AX=72,AZ=89;let seed=7;const R=()=>(seed=(seed*16807)%2147483647)/2147483647,tex={};
const wp=p=>[(PX-p[0])*S,(PY-p[1])*S],L=a=>a.map(wp);
const WALL=L([[455,1015],[590,1048],[640,1062],[705,1190],[900,1275],[1090,1312],[1262,1302],[1400,1215],[1440,1160],[1500,1010],[1520,830],[1530,700],[1500,545],[1450,425],[1392,330],[1335,288],[1185,235],[1010,300],[910,420],[750,432],[650,505],[535,680],[512,800],[470,905]]),GATES=[0,11,16];
const STREETS=[L([[522,1031],[640,1002],[800,962],[960,935],[1100,930]]),L([[1097,268],[1085,420],[1095,600],[1100,780],[1100,930]]),L([[1515,622],[1420,720],[1300,820],[1200,900],[1100,930]]),L([[681,880],[780,892],[880,908],[960,925]]),L([[1330,1042],[1325,980],[1290,925],[1260,900]])];
const ROADS=[L([[545,1115],[700,1235],[900,1305],[1100,1335],[1260,1325],[1420,1250],[1520,1100]]),L([[522,1031],[545,1115],[520,1200],[480,1380],[450,1560],[430,1780],[405,1940]]),L([[405,1940],[520,2010],[700,2090],[900,2170],[1100,2250],[1250,2339]]),L([[780,0],[830,110],[900,190],[1010,230],[1130,210],[1250,215],[1340,230],[1390,300],[1470,420],[1520,540]]),L([[1340,0],[1360,180],[1395,300]]),L([[1097,268],[1100,215]]),L([[1515,622],[1596,640]]),L([[830,115],[700,205],[600,290],[500,330]]),L([[480,1030],[420,1030],[340,1003],[340,900],[430,880]])];
const EXC=[[60,6,15],[-27.6,-21.6,14],[33.6,-18,11],[-8.4,-9.6,13],[-17.4,-9.6,8]];
function inPoly(P,x,z){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
function dSeg(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)}
const dLine=(P,x,z)=>{let m=1e9;for(let i=0;i<P.length-1;i++)m=Math.min(m,dSeg(x,z,P[i],P[i+1]));return m};
function obox(w,h,d,x,y,z,c,ry,solid){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);m.rotation.y=ry||0;m.castShadow=m.receiveShadow=true;TOWN.add(m);if(solid)BOX.push({x,z,hw:w/2,hd:d/2,c:Math.cos(ry||0),s:Math.sin(ry||0)});return m}
const box=(w,h,d,x,y,z,c,solid)=>obox(w,h,d,x,y,z,c,0,solid);
function label(t,col,sc){const c=document.createElement('canvas');c.width=320;c.height=64;const g=c.getContext('2d');g.font='600 28px system-ui,sans-serif';g.textAlign='center';g.lineWidth=6;g.strokeStyle='rgba(0,0,0,.8)';g.strokeText(t,160,42);g.fillStyle=col||'#fff';g.fillText(t,160,42);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));s.scale.set(5*(sc||1),1*(sc||1),1);return s}
function bld(x,z,w,d,h,wall,roof,name){box(w,h,d,x,h/2,z,wall,1);const r=new THREE.Mesh(new THREE.ConeGeometry(.7071,1,4),mat(roof));r.rotation.y=Math.PI/4;r.scale.set(w*1.08,h*.5,d*1.08);r.position.set(x,h*1.25,z);r.castShadow=true;TOWN.add(r);
 if(name){const s=label(name,'#f1ead8',1.5);s.position.set(x,h*1.5+1.8,z);TOWN.add(s)}}
function stall(x,z,c,name){box(4,.9,2,x,.45,z,0x6b4a2b,1);box(.2,2.6,.2,x-1.8,1.3,z-.9,0x4a3320);box(.2,2.6,.2,x+1.8,1.3,z-.9,0x4a3320);box(4.4,.18,2.8,x,2.6,z-.3,c).rotation.x=.18;if(name){const s=label(name,'#f1ead8',.9);s.position.set(x,3.7,z);TOWN.add(s)}}
function tower(x,z,r,h,c,roof){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.08,h,12),mat(c));m.position.set(x,h/2,z);m.castShadow=m.receiveShadow=true;TOWN.add(m);CIR.push({x,z,r});
 if(roof){const k=new THREE.Mesh(new THREE.ConeGeometry(r*1.25,r*1.5,12),mat(roof));k.position.set(x,h+r*.75,z);k.castShadow=true;TOWN.add(k)}}
function wallSeg(a,b,h,c,gap){const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),th=Math.atan2(-dz,dx),ux=dx/l,uz=dz/l,part=(f0,f1)=>{const m=(f0+f1)/2*l;obox((f1-f0)*l,h,1.4,a[0]+ux*m,h/2,a[1]+uz*m,c,th,1)};
 if(!gap)return part(0,1);const g=gap/2/l;part(0,.5-g);part(.5+g,1);for(const f of [.5-g,.5+g])tower(a[0]+dx*f,a[1]+dz*f,1.2,h+2.5,0xe0dacb,0x8a2f22)}
function smooth(P){if(P.length<3)return P;const o=[];for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)],n=Math.max(2,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/4));
 for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t;o.push([0,1].map(j=>.5*(2*p1[j]+(p2[j]-p0[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(3*p1[j]-p0[j]-3*p2[j]+p3[j])*t3)))}}o.push(P[P.length-1]);return o}
function ctex(kind,rep){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle=kind?'#6f5f43':'#625a4e';g.fillRect(0,0,128,128);
 const pal=kind?['#9c8a68','#8e7d5d','#a89574','#86754f']:['#a39c8e','#8c8478','#b2aa9a','#7d7565','#a89a85'];
 for(let y=0;y<128;y+=16)for(let x=(y/16%2)*8-8;x<128;x+=16){g.fillStyle=pal[(Math.random()*pal.length)|0];g.fillRect(x+1.5,y+1.5,13,13)}
 const T=new THREE.CanvasTexture(c);T.wrapS=T.wrapT=THREE.RepeatWrapping;T.repeat.set(rep,rep);return T}
function ribbon(P,w,m,y){const pos=[],uv=[],idx=[];P.forEach((p,i)=>{const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)];let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;const nx=-tz*w/2,nz=tx*w/2;
  pos.push(p[0]+nx,y,p[1]+nz,p[0]-nx,y,p[1]-nz);uv.push((p[0]+nx)/4,(p[1]+nz)/4,(p[0]-nx)/4,(p[1]-nz)/4);if(i){const k=(i-1)*2;idx.push(k,k+1,k+2,k+1,k+3,k+2)}});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m2=new THREE.Mesh(g,m);m2.receiveShadow=true;TOWN.add(m2)}
const FD={wheat:['#d8b04a','#a77f2c'],green:['#76ad4a','#3c7a33'],light:['#c9d46c','#9aaa4c'],plow:['#6a3b2a','#43241a']};
function field(t,x0,y0,x1,y1){const a=wp([x0,y0]),b=wp([x1,y1]),w=Math.abs(a[0]-b[0]),d=Math.abs(a[1]-b[1]);
 if(!tex[t]){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle=FD[t][0];g.fillRect(0,0,64,64);g.fillStyle=FD[t][1];for(let i=0;i<64;i+=8)g.fillRect(0,i,64,3);const T=new THREE.CanvasTexture(c);T.wrapS=T.wrapT=THREE.RepeatWrapping;tex[t]=T}
 const T=tex[t].clone();T.needsUpdate=true;T.repeat.set(w/8,d/8);const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({map:T,roughness:1}));m.rotation.x=-Math.PI/2;m.position.set((a[0]+b[0])/2,.03,(a[1]+b[1])/2);m.receiveShadow=true;TOWN.add(m)}
function poly(P,c,y){const sh=new THREE.Shape();P.forEach((p,i)=>i?sh.lineTo(p[0],-p[1]):sh.moveTo(p[0],-p[1]));const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),typeof c==='number'?mat(c):c);m.rotation.x=-Math.PI/2;m.position.y=y;m.receiveShadow=true;TOWN.add(m)}
function inst(g,n,col){const m=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({roughness:.92,flatShading:true}),n);m.castShadow=m.receiveShadow=true;m.frustumCulled=false;return m}
function gable(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,.5,.5,0,.5,.5,1,0,-.5,0,.5,.5,1,0,-.5,1,0,.5,0,-.5,-.5,0,-.5,-.5,1,0,.5,0,-.5,-.5,1,0,.5,1,0,.5,0,.5,.5,0,-.5,.5,1,0,-.5,0,-.5,-.5,0,.5,-.5,1,0],3));g.computeVertexNormals();return g}
function houses(){const WC=[...WALL,WALL[0]],it=[];
 for(let x=-56;x<=80;x+=8.6)for(let z=-46;z<=86;z+=8.6){const jx=x+(R()-.5)*2.4,jz=z+(R()-.5)*2.4,rr=R();
  if(!inPoly(WALL,jx,jz)||dLine(WC,jx,jz)<5||((jx/30)**2+((jz-2)/19)**2)<1||rr<.08||EXC.some(e=>Math.hypot(jx-e[0],jz-e[1])<e[2])||STREETS.some(s=>dLine(s,jx,jz)<5.6))continue;
  it.push({x:jx,z:jz,w:4.6+R()*2.2,d:4.6+R()*2.2,h:3.8+R()*3.6,y:Math.atan2(jx,jz-2)})}
 const dt=[],DC=[0x2b7fa6,0x2f8f96,0x3a6fa8,0x7a2a22,0x2d5a3d],FC=[0xd8567a,0xe8a33c,0xc43b3b,0xb36bd6];
 const m1=inst(new THREE.BoxGeometry(1,1,1),it.length),m2=inst(gable(),it.length),dm=new THREE.Object3D(),col=new THREE.Color(),WC1=[0xcfc2a8,0xbfb094,0xa89a80,0xd8ccb2,0x9a8c74,0xb8a888],RC=[0x4a5058,0x3f464e,0x56606a,0x434a52,0x6a4a3e];m2.material.side=THREE.DoubleSide;
 it.forEach((o,i)=>{const cs=Math.cos(o.y),sn=Math.sin(o.y),rh=o.h*.75,ad=(lx,ly,lz,sx,sy,sz,c)=>dt.push({x:o.x+lx*cs+lz*sn,y:ly,z:o.z-lx*sn+lz*cs,sx,sy,sz,r:o.y,c});
  dm.position.set(o.x,o.h/2,o.z);dm.rotation.set(0,o.y,0);dm.scale.set(o.w,o.h,o.d);dm.updateMatrix();m1.setMatrixAt(i,dm.matrix);m1.setColorAt(i,col.setHex(WC1[(R()*6)|0]));
  dm.position.y=o.h;dm.scale.set(o.w*1.1,rh,o.d*1.2);dm.updateMatrix();m2.setMatrixAt(i,dm.matrix);m2.setColorAt(i,col.setHex(RC[(R()*5)|0]));
  BOX.push({x:o.x,z:o.z,hw:o.w/2,hd:o.d/2,c:cs,s:sn});
  const fz=-(o.d/2+.05),bz=o.d/2+.05,dc=DC[(R()*5)|0],wy=o.h*.6;ad((R()-.5)*o.w*.4,1.05,fz,1,2.1,.14,dc);
  for(const sd of [-1,1]){ad(sd*o.w*.3,wy,fz,1.3,1.5,.12,dc);ad(sd*o.w*.3,wy,fz-.03,.9,1.1,.14,0x2a3b4a);ad(sd*o.w*.3,wy-.95,fz-.17,1.3,.28,.4,FC[(R()*4)|0]);ad(sd*o.w*.3,wy,bz,1.3,1.5,.12,dc);ad(sd*o.w*.3,wy,bz+.03,.9,1.1,.14,0x2a3b4a)}
  if(R()<.35)ad(R()<.5?o.w/2+.05:-o.w/2-.05,o.h*.45,0,.12,o.h*.8,o.d*.55,0x4f7f3a);if(R()<.5)ad(o.w*.25,o.h+rh*.5,0,.8,1.8,.8,0x7a6f62)});
 const m3=inst(new THREE.BoxGeometry(1,1,1),dt.length);m3.castShadow=false;dt.forEach((q,i)=>{dm.position.set(q.x,q.y,q.z);dm.rotation.set(0,q.r,0);dm.scale.set(q.sx,q.sy,q.sz);dm.updateMatrix();m3.setMatrixAt(i,dm.matrix);m3.setColorAt(i,col.setHex(q.c))});
 [m1,m2,m3].forEach(m=>{m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;TOWN.add(m)})}
/* street life as in the reference photo: bunting across the streets, café tables, bicycles, a cat */
function props(){const FL=[0xd8567a,0xe8c040,0x3a8fb7,0xf0f0e8,0xc43b3b],st=[];
 STREETS.forEach(P=>{const Q=smooth(P);let acc=0,nx=10;for(let i=1;i<Q.length;i++){const a=Q[i-1],b=Q[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);acc+=l;if(acc>=nx&&Math.hypot(b[0],b[1]-2)>20){nx+=14;const tx=(b[0]-a[0])/l,tz=(b[1]-a[1])/l;st.push([b[0]-tz*6.4,b[1]+tx*6.4,b[0]+tz*6.4,b[1]-tx*6.4])}}});
 const g=new THREE.ConeGeometry(.28,.55,3);g.rotateX(Math.PI);const f=inst(g,st.length*9),dm=new THREE.Object3D(),col=new THREE.Color();let k=0;
 st.forEach(q=>{obox(Math.hypot(q[2]-q[0],q[3]-q[1]),.05,.05,(q[0]+q[2])/2,6.1,(q[1]+q[3])/2,0x3a2a1a,Math.atan2(-(q[3]-q[1]),q[2]-q[0]),0).castShadow=false;
  for(let i=0;i<9;i++){const t=(i+.5)/9;dm.position.set(q[0]+(q[2]-q[0])*t,6.1-.55*(1-(2*t-1)**2)-.28,q[1]+(q[3]-q[1])*t);dm.rotation.set(0,0,0);dm.scale.set(1,1,1);dm.updateMatrix();f.setMatrixAt(k,dm.matrix);f.setColorAt(k++,col.setHex(FL[i%5]))}});
 f.instanceMatrix.needsUpdate=true;if(f.instanceColor)f.instanceColor.needsUpdate=true;f.castShadow=false;TOWN.add(f);
 [[23,7,0xd8567a],[26,10,0x2b7fa6],[23,13,0xe8a33c],[-23,4,0x2b7fa6],[-26,7,0xd8567a],[-23,10,0xe8a33c]].forEach(t=>{box(1.1,.08,1.1,t[0],.8,t[1],0x6b4a2b);box(.1,.8,.1,t[0],.4,t[1],0x3a2a1a);const u=new THREE.Mesh(new THREE.ConeGeometry(1.7,.7,10),mat(t[2]));u.position.set(t[0],2.6,t[1]);u.castShadow=true;TOWN.add(u);box(.07,1.8,.07,t[0],1.7,t[1],0x3a2a1a);CIR.push({x:t[0],z:t[1],r:.7})});
 [[7,13.4],[-24,0.5]].forEach(p=>{for(const sx of [-.6,.6]){const w=new THREE.Mesh(new THREE.TorusGeometry(.42,.05,6,16),mat(0x1c1c20));w.position.set(p[0]+sx,.47,p[1]);TOWN.add(w)}box(1.2,.06,.06,p[0],.75,p[1],0x7a2a22);box(.06,.7,.06,p[0]-.2,.65,p[1],0x7a2a22);box(.3,.05,.12,p[0]-.3,1.02,p[1],0x1c1c20)});
 box(.5,.26,.24,4.5,.2,11.5,0xf4f1ea);box(.22,.2,.22,4.82,.36,11.5,0xf4f1ea);box(.06,.1,.06,4.9,.5,11.42,0xf4f1ea);box(.06,.1,.06,4.9,.5,11.58,0xf4f1ea)}
function trees(){const WC=[...WALL,WALL[0]],t=[];
 for(let i=0;i<300&&t.length<170;i++){const x=-58+R()*188,z=-168+R()*278;
  if(inPoly(WALL,x,z)||dLine(WC,x,z)<4||ROADS.some(r=>dLine(r,x,z)<4)||STREETS.some(r=>dLine(r,x,z)<4)||(x>66&&x<126&&z>-14&&z<34)||Math.hypot(x-AX,z-AZ)<22||Math.hypot(x-80,z+108)<28)continue;t.push([x,z,1.3+R()*.9])}
 const a=inst(new THREE.CylinderGeometry(.2,.3,1.6,6),t.length),b=inst(new THREE.IcosahedronGeometry(1.6,1),t.length),dm=new THREE.Object3D(),col=new THREE.Color(),GC=[0x2f5a30,0x3b6b3a,0x4a7a38,0x57873f];
 t.forEach((p,i)=>{dm.rotation.set(0,0,0);dm.position.set(p[0],.8,p[1]);dm.scale.set(1,1,1);dm.updateMatrix();a.setMatrixAt(i,dm.matrix);a.setColorAt(i,col.setHex(0x5a3d22));
  dm.position.set(p[0],1.6+p[2]*.9,p[1]);dm.scale.set(p[2]/1.6,p[2]/1.6,p[2]/1.6);dm.updateMatrix();b.setMatrixAt(i,dm.matrix);b.setColorAt(i,col.setHex(GC[(R()*4)|0]));CIR.push({x:p[0],z:p[1],r:.5})});
 [a,b].forEach(m=>{m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;TOWN.add(m)})}
function build(){TOWN=new THREE.Group();BOX.length=CIR.length=0;seed=7;
 const gr=new THREE.Mesh(new THREE.PlaneGeometry(700,700),mat(0x86b556));gr.rotation.x=-Math.PI/2;gr.position.set(36,0,-29);gr.receiveShadow=true;TOWN.add(gr);
 [['light',0,0,790,390],['wheat',850,0,1340,200],['wheat',1340,0,1596,260],['wheat',1400,260,1596,1250],['wheat',0,1130,400,1650],['light',0,1650,250,2339],['green',450,1190,1100,1900],['light',700,1280,1090,1700],['green',1100,1320,1596,1900],['wheat',1100,1900,1596,2339],['wheat',420,2000,1100,2339],['plow',250,2000,420,2339]].forEach(f=>field(f[0],f[1],f[2],f[3],f[4]));
 const DS=THREE.DoubleSide,cob=new THREE.MeshStandardMaterial({map:ctex(0,1),roughness:.95,side:DS}),dirt=new THREE.MeshStandardMaterial({map:ctex(1,1),roughness:1,side:DS}),rim=new THREE.MeshStandardMaterial({color:0x5e5648,roughness:1,side:DS}),pav=new THREE.MeshStandardMaterial({map:ctex(0,.25),roughness:.95,side:DS});
 poly(WALL,pav,.06);ROADS.forEach(r=>{const Q=smooth(r);ribbon(Q,5.6,rim,.085);ribbon(Q,4.4,dirt,.092)});STREETS.forEach(r=>{const Q=smooth(r);ribbon(Q,6.6,rim,.095);ribbon(Q,5.4,cob,.103)});
 const pz=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.04,40),new THREE.MeshStandardMaterial({map:ctex(0,12),roughness:.95}));pz.scale.set(27,1,16);pz.position.set(0,.11,2);pz.receiveShadow=true;TOWN.add(pz);
 /* town wall with round towers and three gates (south-west, north, east) */
 const n=WALL.length;WALL.forEach((p,i)=>{wallSeg(p,WALL[(i+1)%n],6.5,0xd9d3c4,GATES.includes(i)?7.5:0);tower(p[0],p[1],2.3,9,0xe0dacb,0x8a2f22)});
 /* Central Town Square: fountain, notice board, benches, market */
 const F=new THREE.Group();F.position.set(-14.4,0,7.2);TOWN.add(F);const cy=(r0,r1,h,y,c)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,h,24),mat(c));m.position.y=y;m.castShadow=m.receiveShadow=true;F.add(m)};
 cy(3,3,.7,.35,0x9a9a9a);cy(2.6,2.6,.05,.72,0x3b7ea8);cy(.5,.6,2.6,1.3,0xb0b0b0);cy(1.3,.4,.4,2.7,0x9a9a9a);CIR.push({x:-14.4,z:7.2,r:3.2});
 box(.25,2.4,.25,1.4,1.2,14,0x4a3320);box(.25,2.4,.25,4.6,1.2,14,0x4a3320);box(3.4,1.6,.3,3,1.9,14,0x6b4a2b,1);const nb=label('Notice Board','#d6a93c',.9);nb.position.set(3,3.5,14);TOWN.add(nb);
 box(2.4,.5,.8,-14.4,.35,12.6,0x5a3d22,1);box(2.4,.5,.8,-14.4,.35,1.8,0x5a3d22,1);box(.8,.5,2.4,-9,.35,7.2,0x5a3d22,1);box(.8,.5,2.4,-19.8,.35,7.2,0x5a3d22,1);
 stall(19.5,3.6,0x2d4a86,'General Goods');stall(14,3.6,0x7a1f1f,'Weapons');stall(8.5,3.6,0x1f5f73,'Armor');[8.5,14,19.5].forEach((x,i)=>stall(x,-6.5,[0xe8e0c8,0xb8862b,0xe8e0c8][i],''));
 /* church beside the plaza (as on the map) */
 box(18,7,8,-8.4,3.5,-9.6,0xd8cdb4,1);const cr=new THREE.Mesh(new THREE.ConeGeometry(.7071,1,4),mat(0x9c3a2a));cr.rotation.y=Math.PI/4;cr.scale.set(19.5,4.5,9.5);cr.position.set(-8.4,9.25,-9.6);cr.castShadow=true;TOWN.add(cr);
 tower(-17.4,-9.6,4,6,0xd8cdb4,0x9c3a2a);box(4,13,4,2.1,6.5,-9.6,0xd8cdb4,1);const tr=new THREE.Mesh(new THREE.ConeGeometry(.7071,1,4),mat(0x7a2a22));tr.rotation.y=Math.PI/4;tr.scale.set(4.6,5,4.6);tr.position.set(2.1,16,-9.6);TOWN.add(tr);const cl0=label('Church','#f1ead8',1.1);cl0.position.set(-8.4,15,-9.6);TOWN.add(cl0);
 /* market district buildings, guild, tavern */
 bld(33.6,-18,12,9,5.5,0x6a5f55,0x3a3f4a,'Blacksmith');box(1.4,.8,.7,28.6,.4,-12.5,0x2a2a2f,1);
 bld(60,6,16,13,7,0x7b5c3a,0x7a1f1f,"Adventurers' Guild");bld(-27.6,-21.6,16,13,6.5,0x8a6a45,0x4a2d1a,'The Gilded Flagon');
 houses();props();
 /* castle on the western hill: keep, towers, bailey wall, great hall and training yard */
 poly(L([[520,690],[400,690],[300,690],[245,740],[240,990],[455,1010],[500,900],[520,700]]),0xd8c496,.07);
 const BW=L([[520,672],[400,668],[300,672],[240,730],[225,830],[225,990]]);BW.forEach((p,i)=>{if(i)wallSeg(BW[i-1],p,5,0x8c8b82,0)});const BG=L([[225,990],[455,1015]]);wallSeg(BG[0],BG[1],5,0x8c8b82,8);
 bld(111.6,3,13,12,11,0x8c8b82,0x7a2a22,'Royal Castle');[[-7,-6.5],[7,-6.5],[-7,6.5],[7,6.5]].forEach(o=>tower(111.6+o[0],3+o[1],1.9,13,0xe0dacb,0x454a56));
 bld(94.8,22.8,10,9,5,0x7a5a3a,0x6a4a2e,'Great Hall');
 const YX=88,YZ=-2;for(let x=83;x<=93;x+=2){box(.3,1.6,.3,x,.8,YZ+4,0x5a3d22,1);box(.3,1.6,.3,x,.8,YZ-4,0x5a3d22,1)}box(10,.25,.25,YX,1.2,YZ+4,0x6b4a2b);box(10,.25,.25,YX,1.2,YZ-4,0x6b4a2b);box(.25,.25,8,93,1.2,YZ,0x6b4a2b,1);
 [[91,-4.5],[91,0.5],[88.5,-2]].forEach(p=>{box(.35,1.9,.35,p[0],.95,p[1],0x5a3d22,1);box(1.1,.3,.3,p[0],1.7,p[1],0x6b4a2b);box(.6,1,.6,p[0],1.1,p[1],0x9b7548)});const ty=label('Training Yard','#f1ead8',1.1);ty.position.set(YX,4.5,YZ);TOWN.add(ty);
 /* Colosseum on the north-west field: open south gate, walkable arena floor and stepped spectator seating */
 const arena=new THREE.Mesh(new THREE.CylinderGeometry(14.5,14.5,.22,48),mat(0xb59a70));arena.position.set(AX,.08,AZ);arena.receiveShadow=true;TOWN.add(arena);
 for(let i=0;i<48;i++){const a=i/48*6.283,lx=Math.cos(a)*17,lz=Math.sin(a)*17;if(Math.abs(lx)<4.5&&lz<-13)continue;obox(2.4,10,.9,AX+lx,5,AZ+lz,0xc9b88f,Math.atan2(-Math.cos(a),-Math.sin(a)),1)}
 for(let row=0;row<4;row++){const rr=14.4+row*.65,seat=new THREE.Mesh(new THREE.CylinderGeometry(rr,rr,.55,48,1,true),mat(row%2?0x8b7355:0x9b805d));seat.position.set(AX,1.1+row*.65,AZ);TOWN.add(seat)}
 box(8,6,.9,AX-5,3,AZ-15.5,0x4a3320,1);box(8,6,.9,AX+5,3,AZ-15.5,0x4a3320,1);box(18,.8,1.4,AX,6.3,AZ-15.5,0xb5a47c);
 for(const sd of [-1,1]){box(1,8,1,AX+sd*9,4,AZ-12,0xb5a47c,1);box(1,8,1,AX+sd*9,4,AZ+12,0xb5a47c,1)}const cl=label('COLOSSEUM ARENA','#d6a93c',1.8);cl.position.set(AX,13,AZ);TOWN.add(cl);
 /* outskirts: windmill farm hamlet, haystacks, forest, map-edge barriers */
 tower(103.2,-112.2,1.8,8,0xd9cdb0,0x6b3a1f);for(let k=0;k<4;k++){const bl=new THREE.Mesh(new THREE.BoxGeometry(.3,6,.1),mat(0xe8dcc0));bl.position.set(103.2,7,-114.2);bl.rotation.z=k*Math.PI/2+.4;TOWN.add(bl)}
 [[97.2,-102],[74.4,-105.6],[63.6,-103.2],[78,-110.4]].forEach(p=>bld(p[0],p[1],6,5,3.6,0xd9c9a8,0xa8402f));const hl=label('Windmill Farm','#f1ead8',1.3);hl.position.set(88,9,-108);TOWN.add(hl);
 for(let i=0;i<12;i++){const h=new THREE.Mesh(new THREE.ConeGeometry(1.1,1.8,8),mat(0xd8b04a));h.position.set(60+R()*44,.9,-118+R()*22);h.castShadow=true;TOWN.add(h)}
 trees();
 BOX.push({x:36,z:113,hw:98,hd:1,c:1,s:0},{x:36,z:-171,hw:98,hd:1,c:1,s:0},{x:-61,z:-29,hw:1,hd:142,c:1,s:0},{x:133,z:-29,hw:1,hd:142,c:1,s:0});
 scene.add(TOWN)}
function collide(p){for(let k=0;k<2;k++){
 for(const b of BOX){const dx=p.x-b.x,dz=p.z-b.z,Rr=b.hw+b.hd+.6;if(dx>Rr||dx<-Rr||dz>Rr||dz<-Rr)continue;
  const lx=dx*b.c-dz*b.s,lz=dx*b.s+dz*b.c,ex=lx-clamp(lx,-b.hw,b.hw),ez=lz-clamp(lz,-b.hd,b.hd),d2=ex*ex+ez*ez;if(d2>=.2025)continue;
  let px=0,pz=0;if(d2>1e-6){const d=Math.sqrt(d2),f=(.45-d)/d;px=ex*f;pz=ez*f}else{const ax=b.hw-Math.abs(lx),az=b.hd-Math.abs(lz);if(ax<az)px=(lx>=0?1:-1)*(ax+.45);else pz=(lz>=0?1:-1)*(az+.45)}
  p.x+=px*b.c+pz*b.s;p.z+=-px*b.s+pz*b.c}
 for(const c of CIR){const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz),m=c.r+.45;if(d<m){const f=d>1e-6?(m-d)/d:0;if(f){p.x+=dx*f;p.z+=dz*f}else p.x+=m}}}
 p.x=clamp(p.x,-HALF+1,HALF-1);p.z=clamp(p.z,-HALF+1,HALF-1)}

/* ---------- NPCs: positions are pure functions of the shared clock, so every player sees them in the same place ---------- */
const NPC=[
{n:'Mira',r:'Weapon Merchant',g:'female',w:'sword',c:0xc9d1dc,k:0x2d4a86,t:'work',x:14,z:1.3,yaw:0,L:['Steel for every hand: longswords, warhammers, gauntlets and bows.','My shelves are still being stocked, so I have nothing to sell you yet. Check back after the next update.','Until then your class weapon is yours to swap freely in the main menu.']},
{n:'Odalys',r:'Armor Merchant',g:'female',w:'hammer',c:0x9c7a3c,k:0x1f5f73,t:'work',x:8.5,z:1.3,yaw:0,L:['Plate, mail and padded gambesons, cut to measure.','The tailors are still at work, so I cannot sell armor yet. Your armor colors can already be picked when you create a knight.']},
{n:'Pip',r:'General Goods',g:'male',w:'sword',c:0x6b5b3a,k:0xb8862b,t:'work',x:19.5,z:1.3,yaw:0,L:['Rope, rations, lanterns... anything a road-weary soul might need.','Caravans are the best customers I have. The Guild will be sending them out before long.']},
{n:'Bran',r:'Blacksmith',g:'male',w:'hammer',c:0x3a3f4a,k:0x1a1a1a,t:'work',x:31,z:-11.8,yaw:0,L:['Mind the sparks. I keep the forge hot from dawn to dusk.','A good hammer is only as strong as the arm that swings it.']},
{n:'Corvin',r:'Traveling Merchant',g:'male',w:'bow',c:0x4a5d3a,k:0x5a2d6b,t:'path',P:[[66,-11],[26,-1.5]],v:1.1,o:0,L:['Roads, ruins and rumors: I carry all three.','I am only passing through the market. Watch for me when special wares arrive.']},
{n:'Hale',r:'Town Guard',g:'male',w:'sword',c:0x8e97a6,k:0x7a1f1f,t:'path',P:[[17,11.3],[-17,11.3],[-17,-2],[17,-2]],v:1.7,o:0,L:['Keep your blade sheathed in the square, friend.','I patrol the square all day. The town has been quiet.']},
{n:'Ines',r:'Town Guard',g:'female',w:'sword',c:0xc9d1dc,k:0x7a1f1f,t:'path',P:[[17,-2],[-17,-2],[-17,11.3],[17,11.3]],v:1.7,o:26,L:['Welcome to town. If you find trouble, find a guard.','Duels belong in the arena, not in the street.']},
{n:'Selene',r:'Guild Receptionist',g:'female',w:'sword',c:0x6b5b3a,k:0x7a1f1f,t:'work',x:50.3,z:6,yaw:-1.57,L:["Welcome to the Adventurers' Guild.",'Escort, rescue and delivery contracts will be posted here once the mission system opens. Nothing is on the board today.','Parties will also form here, so bring friends.']},
{n:'Old Tomas',r:'Town Crier',g:'male',w:'sword',c:0x4a3f33,k:0x3b6b3a,t:'work',x:.6,z:13.2,yaw:1.25,L:['Hear ye! The notice board is bare for now, but the town is filling with travelers.','Look around: every knight you see here is a real player, standing in the square right now.']},
{n:'Greta',r:'Innkeeper',g:'female',w:'hammer',c:0x9a8a6a,k:0x5a2d6b,t:'work',x:-27.6,z:-13.4,yaw:0,L:['Come in, come in! Though my beds are not ready for guests just yet.','The Gilded Flagon will serve ale and rumors when it opens.']},
{n:'Bram',r:'Colosseum Guard',g:'male',w:'sword',c:0x8e97a6,k:0x7a1f1f,t:'work',x:AX,z:AZ-18.6,yaw:3.14,L:['The Colosseum is open. Enter the arena and speak with Cassius to register for ranked 1v1 or start solo Humans vs Beasts.']},
{n:'Tarin',r:'Training Instructor',g:'male',w:'hammer',c:0x8b7655,k:0x5a3926,t:'work',x:86,z:-2,yaw:-1.57,L:['Keep your stance balanced and your guard ready.','The practice yard is open. Weapon-specific sparring drills will be connected in a later update.']},
{n:'Ser Edric',r:'Castle Guard',g:'male',w:'sword',c:0x8e97a6,k:0x454a56,t:'path',P:[[79,24],[79,-5]],v:1.2,o:0,L:['The castle grounds are under royal protection.','Visitors may explore the outer courtyard.']},
{n:'Cassius',r:'Colosseum Announcer',g:'male',w:'sword',c:0xb8862b,k:0x7a1f1f,t:'work',x:AX,z:AZ-1.5,yaw:3.14,L:['Welcome to the arena! Ranked 1v1 duels and solo Humans vs Beasts waves are available here.','Register for ranked PvP to find another player, or start a solo beast challenge. Team PvE is not available yet.','Use E to return to the town entrance while inside the arena.']},
{n:'Wren',r:'Villager',g:'female',w:'sword',c:0x6b5b3a,k:0x1f5f73,t:'wander',x:-3,z:10,R:3,o:1,L:['Lovely day for the square, is it not?','I come here every morning to hear the fountain.']},
{n:'Dob',r:'Villager',g:'male',w:'sword',c:0x4a3f33,k:0x2d4a86,t:'wander',x:-3,z:-1,R:2.5,o:4,L:['They say the forests past the walls are full of wolves.','I will stay right here, thank you.']}];
NPC.forEach(n=>{if(n.P){n.len=0;n.seg=n.P.map((p,i)=>{const q=n.P[(i+1)%n.P.length],l=Math.hypot(q[0]-p[0],q[1]-p[1]);n.len+=l;return l})}});
function npcAt(n,t,o){o=o||{};if(n.t=='work'){o.x=n.x;o.z=n.z;return o}
 if(n.t=='wander'){o.x=n.x+n.R*Math.sin(t*.13+n.o);o.z=n.z+n.R*Math.sin(t*.153+n.o*2+1);return o}
 let s=((t*n.v+n.o)%n.len+n.len)%n.len,i=0;while(s>n.seg[i]){s-=n.seg[i];i++}const p=n.P[i],q=n.P[(i+1)%n.P.length],f=s/n.seg[i];o.x=lerp(p[0],q[0],f);o.z=lerp(p[1],q[1],f);return o}
function npcMesh(g,material,x,y,z){const m=new THREE.Mesh(g,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m}
function makeTownNpc(n){
 const root=new THREE.Group(),skin=new THREE.MeshStandardMaterial({color:n.skin||0xc99168,roughness:.9}),cloth=new THREE.MeshStandardMaterial({color:n.k||0x6b5b3a,roughness:.95}),trim=new THREE.MeshStandardMaterial({color:n.trim||0xb58a45,roughness:.8}),leather=new THREE.MeshStandardMaterial({color:0x493020,roughness:1}),metal=new THREE.MeshStandardMaterial({color:0x89939d,metalness:.45,roughness:.55});
 const civilian=['Villager','Innkeeper','General Goods','Weapon Merchant','Armor Merchant','Traveling Merchant','Blacksmith','Guild Receptionist','Town Crier'].includes(n.r),guard=n.r.includes('Guard'),h=n.r==='Villager'?1.58:1.72;
 const torso=npcMesh(new THREE.CylinderGeometry(.27,.32,.68,10),cloth,0,h*.63,0);root.add(torso);if(n.g==='female'&&!guard){const skirt=npcMesh(new THREE.CylinderGeometry(.22,.34,.48,10),cloth,0,h*.34,0);root.add(skirt)}
 if(n.r==='Villager'||n.r==='Innkeeper'||n.r.includes('Merchant')||n.r==='Guild Receptionist'||n.r==='Town Crier'){
   const apron=npcMesh(new THREE.BoxGeometry(.42,.48,.08),n.r==='Innkeeper'||n.r==='Blacksmith'?leather:trim,0,h*.48,.22);root.add(apron);
 }
 const head=npcMesh(new THREE.SphereGeometry(.19,12,10),skin,0,h*.99,0);head.scale.y=1.12;root.add(head);
 const hair=npcMesh(new THREE.SphereGeometry(.2,10,8),new THREE.MeshStandardMaterial({color:n.hair||0x4b3022}),0,h*1.08,-.025);hair.scale.set(1,.55,1);root.add(hair);
 const legs=[];for(let side of [-1,1]){const leg=npcMesh(new THREE.CylinderGeometry(.075,.09,.48,8),leather,side*.12,h*.19,0);root.add(leg);legs.push(leg)}
 const arms=[];for(let side of [-1,1]){const arm=npcMesh(new THREE.CylinderGeometry(.07,.08,.43,8),skin,side*.34,h*.65,0);arm.rotation.z=side*-.12;root.add(arm);arms.push(arm)}
 if(guard){const vest=npcMesh(new THREE.BoxGeometry(.57,.56,.12),metal,0,h*.65,.18);root.add(vest);const helmet=npcMesh(new THREE.ConeGeometry(.22,.3,8),metal,0,h*1.16,0);root.add(helmet);const shield=npcMesh(new THREE.BoxGeometry(.28,.42,.08),trim,-.48,h*.55,.08);root.add(shield);}
 if(n.r==='Blacksmith'){const apron2=npcMesh(new THREE.BoxGeometry(.46,.56,.1),leather,0,h*.55,.24);root.add(apron2);const hammer=npcMesh(new THREE.BoxGeometry(.32,.1,.12),metal,.45,h*.55,.1);root.add(hammer)}
 if(n.r==='Training Instructor'){const vest=npcMesh(new THREE.BoxGeometry(.55,.5,.14),leather,0,h*.65,.16);root.add(vest);const staff=npcMesh(new THREE.CylinderGeometry(.025,.035,1.05,7),leather,.48,h*.52,.05);staff.rotation.z=-.12;root.add(staff)}
 if(n.r.includes('Merchant')){const pouch=npcMesh(new THREE.SphereGeometry(.11,8,6),trim,.3,h*.38,.13);root.add(pouch)}
 if(n.r==='Guild Receptionist'){const book=npcMesh(new THREE.BoxGeometry(.2,.25,.05),leather,.28,h*.52,.2);root.add(book)}
 if(n.r==='Traveling Merchant'){const pack=npcMesh(new THREE.BoxGeometry(.36,.48,.22),leather,0,h*.7,-.25);root.add(pack);}
 if(n.r==='Villager'){const basket=npcMesh(new THREE.CylinderGeometry(.12,.15,.2,8),trim,.48,h*.42,.08);root.add(basket)}
 if(n.r==='Town Crier'){const cap=npcMesh(new THREE.ConeGeometry(.18,.25,6),trim,0,h*1.22,0);root.add(cap)}
 if(n.r==='Colosseum Announcer'){const cape=npcMesh(new THREE.BoxGeometry(.5,.75,.08),new THREE.MeshStandardMaterial({color:0x7a1f1f}),0,h*.55,-.17);root.add(cape)}
 const name=label(n.n,'#f2dfb1',.58);name.position.set(0,h*1.42,0);root.add(name);TOWN.add(root);
 return {root,pos:new THREE.Vector3(),yaw:n.yaw||0,arms,legs,head,h,phase:Math.random()*6.28};
}
function spawnNPCs(){const skins=[0xc99168,0xe0b18c,0x9c684c,0xb77b57,0xd2a17b,0x875b45],hairs=[0x38271f,0x5a3827,0x211c1a,0x8a5b32,0x4a4a4a,0x2b241f];NPC.forEach((n,i)=>{if(n.c$)return;n.skin=skins[i%skins.length];n.hair=hairs[(i*3)%hairs.length];n.c$=makeTownNpc(n);n.p0={};n.p1={}})}
function npcStep(n,t,dt){const c=n.c$,d2=(c.pos.x-me.pos.x)**2+(c.pos.z-me.pos.z)**2;npcAt(n,t,n.p0);c.pos.set(n.p0.x,0,n.p0.z);c.root.position.copy(c.pos);
 if(d2>3600){c.root.visible=false;return}c.root.visible=true;
 let sp=0,ty=c.yaw;if(n.t!=='work'){npcAt(n,t+.25,n.p1);const dx=n.p1.x-n.p0.x,dz=n.p1.z-n.p0.z,v=Math.hypot(dx,dz)/.25;if(v>.05){sp=clamp(v/WALK*1.1,0,.55);ty=Math.atan2(dx,dz)}}
 if(sp===0&&(d2<36||(dlg&&dlg.n===n)))ty=Math.atan2(me.pos.x-c.pos.x,me.pos.z-c.pos.z);
 c.yaw+=angD(c.yaw,ty)*Math.min(1,dt*6);c.root.rotation.y=c.yaw;c.phase+=dt*(sp>0?7:1.6);
 c.legs.forEach((leg,i)=>{leg.rotation.x=sp>0?Math.sin(c.phase+i*Math.PI)*.45:Math.sin(c.phase+i)*.025});c.arms.forEach((arm,i)=>{arm.rotation.x=sp>0?-Math.sin(c.phase+i*Math.PI)*.35:Math.sin(c.phase*.7+i)*.035});
}

/* ---------- other players: Supabase Realtime (presence = who is here and what they wear, broadcast = movement) ---------- */
const note=t=>{sNote=String(t).replace(/[<>&]/g,'')};
function sync(){if(!ch)return;const st=ch.presenceState(),seen=new Set();
 for(const k in st){if(k===myKey)continue;seen.add(k);if(remotes.has(k)||remotes.size>=30)continue;const m=(st[k]&&st[k][0])||{};
  const c=makeChar(okG(m.g),okW(m.w),'p',{col:okC(m.c,0x8e97a6),cloth:okC(m.k,0x7a1f1f)});c.J.root.visible=false;
  const l=label(String(m.n||'Knight').slice(0,16)+(m.lv?'  Lv '+((+m.lv)|0):''),'#ffffff',.6);l.position.y=2.5;c.J.root.add(l);remotes.set(k,{c,tx:0,tz:0,ty:0,shown:0,seen:performance.now()})}
 for(const[k,r]of remotes)if(!seen.has(k)){scene.remove(r.c.J.root);remotes.delete(k)}}
function onMv(p){if(!p||typeof p.k!=='string')return;const r=remotes.get(p.k);if(!r)return;const x=+p.x,z=+p.z,y=+p.y;if(!isFinite(x)||!isFinite(z)||!isFinite(y))return;
 r.tx=clamp(x,-HALF,HALF);r.tz=clamp(z,-HALF,HALF);r.ty=y;r.seen=performance.now();if(!r.shown){r.c.pos.set(r.tx,0,r.tz);r.c.yaw=y;r.c.J.root.visible=true;r.shown=1}}
function sendMv(force){if(!ch)return;const now=performance.now(),m=Math.hypot(me.pos.x-lastS.x,me.pos.z-lastS.z)>.05||Math.abs(angD(me.yaw,lastS.y))>.05;
 if(!force&&now-tSend<(m?120:2000))return;tSend=now;lastS={x:me.pos.x,z:me.pos.z,y:me.yaw};ch.send({type:'broadcast',event:'mv',payload:{k:myKey,x:+me.pos.x.toFixed(2),z:+me.pos.z.toFixed(2),y:+me.yaw.toFixed(2)}})}
function connect(){note(CLOUD&&SB?'Connecting...':'Offline: online saving is not configured, so no other players can appear.');if(!CLOUD||!SB)return;
 myKey=ACTIVE.id+'.'+Math.random().toString(36).slice(2,7);
 try{ch=SB.channel('kd-town-1',{config:{presence:{key:myKey},broadcast:{self:false}}});
  ch.on('presence',{event:'sync'},sync).on('presence',{event:'join'},()=>sendMv(true)).on('broadcast',{event:'mv'},m=>onMv(m&&m.payload))
   .subscribe(async s=>{if(s==='SUBSCRIBED'){try{await ch.track({n:ACTIVE.name,g:ACTIVE.g,w:sel.w0,c:ACTIVE.col,k:ACTIVE.cloth,lv:ACTIVE.lv});note('Online');sendMv(true)}catch(e){note('Could not announce you: '+e.message)}}
    else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT')note('Realtime unavailable. You are walking alone.');else if(s==='CLOSED')note('Disconnected.')})}
 catch(e){ch=null;note('Realtime failed: '+e.message)}}
function disconnect(){if(ch){try{ch.untrack();SB.removeChannel(ch)}catch(e){}ch=null}remotes.forEach(r=>scene.remove(r.c.J.root));remotes.clear()}

/* ---------- UI ---------- */
function ui(){if($('wHud'))return;const st=document.createElement('style');st.textContent=
'#wHud,#wExit,#wPrompt,#wDlg{position:fixed;z-index:8;display:none}body.inworld #wHud,body.inworld #wExit{display:block}body.inworld .tb,body.inworld #help{display:none!important}'+
'#wHud{top:max(12px,env(safe-area-inset-top));left:max(14px,env(safe-area-inset-left));font-size:12px;line-height:1.5;text-shadow:0 2px 6px #000;pointer-events:none}#wHud b{color:var(--ac);letter-spacing:.2em}'+
'#wExit{top:max(12px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right));font-size:12px}'+
'#wPrompt{bottom:24%;left:50%;transform:translateX(-50%);border-color:var(--ac);color:var(--ac);font-size:16px}'+
'#wDlg{left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(520px,94%);background:rgba(14,14,20,.92);border:1px solid var(--ac);border-radius:10px;padding:12px 16px;box-shadow:0 10px 40px #000a}#wDlg b{color:var(--ac)}#wDlg p{margin:6px 0 10px;font-size:15px}';document.head.appendChild(st);
 const h=(t,id,cls)=>{const e=document.createElement(t);e.id=id;document.body.appendChild(e);return e};
 h('div','wHud');const ex=h('button','wExit');ex.textContent='Leave world';ex.onclick=leave;ex.onmousedown=e=>e.preventDefault();
 const pr=h('button','wPrompt');pr.onclick=()=>interact();pr.onmousedown=e=>e.preventDefault();
 const d=h('div','wDlg');d.innerHTML='<b id="wDn"></b><p id="wDt"></p><button id="wDx"></button>';$('wDx').onclick=()=>nextLine();$('wDx').onmousedown=e=>e.preventDefault();
 const b=document.createElement('button');b.id='wGo';b.textContent='Enter Online World';b.title='Shared medieval town';$('go').after(b);b.onclick=enter}
function showDlg(){const n=dlg.n;$('wDn').textContent=n.n+' · '+n.r;$('wDt').textContent=dlg.message||n.L[0];const x=$('wDx');if(x){x.textContent='Close';x.onclick=closeDlg;}const choices=$('wChoices');if(choices)choices.innerHTML='';$('wDlg').style.display='block';$('wPrompt').style.display='none';}
function closeDlg(){dlg=null;$('wDlg').style.display='none';$('wDx').onclick=closeDlg}
function actionMenu(n){const choices=[];if(n.r==='Colosseum Guard'){choices.push(['Enter the Colosseum','enterArena'],['Ask about arena rules','info'])}else if(n.r==='Town Guard'||n.r==='Castle Guard'){choices.push(['Ask for directions','info'])}if(n.r==='Training Instructor')choices.push(['Training advice','training'],['Weapon practice','practice'])
 if(n.r.includes('Merchant')||n.r==='General Goods'||n.r==='Blacksmith')choices.push(['Browse goods','shop']);
 if(n.r==='Guild Receptionist')choices.push(['View mission board','missions'],['Travel to forest clearing','forestTravel'],['Ask about parties','party']);
 if(n.r==='Innkeeper')choices.push(['Ask for a room','inn']);
 if(n.r==='Town Crier')choices.push(['Hear town notices','info']);
 if(n.r==='Villager')choices.push(['Ask about the town','info']);
 if(n.r==='Colosseum Announcer'){choices.push(PV.st==='queue'?['Leave the PvP queue','pvpLeave']:['Register for a PvP duel','pvpQueue'],['My PvP record','pvpStats'],['Humans vs Beasts · Solo','wavesStart'],['Humans vs Beasts · Team','teamInfo']);if(inArena)choices.push(['Return to town','returnTown']);}
 choices.push(['Leave','close']);
 const d=$('wDlg');d.innerHTML='<b id="wDn"></b><p id="wDt"></p><div id="wChoices" style="display:flex;gap:7px;flex-wrap:wrap"></div><button id="wDx">Close</button>'; $('wDn').textContent=n.n+' · '+n.r;$('wDt').textContent=n.L[0];const wrap=$('wChoices');choices.forEach(([txt,act])=>{const b=document.createElement('button');b.textContent=txt;b.onclick=()=>doAction(n,act);wrap.appendChild(b)});d.style.display='block';$('wPrompt').style.display='none';}
function doAction(n,act){if(act==='close'){closeDlg();return}if(act==='enterArena'){inArena=true;me.pos.set(AX,0,AZ);camYaw=0;dlg={n,message:'You entered the Colosseum arena. Explore the fighting floor and spectator stands.'};showDlg();return}if(act==='returnTown'){clearAct();inArena=false;me.pos.set(AX,0,AZ-24);camYaw=0;dlg={n,message:'You returned to the town entrance.'};showDlg();return}
 if(act==='pvpQueue'){dlg={n,message:pvpStart()};showDlg();return}if(act==='pvpLeave'){pvQuit();dlg={n,message:'You left the PvP queue.'};showDlg();return}
 if(act==='pvpStats'){const p=ACTIVE.prog||{};dlg={n,message:'PvP record: '+(p.pvpW||0)+' wins, '+(p.pvpL||0)+' losses. Reputation: '+ACTIVE.rep+'.'};showDlg();return}
 if(act==='forestTravel'){me.pos.set(-38,0,-116);camYaw=0;dlg={n,message:'You are at the forest clearing. The escort sign is beside the merchant cart. Choose a contract at the sign (press E near the marker).'};showDlg();return}
 if(act==='wavesStart'){closeDlg();startWaves();return}
 if(act==='teamInfo'){dlg={n,message:'Online team PvE matchmaking is not implemented in this build. Solo waves are playable; no AI companion or fake online teammate is substituted.'};showDlg();return}
 let msg='';if(act==='shop')msg='You can browse this trader’s stall, but the item purchasing and inventory system has not been implemented yet. No gold will be taken.';
 if(act==='missions'){msg='Escort contracts begin at the marked clearing INSIDE the forest, not in town. Travel to the forest marker and choose a contract there.';}
 if(act==='party')msg='Party formation is planned, but shared party management is not active yet.';
 if(act==='inn')msg='The inn is open to explore, but room booking and resting bonuses are not implemented yet.';
 if(act==='arenaInfo'){msg='Humans vs Beasts uses this Colosseum arena. Choose solo waves or team queue. Team matchmaking requires a live shared session; this build currently offers solo waves.';}
 if(act==='training')msg='Keep your feet moving, watch your opponent’s shoulders, and do not overcommit to every strike.';
 if(act==='practice')msg='The training yard and dummies are here to explore. Live weapon practice using the combat system is not connected yet.';
 if(act==='info')msg=n.L[1]||n.L[0];dlg={n,message:msg};showDlg();}
function interact(){if(dlg){closeDlg();return}if(near)actionMenu(near)}function worldEnv(){scene.background.setHex(0xf2cf9a);scene.fog.color.setHex(0xe9c9a0);scene.fog.near=60;scene.fog.far=200;hemi.color.setHex(0xffe6c0);hemi.groundColor.setHex(0x6a5a45);hemi.intensity=.95;sun.color.setHex(0xffd9a0);sun.intensity=1.3;camera.far=280;camera.updateProjectionMatrix()}
function enter(){if(!ACTIVE||W.on)return;if(!TOWN)build();spawnNPCs();if(!forestSign){forestSign=forestMarker();for(let i=CIR.length-1;i>=0;i--)if(Math.hypot(CIR[i].x+38,CIR[i].z+112)<9)CIR.splice(i,1)}bootOn=false;
 saved={bg:scene.background.getHex(),fog:scene.fog.color.getHex()};ORIG.visible=COLO.visible=false;V.forEach(c=>scene.remove(c.J.root));BV.forEach(c=>scene.remove(c.J.root));
 worldEnv();scene.add(sun.target);
 me=makeChar(ACTIVE.g,okW(sel.w0),'p',{col:ACTIVE.col,cloth:ACTIVE.cloth});me.pos.set(rnd(-3,3),0,9);me.yaw=0;camYaw=0;camPitch=.36;camDist=7;inArena=false;const l=label(ACTIVE.name,'#d6a93c',.6);l.position.y=2.5;me.J.root.add(l);
 camera.position.set(me.pos.x,8.5,me.pos.z-10.5);lastS.x=1e9;ui();$('menu').style.display='none';document.body.classList.add('inworld');W.on=true;connect()}
function leave(){if(!W.on)return;pvQuit();W.on=false;clearAct();closeDlg();disconnect();scene.remove(me.J.root);NPC.forEach(n=>{if(n.c$){scene.remove(n.c$.root);n.c$=null}});scene.remove(TOWN);scene.remove(sun.target);
 BOX.length=CIR.length=0;TOWN=null;forestSign=null;document.body.classList.remove('inworld');applyMap(sel.map);scene.fog.near=sel.map=='colo'?70:18;$('wPrompt').style.display='none';$('menu').style.display='flex'}
addEventListener('keydown',e=>{if(!W.on)return;if(e.code=='KeyE'&&!e.repeat){if(ACT.active){ACT.input.swap=true;return}if(W.on&&forestSign&&Math.hypot(me.pos.x-forestSign.x,me.pos.z-forestSign.z)<3.8){openEscortMenu();return}if(inArena&&!near){inArena=false;me.pos.set(AX,0,AZ-24);camYaw=0;return}interact()}else if(e.code=='Escape'){if(dlg)closeDlg();else leave()}});
const cv=renderer.domElement,stopDrag=()=>{dragCam=false};   // M2 (right mouse button) held + drag = turn the camera
cv.addEventListener('contextmenu',e=>{if(W.on)e.preventDefault()});
cv.addEventListener('pointerdown',e=>{if(!W.on||e.button!==2)return;e.preventDefault();dragCam=true;lastPX=e.clientX;lastPY=e.clientY;cv.setPointerCapture&&cv.setPointerCapture(e.pointerId)});
cv.addEventListener('pointermove',e=>{if(!W.on||!dragCam)return;const dx=e.clientX-lastPX,dy=e.clientY-lastPY;lastPX=e.clientX;lastPY=e.clientY;camYaw+=dx*.006;camPitch=clamp(camPitch+dy*.003,PMIN,PMAX)});
cv.addEventListener('pointerup',e=>{if(e.button===2)stopDrag()});cv.addEventListener('pointercancel',stopDrag);addEventListener('blur',stopDrag);
cv.addEventListener('wheel',e=>{if(!W.on)return;e.preventDefault();camDist=clamp(camDist+e.deltaY*.004,ZMIN,ZMAX)},{passive:false});

/* ---------- Forest escort + Humans vs Beasts activities ---------- */
const ACT={mode:'',active:false,elapsed:0,duration:300,health:100,playerHealth:100,stamina:100,wave:0,left:0,enemies:[],cart:null,route:[],wp:0,ui:null,lastHit:0,seed:1,combat:null,locked:null,input:{light:false,heavy:false,block:false,dodge:false,swap:false,feint:false,glory:false},heldBlock:false,aimRing:null};
function openEscortMenu(){const n={n:'Forest Contract Board',r:'Guild Escort',L:[]};const d=$('wDlg');d.innerHTML='<b>FOREST ESCORT CONTRACTS</b><p>Protect Merchant Rowan and his cart along the forest trail. Choose a route length.</p><div id="wChoices" style="display:flex;gap:7px;flex-wrap:wrap"></div><button id="wDx">Close</button>';[['Short · 5 min',5],['Medium · 8 min',8],['Long · 10 min',10]].forEach(([t,m])=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>{closeDlg();startEscort(m)};$('wChoices').appendChild(b)});$('wDx').onclick=closeDlg;d.style.display='block';$('wPrompt').style.display='none'}
function actUI(){if(ACT.ui)return;const st=document.createElement('style');st.textContent='#kdAct{position:fixed;z-index:9;top:78px;left:50%;transform:translateX(-50%);width:min(390px,94vw);padding:10px 14px;background:#111d;border:1px solid var(--ac);border-radius:9px;text-align:center;color:var(--fg);display:none;pointer-events:none}#kdAct b{color:var(--ac)}#kdAct button{pointer-events:auto;margin:4px;padding:9px 13px;border-radius:7px;border:1px solid var(--ac);background:#25211b;color:var(--fg);font-weight:700}#kdAct .actTouch{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-top:6px}#kdAct .aimOn{background:#5a421d;border-color:#f0c56b}';document.head.appendChild(st);const e=document.createElement('div');e.id='kdAct';e.addEventListener('pointerdown',ev=>{const b=ev.target.closest('[data-act=block]');if(b){ev.preventDefault();ACT.heldBlock=true}});e.addEventListener('pointerup',ev=>{if(ev.target.closest('[data-act=block]'))ACT.heldBlock=false});e.addEventListener('pointercancel',()=>ACT.heldBlock=false);e.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b)return;if(b.dataset.act==='aim'){toggleAim();return}if(b.dataset.act==='block')return;ACT.input[b.dataset.act]=true});document.body.appendChild(e);ACT.ui=e}
function actHud(s){actUI();ACT.ui.style.display=s?'block':'none';if(!ACT.ui.querySelector('#kdActInfo'))ACT.ui.innerHTML='<div id="kdActInfo"></div>'+(IS_T?'<div class="actTouch"><button data-act="aim">AIM / LOCK</button><button data-act="light">LIGHT ATTACK</button><button data-act="heavy">HEAVY ATTACK</button><button data-act="dodge">DODGE</button><button data-act="block">BLOCK</button><button data-act="swap">SWAP</button><button data-act="feint">FEINT</button><button data-act="glory">COMBO</button></div>':'');const info=ACT.ui.querySelector('#kdActInfo');if(info)info.innerHTML=s;const b=ACT.ui.querySelector('[data-act=aim]');if(b)b.classList.toggle('aimOn',!!ACT.locked)}
function creature(x,z,type='wolf',hp=35){const root=new THREE.Group(),fur=mat(type==='bear'?0x493528:type==='spider'?0x25212a:type==='boar'?0x76513b:0x77715a),dark=mat(0x211b18);
 const body=new THREE.Mesh(new THREE.SphereGeometry(type==='bear'?.72:.48,10,8),fur);body.scale.set(1,.8,1.35);body.position.y=.65;root.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(type==='bear'?.42:.3,10,8),fur);head.position.set(0,.95,.55);root.add(head);
 for(let i=0;i<(type==='spider'?8:4);i++){const a=i/(type==='spider'?8:4)*Math.PI*2,leg=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,type==='bear'?.7:.55,6),fur);leg.position.set(Math.cos(a)*.42,.35,Math.sin(a)*.42);leg.rotation.z=Math.cos(a)*.8;leg.rotation.x=Math.sin(a)*.8;root.add(leg)}
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,6,6),dark);eye.position.set(-.12,1.02,.78);root.add(eye);const eye2=eye.clone();eye2.position.x=.12;root.add(eye2);
 root.position.set(x,0,z);TOWN.add(root);return{root,x,z,type,hp,max:hp,alive:true,attack:0}}
function clearAct(){ACT.enemies.forEach(e=>TOWN&&TOWN.remove(e.root));ACT.enemies=[];if(ACT.cart&&TOWN){TOWN.remove(ACT.cart.root);TOWN.remove(ACT.cart.merchant)}ACT.cart=null;ACT.active=false;ACT.mode='';ACT.combat=null;ACT.locked=null;ACT.input={light:false,heavy:false,block:false,dodge:false,swap:false,feint:false,glory:false};ACT.heldBlock=false;if(ACT.aimRing&&TOWN)TOWN.remove(ACT.aimRing);ACT.aimRing=null;actHud('')}
function rewardActivity(g,x,r,labelText){if(!ACTIVE)return;ACTIVE.gold=(ACTIVE.gold||0)+g;ACTIVE.xp=(ACTIVE.xp||0)+x;while((ACTIVE.lv||1)<100&&ACTIVE.xp>=100*(ACTIVE.lv||1)){ACTIVE.xp-=100*(ACTIVE.lv||1);ACTIVE.lv=(ACTIVE.lv||1)+1}ACTIVE.rep=(ACTIVE.rep||0)+r;ACTIVE.lv=ACTIVE.lv||1;ACTIVE.prog=ACTIVE.prog||{};ACTIVE.prog[labelText]=(ACTIVE.prog[labelText]||0)+1;
 if(typeof Cloud!=='undefined'&&Cloud.save)Cloud.save(ACTIVE).then(()=>note('Rewards saved: +'+g+' gold, +'+x+' XP, +'+r+' reputation')).catch(e=>note('Rewards earned locally; cloud save failed: '+e.message));
}
function spawnWave(){ACT.wave++;const count=Math.min(1+Math.floor(ACT.wave/2),5);for(let i=0;i<count;i++){const t=ACT.wave>=5&&i===count-1?'bear':ACT.wave>=3&&i===count-1?'boar':'wolf';ACT.enemies.push(creature(AX-8+Math.random()*16,AZ-7+Math.random()*14,t,25+ACT.wave*12))}ACT.left=count;actHud('<b>HUMANS VS BEASTS</b><br>Wave '+ACT.wave+' · Enemies '+count+'<br>Health '+Math.ceil(ACT.health)+'%<br><small>TAB / AIM locks target · J / left-click light · K / right-click heavy · PvP combat rules</small>')}
function startWaves(){if(ACT.active||PV.st==='match'||PV.st==='queue')return;clearAct();ACT.mode='waves';ACT.active=true;ACT.health=100;ACT.playerHealth=100;ACT.stamina=100;ACT.wave=0;ACT.elapsed=0;me.pos.set(AX,0,AZ-3);me.yaw=0;spawnWave();note('Humans vs Beasts begins. Press TAB (or AIM on mobile) to lock onto a creature; combat uses the same weapon moves, stamina, hit reactions and attack animations as PvP.')}
function forestMarker(){const x=-38,z=-112;const sign=box(2.8,2.2,.18,x,1.1,z,0x6b4a2b,0);const tag=label('GUILD ESCORT · E','#f4d27b',.95);tag.position.set(x,3,z);TOWN.add(tag);const pole=box(.15,2.5,.15,x,1.25,z,0x493020);return{x,z,sign,tag,pole}}
function startEscort(minutes){if(PV.st==='match'||PV.st==='queue'){note('Leave Colosseum matchmaking before starting an escort.');return}clearAct();ACT.mode='escort';ACT.active=true;ACT.duration=minutes*60;ACT.elapsed=0;ACT.health=100;ACT.playerHealth=100;ACT.stamina=100;ACT.wp=0;ACT.route=[[-38,-112],[-29,-121],[-16,-126],[-2,-120],[8,-108]];me.pos.set(-38,0,-116);me.yaw=0;
 const root=new THREE.Group(),wood=mat(0x704321),cloth=mat(0x9c733c);const base=new THREE.Mesh(new THREE.BoxGeometry(2.4,.3,1.45),wood);base.position.y=.85;root.add(base);for(let x of [-.8,.8]){const w=new THREE.Mesh(new THREE.TorusGeometry(.48,.09,8,16),wood);w.rotation.y=Math.PI/2;w.position.set(x,.48,0);root.add(w)}for(let x of [-.65,.65]){const post=new THREE.Mesh(new THREE.BoxGeometry(.12,1.1,.12),wood);post.position.set(x,1.35,-.35);root.add(post)}const canopy=new THREE.Mesh(new THREE.BoxGeometry(2, .12,1.3),cloth);canopy.position.set(0,1.9,-.25);root.add(canopy);root.position.set(-38,0,-112);TOWN.add(root);
 const merchant=makeTownNpc({n:'Merchant Rowan',r:'Traveling Merchant',g:'male',k:0x8b6335,hair:0x4b3022});merchant.root.position.set(-39.6,0,-112);TOWN.add(merchant.root);ACT.cart={root,merchant:merchant.root};
 ACT.enemies=[];for(let i=0;i<3;i++)ACT.enemies.push(creature(-31+i*2, -120-i*2,'wolf',38));
 actHud('<b>FOREST ESCORT · '+minutes+' MIN</b><br>Protect Merchant Rowan and the cart<br>Cart health <span id="kdCartHp">100%</span><br>Reach the forest destination · '+Math.ceil(ACT.duration)+'s remaining<br><small>Face attackers and press J / left-click to strike</small>');
 note('Escort started in the forest clearing. Protect the merchant and moving cart.')}
function liveEnemies(){return ACT.enemies.filter(e=>e.alive)}
function nearestEnemy(max=18){let hit=null,bd=max;for(const e of liveEnemies()){const d=Math.hypot(e.x-me.pos.x,e.z-me.pos.z);if(d<bd){bd=d;hit=e}}return hit}
function toggleAim(){if(!ACT.active)return;if(ACT.locked&&ACT.locked.alive){ACT.locked=null;ACT.combat=null;note('Target lock released.');return}ACT.locked=nearestEnemy(24);ACT.combat=null;if(ACT.locked)note('Locked on: '+ACT.locked.type+'. Press TAB again to release.');else note('No creature nearby to lock onto.')}
function targetMarker(){if(!ACT.aimRing){ACT.aimRing=new THREE.Mesh(new THREE.TorusGeometry(.72,.055,8,28),new THREE.MeshBasicMaterial({color:0xffd36a,transparent:true,opacity:.95,depthTest:false}));ACT.aimRing.rotation.x=Math.PI/2;ACT.aimRing.renderOrder=20;TOWN.add(ACT.aimRing)}if(ACT.locked&&ACT.locked.alive){ACT.aimRing.visible=true;ACT.aimRing.position.set(ACT.locked.x,.08,ACT.locked.z);ACT.aimRing.rotation.z+=.025}else if(ACT.aimRing)ACT.aimRing.visible=false}
function beginCoreFight(e){const wk=(ACTIVE&&ACTIVE.eq&&ACTIVE.eq.weapon)||'sword',g=(ACTIVE&&ACTIVE.g)||'male';const sim=Core.create([{g,wk},{g:'male',wk:'sword'}]);const ox=me.pos.x,oz=me.pos.z,dx=e.x-ox,dz=e.z-oz;sim.f[0].x=0;sim.f[0].z=0;sim.f[0].yaw=me.yaw;sim.f[0].hp=(ACT.mode==='escort'?ACT.playerHealth:ACT.health);sim.f[0].sta=ACT.stamina;sim.f[1].x=dx;sim.f[1].z=dz;sim.f[1].yaw=Math.atan2(-dx,-dz);sim.f[1].hp=e.hp;return{sim,e,ox,oz,ai:0,oxLast:ox,ozLast:oz}}
function copyCorePose(f,dt){const c=me;if(f.wk&&f.wk!==c.wk)equip(c,f.wk);c.t=f.t;c.blocking=f.blocking;c.ci=f.ci;c.dur=f.dur;c.def={mv:f.mv};c.state={idle:'free',feint:'free',atk:'atk',dodge:'dodge',hit:'hit',swap:'swap',parried:'parried',stag:'stag',dead:'dead',glory:'free'}[f.state]||'free';c.sp=0;c.ph+=dt*c.G.cad*c.sp;poseUpdate(c,dt)}
function combatStep(dt){let e=ACT.locked&&ACT.locked.alive?ACT.locked:nearestEnemy(13);if(!e){ACT.combat=null;ACT.locked=null;return}if(ACT.locked&&!ACT.locked.alive)ACT.locked=null;if(!ACT.combat||ACT.combat.e!==e)ACT.combat=beginCoreFight(e);const C=ACT.combat,s=C.sim,a=s.f[0],b=s.f[1];
 // Re-anchor the duel simulation to the moving player while preserving the fighters' relative positions.
 const px=me.pos.x,pz=me.pos.z,ex=e.x,ez=e.z;a.x=0;a.z=0;b.x=ex-px;b.z=ez-pz;a.yaw=me.yaw;if(ACT.locked){me.yaw=Math.atan2(ex-px,ez-pz);a.yaw=me.yaw}b.yaw=Math.atan2(-b.x,-b.z);a.hp=(ACT.mode==='escort'?ACT.playerHealth:ACT.health);a.sta=ACT.stamina;b.hp=e.hp;
 const d=Math.hypot(b.x,b.z),ai={fwd:d>2.15?1:0,side:0,block:false,light:false,heavy:false,dodge:false,swap:false,feint:false,glory:false};C.ai-=dt;if(d<3.1&&C.ai<=0&&b.state==='idle'){if(Math.random()<.23)ai.heavy=true;else ai.light=true;C.ai=.85+Math.random()*.45}if(d<2.7&&a.state==='atk'&&Math.random()<.04)ai.block=true;
 const inp={fwd:0,side:0,block:ACT.heldBlock||ACT.input.block,light:ACT.input.light,heavy:ACT.input.heavy,dodge:ACT.input.dodge,swap:ACT.input.swap,feint:ACT.input.feint,glory:ACT.input.glory};ACT.input={light:false,heavy:false,block:false,dodge:false,swap:false,feint:false,glory:false};Core.step(s,[inp,ai]);
 me.pos.x=px+a.x;me.pos.z=pz+a.z;e.x=px+b.x;e.z=pz+b.z;e.root.position.set(e.x,0,e.z);e.root.rotation.y=b.yaw;e.hp=b.hp;if(ACT.mode==='escort')ACT.playerHealth=a.hp;else ACT.health=a.hp;ACT.stamina=a.sta;me.yaw=a.yaw;copyCorePose(a,dt);
 // Creature hit/attack reactions are animated on its procedural model.
 const attacking=b.state==='atk',stunned=b.state==='stag'||b.state==='hit';e.root.rotation.x=attacking?Math.sin(b.t*18)*.12:0;e.root.scale.set(1,stunned?.82:attacking?1.08:1,attacking?.88:1);if(b.state==='dead'||e.hp<=0){e.alive=false;TOWN.remove(e.root);if(ACT.locked===e)ACT.locked=null;ACT.combat=null;note('Creature defeated.');return}
 if(a.state==='dead'||(ACT.mode==='escort'?ACT.playerHealth:ACT.health)<=0){if(ACT.mode==='escort')ACT.playerHealth=0;else ACT.health=0;return}
}
function actAttack(heavy){if(!ACT.active)return;ACT.input[heavy?'heavy':'light']=true}
function actStep(dt){if(!ACT.active)return;ACT.elapsed+=dt;let living=liveEnemies();
 for(const e of living){if(ACT.mode==='escort'&&ACT.cart){const target=ACT.cart.root.position,dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz)||1;e.x+=dx/d*dt*(e.type==='bear'?1.35:2);e.z+=dz/d*dt*(e.type==='bear'?1.35:2);e.root.position.set(e.x,0,e.z);e.root.rotation.y=Math.atan2(dx,dz);e.attack-=dt;if(d<1.6&&e.attack<=0&&!(ACT.locked===e)){e.attack=1.1;ACT.health=Math.max(0,ACT.health-10)}}}
 if(ACT.mode==='waves'||ACT.mode==='escort'){const candidate=(ACT.locked&&ACT.locked.alive)?ACT.locked:nearestEnemy(ACT.mode==='waves'?13:8);if(candidate)combatStep(dt);targetMarker();living=liveEnemies()} else {targetMarker()}
 if(ACT.mode==='waves'){if(!living.length){if(ACT.wave>=8){const g=ACT.wave*22;clearAct();rewardActivity(g,ACT.wave*35,5,'beastWaves');actHud('<b>VICTORY</b><br>All eight waves cleared!');setTimeout(()=>actHud(''),5500);return}spawnWave()}if(ACT.health<=0){clearAct();actHud('<b>DEFEAT</b><br>Your team was overwhelmed.<br><button onclick="WORLD.returnTown()">Return to town</button>');return}actHud('<b>HUMANS VS BEASTS</b><br>Wave '+ACT.wave+' · Enemies '+living.length+'<br>Health '+Math.ceil(ACT.health)+'% · Stamina '+Math.ceil(ACT.stamina)+'%<br><small>TAB / AIM lock · J / left-click light · K / right-click heavy · L / Shift block · Space dodge · E swap · U feint · F combo</small>')}
 else if(ACT.mode==='escort'){const p=ACT.route[ACT.wp],c=ACT.cart.root.position,dx=p[0]-c.x,dz=p[1]-c.z,d=Math.hypot(dx,dz);if(d<.5){ACT.wp++;if(ACT.wp>=ACT.route.length){const mins=ACT.duration/60;clearAct();rewardActivity(45+mins*12,70+mins*12,6,'escortWins');actHud('<b>ESCORT SUCCESS</b><br>Merchant and cargo arrived safely.');setTimeout(()=>actHud(''),5500);return}}
 else{c.x+=dx/d*1.5*dt;c.z+=dz/d*1.5*dt;ACT.cart.merchant.position.set(c.x-1.5,0,c.z);ACT.cart.merchant.rotation.y=Math.atan2(dx,dz)}
 if(ACT.health<=0||ACT.playerHealth<=0||ACT.elapsed>=ACT.duration){clearAct();actHud('<b>ESCORT FAILED</b><br>The cart was lost or time ran out.<br><button onclick="WORLD.returnTown()">Return to town</button>');return}
 const hp=$('kdCartHp');if(hp)hp.textContent=Math.ceil(ACT.health)+'%';const line=ACT.ui.querySelector('small');if(line)line.textContent='Waypoint '+Math.min(ACT.wp+1,ACT.route.length)+'/'+ACT.route.length+' · '+Math.ceil(ACT.duration-ACT.elapsed)+'s · J / attack'}
}
const actKeys=e=>{if(!W.on||!ACT.active)return;if(e.code==='KeyJ'&&!e.repeat){e.preventDefault();actAttack(false)}if(e.code==='KeyK'&&!e.repeat){e.preventDefault();actAttack(true)}if(e.code==='Tab'){e.preventDefault();if(!e.repeat)toggleAim()}if(e.code==='KeyL'||e.code==='ShiftLeft')ACT.heldBlock=true;if(e.code==='Space'&&!e.repeat)ACT.input.dodge=true;if(e.code==='KeyU'&&!e.repeat)ACT.input.feint=true;if(e.code==='KeyF'&&!e.repeat)ACT.input.glory=true;if(e.code==='KeyE'&&!e.repeat)ACT.input.swap=true};
addEventListener('keydown',actKeys);addEventListener('keyup',e=>{if(e.code==='KeyL'||e.code==='ShiftLeft')ACT.heldBlock=false});
const actClick=e=>{if(!W.on||!ACT.active)return;if(e.button===0)actAttack(false);else if(e.button===2)actAttack(true);else if(e.button===1)toggleAim()};renderer.domElement.addEventListener('pointerdown',actClick);renderer.domElement.addEventListener('contextmenu',e=>{if(W.on&&ACT.active)e.preventDefault()});
let forestSign=null;

W.step=function(dt){const t=Date.now()/1000;let fx=0,sx=0;
 if(!dlg){fx=((K.KeyW||K.ArrowUp)?1:0)-((K.KeyS||K.ArrowDown)?1:0);sx=((K.KeyD||K.ArrowRight)?1:0)-((K.KeyA||K.ArrowLeft)?1:0);if(TCH.on){fx=TCH.fwd;sx=-TCH.side}}
 const l=Math.min(1,Math.hypot(fx,sx)),vl=Math.hypot(fx,sx),sn=Math.sin(camYaw),cs=Math.cos(camYaw),vx=-sn*fx-cs*sx,vz=cs*fx-sn*sx;   // W/S/A/D move relative to the fixed camera
 if(l>.05&&vl>0){me.pos.x+=vx/vl*WALK*l*dt;me.pos.z+=vz/vl*WALK*l*dt;collide(me.pos);me.yaw+=angD(me.yaw,Math.atan2(vx,vz))*Math.min(1,dt*12)}   // the knight faces the way it walks
 me.sp+=(l-me.sp)*Math.min(1,dt*10);me.time+=dt;me.ph+=dt*me.G.cad*me.sp;poseUpdate(me,dt);
 NPC.forEach(n=>npcStep(n,t,dt));
 const nw=performance.now();let nn=null,bd=3.4;NPC.forEach(n=>{const d=Math.hypot(n.c$.pos.x-me.pos.x,n.c$.pos.z-me.pos.z);if(d<bd){bd=d;nn=n}});near=nn;
 if(dlg&&(!near||near!==dlg.n))closeDlg();
 const pr=$('wPrompt'),atSign=!!(forestSign&&Math.hypot(me.pos.x-forestSign.x,me.pos.z-forestSign.z)<3.8),showPrompt=!dlg&&(atSign||!!near),pv=showPrompt?'block':'none';if(pr.style.display!=pv)pr.style.display=pv;if(showPrompt){const tx=atSign?'Open Escort Contracts'+(IS_T?'':' (E)'):'Interact: '+near.n+(IS_T?'':' (E)');if(pr.textContent!=tx)pr.textContent=tx;pr.onclick=atSign?openEscortMenu:interact}
 for(const[k,r]of remotes){if(!r.shown)continue;if(nw-r.seen>20000){r.c.J.root.visible=false;r.shown=0;continue}const c=r.c,dx=r.tx-c.pos.x,dz=r.tz-c.pos.z,f=1-Math.exp(-dt*9),v=Math.hypot(dx,dz)*9;
  c.pos.x+=dx*f;c.pos.z+=dz*f;c.yaw+=angD(c.yaw,r.ty)*Math.min(1,dt*12);c.sp+=(clamp(v/WALK,0,1)-c.sp)*Math.min(1,dt*10);if(c.sp<.04)c.sp=0;c.time+=dt;c.ph+=dt*c.G.cad*c.sp;poseUpdate(c,dt)}
 actStep(dt);sendMv(false);
 const tx=me.pos.x,tz=me.pos.z,cd=Math.cos(camPitch)*camDist;if(ACT.active&&ACT.locked&&ACT.locked.alive)camYaw+=angD(camYaw,me.yaw)*Math.min(1,dt*4);camGoal.set(tx+Math.sin(camYaw)*cd,1.5+Math.sin(camPitch)*camDist,tz-Math.cos(camYaw)*cd);camera.position.lerp(camGoal,1-Math.exp(-dt*9));if(ACT.active&&ACT.locked&&ACT.locked.alive)camera.lookAt((tx+ACT.locked.x)/2,1.15,(tz+ACT.locked.z)/2);else camera.lookAt(tx,1.25,tz+Math.sin(camPitch)*1.5);
 sun.position.set(tx+26,15,tz+14);sun.target.position.set(tx,0,tz);sun.target.updateMatrixWorld();
 const hs='<b>ONLINE WORLD</b> \u00b7 Town Square<br>Players here: '+(1+remotes.size)+' \u00b7 '+sNote+'<br>'+(IS_T?'Joystick move':'WASD move \u00b7 hold right mouse to turn camera \u00b7 wheel zoom \u00b7 E interact/exit arena \u00b7 Esc leave');if(hs!=hudS){hudS=hs;$('wHud').innerHTML=hs}}
/* ---------- Colosseum PvP (ranked 1v1, best of 3) ----------
   Matchmaking: Supabase Realtime presence queue. Fight: the existing host-authoritative combat (HostRoom/netAttach) over a WebRTC link that is
   signalled automatically through Supabase (no copy-paste codes). Rewards: only through the server function pvp_report (supabase/pvp_migration.sql). */
const PV={st:'idle',key:'',q:null,mc:null,pc:null,busy:0,room:null,match:'',opp:null,fin:0,seen:0,poll:0,tm:0,map:'colo',won:null,score:[0,0],reported:0,t0:0};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),rid=()=>(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36)),quid=()=>{try{return typeof USER!=='undefined'&&USER?String(USER.id||''):''}catch(e){return''}};
function pvPairs(list){const Ls=list.slice().sort((a,b)=>a.t-b.t||(a.k<b.k?-1:1)),used=new Set(),out=[];for(const a of Ls){if(used.has(a.k))continue;const b=Ls.find(x=>x.k!==a.k&&!used.has(x.k)&&x.u!==a.u);if(b){used.add(a.k);used.add(b.k);out.push([a,b])}}return out}   // same list => same pairs on every client; the earlier arrival hosts
function pvStatus(t,a){const e=$('wQt');if(e)e.textContent=t;const f=$('wQa');if(f)f.textContent=a||''}
function pvQuitQueue(){if(PV.q){try{PV.q.untrack()}catch(e){}try{SB.removeChannel(PV.q)}catch(e){}PV.q=null}}
function pvQuit(){if(PV.st!=='queue')return;clearTimeout(PV.tm);pvQuitQueue();if(PV.mc){try{SB.removeChannel(PV.mc)}catch(e){}PV.mc=null}try{PV.pc&&PV.pc.close()}catch(e){}PV.pc=null;PV.busy=0;PV.st='idle';const q=$('wQ');if(q)q.style.display='none'}
function pvFail(m){const wasQ=PV.st==='queue';if(wasQ)pvQuit();else if(PV.st==='match'&&!net){pvResultDone(m)}note(m)}
function pvpStart(){if(!CLOUD||!SB)return'Matchmaking needs the online server, which is not connected right now.';if(!window.RTCPeerConnection||typeof HostRoom!=='function')return'This browser cannot make direct connections.';
 if(PV.st==='queue')return'You are already registered. Wait in the arena: the announcer will call you when an opponent is found.';if(PV.st!=='idle')return'A match is already in progress.';
 PV.st='queue';PV.busy=0;PV.key=ACTIVE.id+'.'+Math.random().toString(36).slice(2,7);$('wQ').style.display='block';pvStatus('Registering...');
 try{const q=PV.q=SB.channel('kd-pvp-queue',{config:{presence:{key:PV.key},broadcast:{self:false}}});
  q.on('presence',{event:'sync'},qSync).on('broadcast',{event:'inv'},onInv).subscribe(async s=>{if(s==='SUBSCRIBED'){try{await q.track({t:Date.now(),u:quid(),c:ACTIVE.id,n:ACTIVE.name,l:ACTIVE.lv});pvStatus('Registered. Waiting for an opponent...')}catch(e){pvQuit();note('Could not register: '+e.message)}}else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){pvQuit();note('Matchmaking is unavailable right now.')}})}
 catch(e){pvQuit();return'Matchmaking failed: '+e.message}
 return'You are registered for a ranked 1v1 duel (best of 3). Stay in the arena: you will be called as soon as an opponent is found. Winners earn gold, XP and reputation; rewards are confirmed by the server.'}
function qSync(){if(PV.st!=='queue'||!PV.q)return;const st=PV.q.presenceState(),Ls=[];for(const k in st){const m=st[k]&&st[k][0];if(m&&typeof m.t==='number'&&m.c)Ls.push({k,t:m.t,u:String(m.u||''),c:String(m.c),n:String(m.n||'Knight').slice(0,16)})}
 if(!PV.busy)pvStatus('Waiting for an opponent... fighters registered: '+Ls.length);if(PV.busy)return;const pr=pvPairs(Ls).find(p=>p[0].k===PV.key||p[1].k===PV.key);if(pr&&pr[0].k===PV.key)hostInvite(pr[1])}
function pvAnn(a,b){pvStatus('Opponent found: connecting...','Cassius: "Citizens! '+a+' faces '+b+' in the arena!"')}
function pvRetry(){clearTimeout(PV.tm);if(PV.mc){try{SB.removeChannel(PV.mc)}catch(e){}PV.mc=null}try{PV.pc&&PV.pc.close()}catch(e){}PV.pc=null;PV.busy=0;PV.opp=null;setTimeout(qSync,1500)}
function hostInvite(b){PV.busy=1;PV.match=rid();PV.opp={c:b.c,n:b.n};const id=PV.match,mc=PV.mc=SB.channel('kd-pvp-m-'+id,{config:{broadcast:{self:false}}});
 mc.on('broadcast',{event:'rdy'},()=>hostOffer()).on('broadcast',{event:'ans'},m=>hostAnswer(m&&m.payload)).subscribe(s=>{if(s==='SUBSCRIBED')PV.q&&PV.q.send({type:'broadcast',event:'inv',payload:{to:b.k,m:id,c:ACTIVE.id,n:ACTIVE.name}})});
 PV.tm=setTimeout(()=>{if(PV.st==='queue'&&PV.busy&&!PV.pc)pvRetry()},9000)}
function onInv(m){const p=m&&m.payload;if(!p||p.to!==PV.key||PV.st!=='queue'||PV.busy||typeof p.m!=='string'||p.m.length<8||p.m.length>64)return;PV.busy=1;PV.match=p.m;PV.opp={c:String(p.c),n:String(p.n||'Knight').slice(0,16)};
 const mc=PV.mc=SB.channel('kd-pvp-m-'+p.m,{config:{broadcast:{self:false}}});mc.on('broadcast',{event:'off'},x=>guestAnswer(x&&x.payload)).subscribe(s=>{if(s==='SUBSCRIBED')mc.send({type:'broadcast',event:'rdy',payload:{}})});
 PV.tm=setTimeout(()=>{if(PV.st==='queue'&&!PV.pc)pvRetry()},12000)}
async function hostOffer(){if(PV.pc||PV.st!=='queue'||!PV.mc)return;pvAnn(ACTIVE.name,PV.opp.n);
 try{const pc=PV.pc=new RTCPeerConnection(ICE),dc=pc.createDataChannel('g');pvLink(pc,dc,true);await pc.setLocalDescription(await pc.createOffer());await gathered(pc);PV.mc.send({type:'broadcast',event:'off',payload:{o:b64e(pc.localDescription)}});
  clearTimeout(PV.tm);PV.tm=setTimeout(()=>pvFail('Could not connect to your opponent (their network blocks direct connections). Register again.'),20000)}catch(e){pvFail('Connection error: '+e.message)}}
async function hostAnswer(p){try{if(PV.pc&&p&&p.o)await PV.pc.setRemoteDescription(b64d(p.o))}catch(e){pvFail('Connection error: '+e.message)}}
async function guestAnswer(p){if(PV.pc||!p||!p.o||PV.st!=='queue'||!PV.mc)return;pvAnn(PV.opp.n,ACTIVE.name);
 try{const pc=PV.pc=new RTCPeerConnection(ICE);pvLink(pc,null,false);await pc.setRemoteDescription(b64d(p.o));await pc.setLocalDescription(await pc.createAnswer());await gathered(pc);PV.mc.send({type:'broadcast',event:'ans',payload:{o:b64e(pc.localDescription)}});
  clearTimeout(PV.tm);PV.tm=setTimeout(()=>pvFail('Could not connect to your opponent (their network blocks direct connections). Register again.'),20000)}catch(e){pvFail('Connection error: '+e.message)}}
function pvLink(pc,dc,host){
 if(host){dc.onopen=()=>{clearTimeout(PV.tm);const Rm=HostRoom();PV.room=Rm;const hws={readyState:1,onmessage:null,onclose:null,send:s=>Rm.recv(0,s),close:()=>{Rm.stop();try{pc.close()}catch(e){}}};
   Rm.p[0]={send:s=>hws.onmessage&&hws.onmessage({data:s})};Rm.p[1]={send:s=>dc.readyState=='open'&&dc.send(s)};dc.onmessage=e=>Rm.recv(1,e.data);
   const gone=()=>{if(Rm.dead)return;Rm.p[0].send('{"t":"left"}');Rm.stop()};dc.onclose=gone;pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(pc.connectionState))gone()};
   pvBegin();const me2=netAttach(hws);me2.open()}}
 else pc.ondatachannel=ev=>{const d=ev.channel,g={get readyState(){return d.readyState=='open'?1:0},onmessage:null,onclose:null,send:s=>d.send(s),close:()=>{try{pc.close()}catch(e){}}};
   d.onmessage=e=>g.onmessage&&g.onmessage({data:e.data});d.onclose=()=>g.onclose&&g.onclose();pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState))g.onclose&&g.onclose()};
   const go=()=>{clearTimeout(PV.tm);pvBegin();const me2=netAttach(g);me2.open()};if(d.readyState=='open')go();else d.onopen=go}}
function pvBegin(){if(PV.st==='match')return;PV.st='match';PV.fin=0;PV.seen=0;PV.won=null;PV.reported=0;PV.map=sel.map;sel.map='colo';wins[0]=wins[1]=0;pvQuitQueue();closeDlg();W.on=false;document.body.classList.remove('inworld');
 TOWN.visible=false;me.J.root.visible=false;NPC.forEach(n=>{if(n.c$)n.c$.root.visible=false});remotes.forEach(r=>r.c.J.root.visible=false);$('wPrompt').style.display=$('wQ').style.display='none';PV.t0=Date.now();clearInterval(PV.poll);PV.poll=setInterval(pvPoll,120)}
function pvPoll(){if(PV.st!=='match'||PV.fin)return;if(net)PV.seen=1;
 if(PV.seen&&net&&started&&(wins[0]>=2||wins[1]>=2)){PV.fin=1;PV.won=(wins[0]>=2?0:1)===ME;PV.score=[wins[ME],wins[1-ME]];try{PV.room&&PV.room.stop()}catch(e){}setTimeout(pvResult,2500)}   // stop the host's automatic next round: best of 3 is over
 else if(PV.seen&&!net){PV.fin=1;$('menu').style.display='none';const t=($('pst')&&$('pst').textContent)||'';PV.how=/surrender/i.test(t)?'surrender':'left';PV.won=/You surrendered/i.test(t)?false:/opponent surrendered/i.test(t)?true:null;PV.score=[wins[ME],wins[1-ME]];pvResult()}
 else if(!PV.seen&&Date.now()-PV.t0>25000){PV.fin=1;clearInterval(PV.poll);pvReturn();note('The match could not start.')}}
function pvResult(){clearInterval(PV.poll);PV.poll=0;const R=$('wRes');R.style.display='flex';$('wRh').textContent=PV.won===true?'VICTORY':PV.won===false?'DEFEAT':'MATCH ENDED';
 $('wRo').textContent=(ACTIVE.name)+'  vs  '+((PV.opp&&PV.opp.n)||'Opponent')+(PV.won===null?'':'   ·   rounds '+PV.score[0]+' – '+PV.score[1]);
 if(PV.won===null){$('wRs').textContent='Your opponent disconnected. No ranked result was recorded and no rewards were given.';return}$('wRs').textContent='Confirming the result with the server...';pvReport()}
function pvResultDone(m){$('wRs').textContent=m}
async function pvReport(){if(PV.reported)return;PV.reported=1;const c=ACTIVE;
 try{await flushAll();let r=null;for(let i=0;i<12;i++){const{data,error}=await SB.rpc('pvp_report',{p_match:PV.match,p_my:c.id,p_opp:PV.opp.c,p_winner:PV.won?c.id:PV.opp.c});if(error)throw error;r=data;if(!r||r.status!=='pending')break;$('wRs').textContent='Waiting for your opponent\'s report...';await sleep(2500)}
  if(r&&r.lv!==undefined&&(r.status==='ok'||r.status==='done'||r.status==='capped')){c.lv=r.lv;c.xp=r.xp;c.gold=r.gold;c.rep=r.rep;c.prog.pvpW=r.pvpW||0;c.prog.pvpL=r.pvpL||0;who()}
  const msg=!r?'No answer from the server. No rewards.':r.status==='ok'?'Rewards confirmed: +'+r.gain_gold+' gold, +'+r.gain_xp+' XP'+(r.gain_rep?', +'+r.gain_rep+' reputation':'')+'.  Record: '+r.pvpW+' wins / '+r.pvpL+' losses.':
   r.status==='done'?'This match was already rewarded.':r.status==='capped'?'Reward limit reached (anti-farming): no rewards for this match.':r.status==='disputed'?'The two reports did not match, so no rewards were given.':r.status==='pending'?'Your opponent\'s result was never confirmed. No rewards.':'The server refused the result: '+(r.msg||r.status);
  $('wRs').textContent=msg;if(!$('wRes').style.display||$('wRes').style.display==='none')note(msg)}
 catch(e){const m=(e&&e.message)||String(e);$('wRs').textContent=/pvp_report|function|schema cache|404/i.test(m)?'Ranked rewards are not enabled on the server yet: run supabase/pvp_migration.sql in the Supabase SQL Editor. No rewards were given.':'Could not confirm the result: '+m+'. No rewards were given.'}}
function pvReturn(){clearInterval(PV.poll);PV.poll=0;$('wRes').style.display='none';try{PV.room&&PV.room.stop()}catch(e){}if(net){try{netLeave('')}catch(e){}}$('menu').style.display='none';
 try{PV.pc&&PV.pc.close()}catch(e){}PV.pc=null;if(PV.mc){try{SB.removeChannel(PV.mc)}catch(e){}PV.mc=null}sel.map=PV.map;V.forEach(c=>scene.remove(c.J.root));AR.forEach(m=>{m.visible=false});
 ORIG.visible=COLO.visible=false;worldEnv();TOWN.visible=true;me.J.root.visible=true;NPC.forEach(n=>{if(n.c$)n.c$.root.visible=true});remotes.forEach(r=>{r.c.J.root.visible=!!r.shown});
 inArena=false;me.pos.set(AX,0,AZ-24);me.yaw=Math.PI;camYaw=0;lastS.x=1e9;PV.st='idle';PV.busy=0;PV.opp=null;document.body.classList.add('inworld');W.on=true}
function pvUI(){if($('wQ'))return;const st=document.createElement('style');st.textContent='#wQ{position:fixed;z-index:8;top:max(64px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:none;text-align:center;background:rgba(14,14,20,.9);border:1px solid var(--ac);border-radius:10px;padding:10px 16px;font-size:13px;max-width:92%}#wQ b{color:var(--ac);letter-spacing:.2em}#wQa{color:#e8d9a8;font-style:italic;margin-top:4px}'+
 '#wRes{position:fixed;inset:0;z-index:12;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6)}#wRc{background:rgba(14,14,20,.96);border:1px solid var(--ac);border-radius:12px;padding:22px 26px;min-width:min(420px,90%);text-align:center}#wRh{font-size:34px;letter-spacing:.25em;color:var(--ac);margin-bottom:6px}#wRo{opacity:.85;margin-bottom:10px}#wRs{min-height:44px;margin-bottom:14px}';document.head.appendChild(st);
 const q=document.createElement('div');q.id='wQ';q.innerHTML='<b>COLOSSEUM</b><div id="wQt"></div><div id="wQa"></div><button id="wQc">Leave the queue</button>';document.body.appendChild(q);$('wQc').onclick=()=>{pvQuit()};$('wQc').onmousedown=e=>e.preventDefault();
 const r=document.createElement('div');r.id='wRes';r.innerHTML='<div id="wRc"><div id="wRh"></div><div id="wRo"></div><div id="wRs"></div><button id="wRb">Return to town</button></div>';document.body.appendChild(r);$('wRb').onclick=pvReturn;$('wRb').onmousedown=e=>e.preventDefault()}
W.returnTown=function(){clearAct();inArena=false;me.pos.set(AX,0,AZ-24);camYaw=0};pvUI();ui();   // create the menu button + overlays at load (the button is what starts the world)
})();
