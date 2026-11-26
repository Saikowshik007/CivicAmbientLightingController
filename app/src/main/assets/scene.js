import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

/** CC-BY Civic mesh by Ricy; see models/CIVIC-LICENSE.txt. Lighting overlays are illustrative. */
export async function createScene(container){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,60);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.setClearColor(0,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.localClippingEnabled=true;
 renderer.domElement.setAttribute('aria-label','Rotate the Civic cabin lighting preview');
 // Load before mounting the canvas so failed assets leave a clean fallback.
 let gltf;try{gltf=await new GLTFLoader().loadAsync(new URL('./models/civic-2022.glb',import.meta.url).href);}catch(error){renderer.dispose();throw error;}
 container.append(renderer.domElement);
 const studio=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.04);scene.environment=environment.texture;scene.environmentIntensity=.65;studio.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xdbe6ff,0x11141c,2.5));
 const key=new THREE.DirectionalLight(0xf5f3ff,3.0);key.position.set(-4,7,-2);scene.add(key);
 const fill=new THREE.DirectionalLight(0xa8bada,1.8);fill.position.set(4,4,3);scene.add(fill);
 const vehicle=new THREE.Group();scene.add(vehicle);const model=gltf.scene;model.scale.setScalar(3.5);model.rotation.y=Math.PI;model.position.y=-.4;vehicle.add(model);
 const roofNames=/^(roof_|inroof_|fwind_|sidegls_|rglass_|fwindshielfside_|Box003_)/;
 const bodyNames=/^(body_|fdoor_|rdoor_|sideplastic_)/;
 const cutPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),1.05),surfaces=[];
 model.traverse(object=>{
  if(!object.isMesh)return;
  object.material=object.material.clone();const mat=object.material;
  const interior=/^(interior|indoor|rearseats|seat_|seat001_|headrest)/.test(object.name);
  if(interior){mat.vertexColors=false;mat.color.setHex(/seat|headrest/.test(object.name)?0x292d35:0x242b36);mat.roughness=.8;}
  if(object.name.includes('Carpaint_Flakes')||mat.name==='Carpaint_Flakes_Blue'){mat.vertexColors=false;mat.color.setHex(0xaa0614);mat.metalness=.12;mat.roughness=.26;}
  surfaces.push({object,roof:roofNames.test(object.name),body:bodyNames.test(object.name)});
 });
 const overlays=new THREE.Group();vehicle.add(overlays);const emitters=[],pools=[];
 // Coordinates match this asset's native space (front +Z), transformed with the model.
 const at=(x,y,z)=>new THREE.Vector3(-x*3.5,y*3.5-.4,-z*3.5);
 function pipe(points,radius,material){const c=new THREE.CatmullRomCurve3(points.map(p=>at(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(c,36,radius,8,false),material);overlays.add(mesh);return mesh;}
 function strip(points,category,group){
  const core=new THREE.MeshBasicMaterial(),halo=new THREE.MeshBasicMaterial({transparent:true,opacity:.15,depthWrite:false,blending:THREE.AdditiveBlending});
  pipe(points,.008,core);pipe(points,.028,halo);emitters.push({core,halo,category,group});
 }
 strip([[-.299,.379,.289],[-.12,.380,.286],[.12,.380,.286],[.299,.379,.289]],'dash','a');
 for(const x of [-.302,.302]){
  strip([[x,.376,.278],[x,.374,.19],[x,.352,-.045]],'doors','a');
  strip([[x,.352,-.105],[x,.369,-.25],[x,.367,-.441]],'doors','a');
  for(const z of [.10,-.30]){
   strip([[x*.96,.337,z-.027],[x*.96,.339,z],[x*.96,.337,z+.027]],'handles','b');
   strip([[x*.96,.222,z-.105],[x*.97,.216,z-.02],[x*.96,.222,z+.095]],'storage','b');
  }
 }
 const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;
 const ctx=glowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,0,64,64,64);
 gradient.addColorStop(0,'#ffffffdd');gradient.addColorStop(.35,'#ffffff88');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const poolTexture=new THREE.CanvasTexture(glowCanvas);
 for(const x of [-.18,.18])for(const z of [.19,-.27]){
  const mat=new THREE.MeshBasicMaterial({map:poolTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.69,.66),mat);mesh.rotation.x=-Math.PI/2;mesh.position.copy(at(x,.19,z));overlays.add(mesh);pools.push(mat);
  strip([[x-.04,.205,z+.05],[x+.04,.205,z+.05]],'footwells','b');
 }
 const footLight=new THREE.PointLight(0xa36cff,1.5,4,1.5);footLight.position.copy(at(0,.31,.1));overlays.add(footLight);
 const ground=new THREE.Mesh(new THREE.CircleGeometry(4.5,80),new THREE.MeshBasicMaterial({color:0x10151e,transparent:true,opacity:.65}));ground.rotation.x=-Math.PI/2;ground.position.y=-.20;scene.add(ground);
 const anchors={dash:['DASH LINE',[0,.40,.29]],doors:['DOOR LINES',[-.305,.4,-.25]],handles:['HANDLES',[.29,.37,.1]],storage:['DOOR STORAGE',[-.29,.25,.10]],footwells:['FOOTWELLS',[.18,.22,.19]]};
 const label=document.createElement('div');label.className='scene-location';label.hidden=true;container.append(label);
 let focus='all',lastState=null,view='cabin',theta=.95,phi=.61,distance=7.9,drag=false,lastX=0,lastY=0;
 const target=new THREE.Vector3(0,.63,.30);
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});
 renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;theta-=(e.clientX-lastX)*.006;phi=Math.max(.08,Math.min(1.3,phi+(e.clientY-lastY)*.005));lastX=e.clientX;lastY=e.clientY;});
 renderer.domElement.addEventListener('pointerup',()=>drag=false);renderer.domElement.addEventListener('pointercancel',()=>drag=false);
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(5.4,Math.min(15,distance+e.deltaY*.005));},{passive:false});
 function update(state){lastState=state;
  for(const e of emitters){const color=new THREE.Color(e.group==='a'?state.colorA:state.colorB),level=state.power?(e.group==='a'?state.brightnessA:state.brightnessB)/100:0,amount=level*(focus==='all'||focus===e.category?1:.08);e.core.color.copy(color).multiplyScalar(.01+amount*2);e.halo.color.copy(color);e.halo.opacity=.26*amount;}
  const amount=(state.power?state.brightnessB/100:0)*(focus==='all'||focus==='footwells'?1:.08);
  for(const p of pools){p.color.setHex(state.colorB);p.opacity=.85*amount;}footLight.color.setHex(state.colorB);footLight.intensity=2*amount;
 }
 function reset(){theta=view==='plan'?0:view==='exterior'?-2.35:.95;phi=view==='plan'?.08:view==='exterior'?1.15:.61;distance=view==='exterior'?11.7:view==='plan'?9.7:7.9;}
 function setView(value){view=value;const exterior=value==='exterior';for(const s of surfaces){s.object.visible=exterior||!s.roof;s.object.material.clippingPlanes=!exterior&&s.body?[cutPlane]:[];}overlays.visible=!exterior;label.hidden=exterior||focus==='all';reset();}
 setView('cabin');let visible=true;document.addEventListener('visibilitychange',()=>visible=!document.hidden);
 let frame;function animate(){frame=requestAnimationFrame(animate);if(!visible)return;const fit=Math.max(1,1.1/camera.aspect);camera.position.set(Math.sin(theta)*Math.sin(phi)*distance*fit,Math.cos(phi)*distance*fit+target.y,Math.cos(theta)*Math.sin(phi)*distance*fit);camera.lookAt(target);renderer.render(scene,camera);
  if(focus!=='all'&&view!=='exterior'){const p=at(...anchors[focus][1]).project(camera);label.style.left=(p.x*.5+.5)*100+'%';label.style.top=(-p.y*.5+.5)*100+'%';}
 }animate();
 return {update,setFocus(value){focus=Object.hasOwn(anchors,value)?value:'all';if(view==='exterior')setView('cabin');label.hidden=focus==='all';label.textContent=anchors[focus]?.[0]||'';if(lastState)update(lastState);},setView,reset,dispose(){cancelAnimationFrame(frame);observer.disconnect();label.remove();poolTexture.dispose();environment.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}});renderer.dispose();}};
}
