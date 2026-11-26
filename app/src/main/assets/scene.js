import * as THREE from './vendor/three.module.min.js';

/** Original procedural sedan / cabin illustration. No OEM vehicle asset or logo. */
export function createScene(container){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,80);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;
 container.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Rotate the 3D cabin preview');
 scene.add(new THREE.HemisphereLight(0xc5ccff,0x20212d,3));
 const key=new THREE.DirectionalLight(0xd0dcff,4);key.position.set(-3,7,2);scene.add(key);
 const fill=new THREE.DirectionalLight(0x9183c9,2.2);fill.position.set(4,3,-4);scene.add(fill);
 const car=new THREE.Group();car.rotation.y=-.12;scene.add(car);
 const paint=new THREE.MeshPhysicalMaterial({color:0x505864,metalness:.78,roughness:.32,clearcoat:1,clearcoatRoughness:.2});
 const dark=new THREE.MeshStandardMaterial({color:0x151720,roughness:.72}),leather=new THREE.MeshStandardMaterial({color:0x3d3a46,roughness:.8}),seatCenter=new THREE.MeshStandardMaterial({color:0x55515a,roughness:.9}),trim=new THREE.MeshStandardMaterial({color:0x626a76,metalness:.65,roughness:.4}),glass=new THREE.MeshPhysicalMaterial({color:0x4a6072,metalness:.6,roughness:.14,transparent:true,opacity:.42,side:THREE.DoubleSide});
 const softGeometry=new Map();
 function paddedBox(w,h,d){
  const id=[w,h,d].join(':');if(softGeometry.has(id))return softGeometry.get(id);
  const radius=Math.min(.065,w*.2,h*.2,d*.2),shape=new THREE.Shape(),hw=w/2-radius,hh=h/2-radius;
  shape.moveTo(-hw,-h/2);shape.lineTo(hw,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-hh);shape.lineTo(w/2,hh);shape.quadraticCurveTo(w/2,h/2,hw,h/2);shape.lineTo(-hw,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,hh);shape.lineTo(-w/2,-hh);shape.quadraticCurveTo(-w/2,-h/2,-hw,-h/2);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.002,d-radius),bevelEnabled:true,bevelThickness:radius/2,bevelSize:radius/3,bevelSegments:3,steps:1,curveSegments:5});geometry.translate(0,0,-d/2+radius/2);softGeometry.set(id,geometry);return geometry;
 }
 function box(w,h,d,x,y,z,material=dark,parent=car){const geometry=material===leather||material===seatCenter?paddedBox(w,h,d):new THREE.BoxGeometry(w,h,d);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
 function cylinder(radius,length,x,y,z,material,parent=car){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,32),material);m.position.set(x,y,z);parent.add(m);return m;}
 function pipe(points,radius,material,parent=car){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,40,radius,7,false),material);parent.add(mesh);return mesh;}
 // Beveled cross-sections give the body a continuous sedan silhouette.
 const sections=[[-2.72,.85,.49],[-2.35,1.04,.69],[-1.5,1.14,.82],[.4,1.15,.82],[1.8,1.1,.75],[2.55,.94,.63],[2.7,.8,.5]],verts=[],indices=[];
 sections.forEach(([z,w,top])=>{const ring=[[-w+.15,.25],[-w,.4],[-w,top-.1],[-w+.14,top],[w-.14,top],[w,top-.1],[w,.4],[w-.15,.25]];ring.forEach(([x,y])=>verts.push(x,y,z));});
 for(let s=0;s<sections.length-1;s++)for(let p=0;p<8;p++){const a=s*8+p,b=s*8+(p+1)%8,c=(s+1)*8+p,d=(s+1)*8+(p+1)%8;indices.push(a,c,b,b,c,d);}
 for(const end of [0,sections.length-1])for(let i=1;i<7;i++){const a=end*8;indices.push(a,a+(end===0?i+1:i),a+(end===0?i:i+1));}
 const bodyGeometry=new THREE.BufferGeometry();bodyGeometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));bodyGeometry.setIndex(indices);bodyGeometry.computeVertexNormals();car.add(new THREE.Mesh(bodyGeometry,paint));
 box(1.9,.08,1.15,0,.79,-1.96,paint);box(1.82,.08,.7,0,.71,2.16,paint);
 box(1.98,.05,3.2,0,.84,.15,dark);
 const rubber=new THREE.MeshStandardMaterial({color:0x101115,roughness:.94}),wheelMetal=new THREE.MeshStandardMaterial({color:0x727b8b,metalness:.85,roughness:.32});
 for(const x of [-1.12,1.12])for(const z of [-1.65,1.6]){
  const tyre=cylinder(.43,.22,x,.4,z,rubber);tyre.rotation.z=Math.PI/2;
  const rim=cylinder(.29,.24,x,.4,z,wheelMetal);rim.rotation.z=Math.PI/2;
  const hub=cylinder(.12,.25,x,.4,z,dark);hub.rotation.z=Math.PI/2;
  for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;const spoke=box(.25,.035,.055,x,.4+Math.cos(angle)*.16,z+Math.sin(angle)*.16,dark);spoke.rotation.x=angle;}
 }
 const frontLed=new THREE.MeshBasicMaterial({color:0xcce4ff}),rearLed=new THREE.MeshBasicMaterial({color:0xff3a48});
 for(const x of [-.62,.62]){pipe([[x-.2,.64,-2.65],[x,.67,-2.7],[x+.2,.64,-2.65]],.022,frontLed);pipe([[x-.19,.62,2.62],[x,.65,2.68],[x+.19,.62,2.62]],.025,rearLed);}
 box(1.24,.13,.035,0,.38,-2.72,dark);box(.6,.045,.06,0,.27,2.65,trim);
 // Open cabin: door panels, dashboard, seats, center console and instrument display.
 for(const x of [-1.015,1.015]){box(.13,.32,2.95,x,1.0,.05,leather);box(.15,.07,.6,x*.97,1.1,-.2,dark);box(.16,.07,.6,x*.97,1.1,1.15,dark);}
 box(1.9,.24,.42,0,1.01,-1.28,dark);box(1.87,.035,.31,0,1.16,-1.25,leather);
 const screen=box(.78,.28,.045,.17,1.35,-1.25,new THREE.MeshPhysicalMaterial({color:0x070d19,metalness:.35,roughness:.2}));screen.rotation.x=-.12;
 const uiBlue=new THREE.MeshBasicMaterial({color:0x659fc0});box(.47,.009,.006,.16,1.37,-1.222,uiBlue);box(.23,.009,.006,.04,1.31,-1.222,uiBlue);
 const cluster=box(.5,.2,.09,-.56,1.29,-1.18,dark);cluster.rotation.x=-.13;
 const steering=new THREE.Mesh(new THREE.TorusGeometry(.205,.022,8,40),dark);steering.position.set(-.55,1.29,-.8);steering.rotation.x=-.5;car.add(steering);box(.23,.04,.045,-.55,1.29,-.8,trim);
 box(.32,.23,2.15,0,.98,.2,dark);box(.28,.04,.4,0,1.115,-.5,trim);box(.11,.08,.14,0,1.16,-.55,dark);
 for(const z of [.04,.3]){const holder=new THREE.Mesh(new THREE.TorusGeometry(.079,.012,6,28),trim);holder.rotation.x=Math.PI/2;holder.position.set(0,1.11,z);car.add(holder);}
 function seat(x,z,back=false){
  box(.73,.15,.66,x,1.0,z,leather);box(.53,.025,.48,x,1.085,z,seatCenter);
  const backrest=box(.72,.61,.16,x,1.35,z+.28,leather);backrest.rotation.x=-.12;
  const center=box(.51,.45,.025,x,1.36,z+.185,seatCenter);center.rotation.x=-.12;
  box(.38,.2,.15,x,1.79,z+.34,leather);
  for(const side of [-1,1]){box(.065,.14,.55,x+side*.31,1.1,z,leather);const bolster=box(.08,.47,.18,x+side*.3,1.35,z+.24,leather);bolster.rotation.x=-.12;}
  for(let i=0;i<4;i++)box(.4,.006,.008,x,1.101,z-.15+i*.09,trim);
 }
 for(const x of [-.55,.55]){seat(x,-.34);seat(x,1.1,true);}
 box(1.68,.055,.32,0,1.17,1.95,leather);
 // Separate emitter groups preserve the controller's two logical zones.
 const emitterA=new THREE.MeshBasicMaterial({color:0x28d9e8}),emitterB=new THREE.MeshBasicMaterial({color:0xa36cff});
 const glowA=new THREE.MeshBasicMaterial({color:0x28d9e8,transparent:true,opacity:.11,depthWrite:false,blending:THREE.AdditiveBlending});
 const glowB=glowA.clone();glowB.color.setHex(0xa36cff);
 function lightStrip(points,material,glow){pipe(points,.018,material);pipe(points,.055,glow);}
 lightStrip([[-.94,1.19,-1.02],[-.55,1.2,-1.08],[.2,1.2,-1.08],[.91,1.19,-1.02]],emitterA,glowA);
 for(const x of [-.94,.94]){
  lightStrip([[x,1.13,-1.03],[x,1.15,-.65],[x,1.13,.36]],emitterA,glowA);
  lightStrip([[x,1.13,.58],[x,1.15,1.02],[x,1.12,1.76]],emitterB,glowB);
 }
 lightStrip([[-.19,1.1,-.86],[-.2,1.11,-.2],[-.2,1.1,.55]],emitterA,glowA);
 lightStrip([[.19,1.1,-.86],[.2,1.11,-.2],[.2,1.1,.55]],emitterA,glowA);
 lightStrip([[-.79,1.21,1.93],[0,1.22,1.94],[.79,1.21,1.93]],emitterB,glowB);
 const footA=new THREE.PointLight(0x28d9e8,2.3,2,.8);footA.position.set(0,1.4,-.72);car.add(footA);
 const footB=new THREE.PointLight(0xa36cff,2.3,2,.8);footB.position.set(0,1.4,1);car.add(footB);
 // Roof and glazing are optional so the interior remains visible in cabin view.
 const exterior=new THREE.Group();car.add(exterior);
 box(1.66,.08,2.35,0,2.02,.16,paint,exterior);
 for(const x of [-.9,.9]){
  pipe([[x,1.0,-1.36],[x*.91,1.99,-.95],[x*.91,2.02,1.13],[x,1.0,1.86]],.045,paint,exterior);
  pipe([[x,1.03,.25],[x*.92,2.01,.25]],.04,paint,exterior);
 }
 const windshield=box(1.68,.02,1.0,0,1.56,-1.16,glass,exterior);windshield.rotation.x=-.83;
 const backWindow=box(1.61,.02,.93,0,1.55,1.5,glass,exterior);backWindow.rotation.x=.84;
 exterior.visible=false;
 const ground=new THREE.Mesh(new THREE.CircleGeometry(4.7,80),new THREE.MeshBasicMaterial({color:0x11131d,transparent:true,opacity:.48}));ground.rotation.x=-Math.PI/2;ground.position.y=.015;scene.add(ground);
 const grid=new THREE.GridHelper(14,28,0x4a455f,0x292c3b);grid.material.transparent=true;grid.material.opacity=.2;grid.position.y=-.01;scene.add(grid);
 const ring=new THREE.Mesh(new THREE.RingGeometry(3.5,3.51,100),new THREE.MeshBasicMaterial({color:0x655e86,transparent:true,opacity:.25,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.02;scene.add(ring);
 let theta=.72,phi=.85,distance=8.5,drag=false,lastX=0,lastY=0,mode='cabin';
 const target=new THREE.Vector3(0,.86,0);
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});
 renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;theta-=(e.clientX-lastX)*.008;phi=Math.max(.3,Math.min(1.2,phi+(e.clientY-lastY)*.006));lastX=e.clientX;lastY=e.clientY;});
 renderer.domElement.addEventListener('pointerup',()=>drag=false);renderer.domElement.addEventListener('pointercancel',()=>drag=false);
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(6.5,Math.min(12,distance+e.deltaY*.005));},{passive:false});
 let visible=true;document.addEventListener('visibilitychange',()=>visible=!document.hidden);
 let frame;function animate(){frame=requestAnimationFrame(animate);if(!visible)return;camera.position.set(Math.sin(theta)*Math.sin(phi)*distance,Math.cos(phi)*distance+target.y,Math.cos(theta)*Math.sin(phi)*distance);camera.lookAt(target);renderer.render(scene,camera);}animate();
 return {
  update(state){const a=new THREE.Color(state.colorA),b=new THREE.Color(state.colorB),levelA=state.power?state.brightnessA/100:0,levelB=state.power?state.brightnessB/100:0;emitterA.color.copy(a).multiplyScalar(.04+levelA*1.6);emitterB.color.copy(b).multiplyScalar(.04+levelB*1.6);glowA.color.copy(a);glowB.color.copy(b);glowA.opacity=.18*levelA;glowB.opacity=.18*levelB;footA.color.copy(a);footB.color.copy(b);footA.intensity=4*levelA;footB.intensity=4*levelB;},
  setView(view){mode=view;exterior.visible=view==='exterior';phi=view==='exterior'?1.1:.85;distance=view==='exterior'?9:8.5;theta=.72;},
  reset(){theta=.72;phi=mode==='exterior'?1.1:.85;distance=mode==='exterior'?9:8.5;},
  dispose(){cancelAnimationFrame(frame);observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();}
 };
}
