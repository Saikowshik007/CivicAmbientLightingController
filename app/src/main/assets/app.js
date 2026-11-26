const $=id=>document.getElementById(id);
const native=typeof window.Native?.postMessage==='function';
const defaults={colorA:0x28d9e8,colorB:0xa36cff,brightnessA:45,brightnessB:45,modeA:0,modeB:0,speed:3,flowMode:4,variant:0,flowSpeed:3,direction:0,power:true,linked:true,flow:false};
let state={...defaults},connection={ready:false,status:native?'Not connected':'Browser preview • Bluetooth is available in the Android app',devices:[],submitted:0},presets=[],looks=[],zone=0,page='color',scene=null,inputAction=null,toastTimer;
const clone=value=>JSON.parse(JSON.stringify(value));
const hex=value=>'#'+value.toString(16).padStart(6,'0').toUpperCase();
const palettes=[0x28d9e8,0x3978ff,0x9b65ff,0xf369c5,0xff506c,0xff973b,0xf5df7b,0xd3eddf,0xe9ecff];
const rgbEffects=[['Solid',0],['Gradient',1],['Breathe',2],['Strobe',3],['Automatic',4],['Rhythm',6]];
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function send(action){
 if(native){window.Native.postMessage(JSON.stringify(action));return;}
 if(action.type==='ready')return;
 if(action.type==='apply'){try{localStorage.setItem('ambient-preview-state',JSON.stringify(state));}catch{}toast('Preview updated • connect from the Android app to control lights');}
 else if(action.type==='scan'||action.type==='connect'){toast('Bluetooth is available in the Android head-unit app');}
 else if(action.type==='power')toast('Preview '+(state.power?'on':'off'));
 else if(action.type==='savePreset'){
  const old=presets.find(p=>p.name.toLowerCase()===action.name.toLowerCase());
  if(!old&&presets.length>=12){toast('Remove a saved look before adding another');return;}
  if(old)old.state=clone(action.state);else presets.push({id:crypto.randomUUID(),name:action.name,state:clone(action.state)});
  savePreviewPresets();renderLooks();toast('Look saved in this browser preview');
 }else if(action.type==='deletePreset'){presets=presets.filter(p=>p.id!==action.id);savePreviewPresets();renderLooks();}
}
function savePreviewPresets(){try{localStorage.setItem('ambient-preview-presets',JSON.stringify(presets));}catch{}}
function commit(){send({type:'apply',state:clone(state)});renderConnection();}
window.onNativeEvent=(type,data)=>{
 if(type==='initial'){state={...defaults,...data.state};presets=data.presets;looks=data.looks;connection=data.connection;render();}
 if(type==='connection'){const wasReady=connection.ready;connection=data;renderConnection();renderDevices();if(!wasReady&&data.ready){$('devices-dialog').close();toast('Controller connected. Apply your look when ready.');}}
 if(type==='presets'){presets=data;renderLooks();}
 if(type==='message')toast(data);
};
function setPage(value){page=value;for(const name of ['color','effects','looks']){$('panel-'+name).hidden=name!==value;document.querySelectorAll(`[data-page="${name}"]`).forEach(b=>b.classList.toggle('active',name===value));}$('panel-title').textContent={color:'Color & light',effects:'Lighting in motion',looks:'Make it your own'}[value];}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
document.querySelectorAll('[data-zone]').forEach(b=>b.onclick=()=>{state.linked=b.dataset.zone==='both';if(!state.linked)zone=Number(b.dataset.zone);render();});
$('zone-card-a').onclick=()=>{zone=0;state.linked=false;setPage('color');render();};
$('zone-card-b').onclick=()=>{zone=1;state.linked=false;setPage('color');render();};
const currentColor=()=>zone===0?state.colorA:state.colorB;
const currentLevel=()=>zone===0?state.brightnessA:state.brightnessB;
function setColor(color){if(state.linked||zone===0){state.colorA=color;state.modeA=0;}if(state.linked||zone===1){state.colorB=color;state.modeB=0;}state.flow=false;render();}
function render(){
 $('power').setAttribute('aria-pressed',String(state.power));
 document.querySelectorAll('[data-zone]').forEach(b=>b.classList.toggle('active',state.linked?b.dataset.zone==='both':b.dataset.zone===String(zone)));
 $('hex-value').textContent=state.linked&&state.colorA!==state.colorB?'TWO-TONE':hex(currentColor());$('color-chip').style.background=hex(currentColor());
 $('brightness').value=currentLevel();$('brightness-label').innerHTML=currentLevel()+'<span>%</span>';
 for(const [id,color,level] of [['a',state.colorA,state.brightnessA],['b',state.colorB,state.brightnessB]]){$('zone-dot-'+id).style.background=hex(color);$('zone-dot-'+id).style.boxShadow=`0 0 18px ${hex(color)}80`;$('zone-dot-'+id).style.opacity=state.power?'1':'.2';$('zone-level-'+id).textContent=state.power?level+'%':'Off';}
 document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.color)===currentColor()));
 document.querySelectorAll('[data-effect]').forEach(b=>b.classList.toggle('active',!state.flow&&Number(b.dataset.effect)===(zone===0?state.modeA:state.modeB)&&(!state.linked||state.modeA===state.modeB)));
 $('flow-mode').value=state.flow?String(state.flowMode):'';
 $('variant').replaceChildren();for(let i=0;i<(state.flowMode===10?2:6);i++){const option=new Option(String(i+1),String(i));$('variant').add(option);}$('variant').value=String(state.variant);$('variant').disabled=!state.flow;$('direction').value=String(state.direction);$('direction').disabled=!state.flow;
 $('speed').min=state.flow?'0':'1';$('speed').max='5';$('speed').value=state.flow?state.flowSpeed:state.speed;$('speed-label').textContent=$('speed').value;
 $('look-caption').textContent=!state.power?'Lighting preview is off.':state.flow?'Flow effect selected · colors previewed below.':'Two zones. One personal space.';
 drawWheel();scene?.update(state);renderConnection();renderLooks();
}
function renderConnection(){
 $('connect').classList.toggle('connected',!!connection.ready);$('connect').querySelector('span').textContent=connection.ready?'Controller connected':'Connect controller';
 $('transport-status').textContent=connection.status;
 $('command-state').textContent=connection.ready?'Connected. Changes are sent when you use a control.':'Settings are local until a controller is connected.';
 $('scan-status').textContent=connection.scanning?'Scanning for 10 seconds…':connection.status;
 $('scan').disabled=!!connection.scanning;$('disconnect').disabled=!connection.ready&&!connection.device;
 $('details-text').textContent=`${native?'Civic Ambient 0.2.0':'Browser preview'}\n${connection.status}\nDevice: ${connection.device||'None'}\nCommands submitted: ${connection.submitted||0}\nLast write: ${connection.lastWrite||'None'}\nLast notification: ${connection.lastNotification||'None'}\n\nService: FFC0 · Write: FFC1 · Notify: FFC2`;
}
for(const color of palettes){const b=document.createElement('button');b.className='swatch';b.dataset.color=String(color);b.style.background=hex(color);b.setAttribute('aria-label','Set color '+hex(color));b.onclick=()=>{setColor(color);commit();};$('palette').append(b);}
for(const [name,value] of rgbEffects){const b=document.createElement('button');b.dataset.effect=String(value);b.textContent=name;b.onclick=()=>{state.flow=false;if(state.linked||zone===0)state.modeA=value;if(state.linked||zone===1)state.modeB=value;render();commit();};$('rgb-effects').append(b);}
$('brightness').oninput=()=>{const level=Number($('brightness').value);if(state.linked||zone===0)state.brightnessA=level;if(state.linked||zone===1)state.brightnessB=level;render();};$('brightness').onchange=commit;
$('speed').oninput=()=>{if(state.flow)state.flowSpeed=Number($('speed').value);else state.speed=Number($('speed').value);$('speed-label').textContent=$('speed').value;};$('speed').onchange=commit;
$('flow-mode').onchange=()=>{if(!$('flow-mode').value)return;state.flow=true;state.flowMode=Number($('flow-mode').value);state.variant=0;render();commit();};
$('variant').onchange=()=>{state.variant=Number($('variant').value);commit();};$('direction').onchange=()=>{state.direction=Number($('direction').value);commit();};
$('power').onclick=()=>{state.power=!state.power;render();send({type:'power',on:state.power});};$('apply').onclick=commit;
function showInput(title,label,value,action){$('input-title').textContent=title;$('input-label').textContent=label;$('input-value').value=value;$('input-error').textContent='';inputAction=action;$('input-dialog').showModal();}
$('hex-edit').onclick=()=>showInput('Your exact color','RGB hex color, for example #28D9E8',hex(currentColor()),value=>{if(!/^#?[0-9a-f]{6}$/i.test(value))return 'Enter a six-digit RGB hex color.';setColor(parseInt(value.replace('#',''),16));commit();});
$('save-look').onclick=()=>showInput('Save this atmosphere','Name your look','',value=>{if(!value||value.length>32)return 'Use a name between 1 and 32 characters.';send({type:'savePreset',name:value,state:clone(state)});});
$('input-form').onsubmit=e=>{e.preventDefault();const error=inputAction?.($('input-value').value.trim());if(error){$('input-error').textContent=error;return;}$('input-dialog').close();};
function lookButton(look,custom){const button=document.createElement('button');button.className='look';const gradient=document.createElement('span');gradient.className='look-gradient';gradient.style.background=`linear-gradient(110deg,${hex(look.state.colorA)},${hex(look.state.colorB)})`;const name=document.createElement('span');name.textContent=look.name;button.append(gradient,name);button.onclick=()=>{state={...defaults,...clone(look.state)};render();$('look-caption').textContent=look.name+' · your selected atmosphere';commit();};return button;}
function renderLooks(){
 $('built-in-looks').replaceChildren(...looks.map(l=>lookButton(l,false)));
 $('saved-looks').replaceChildren();if(!presets.length){const p=document.createElement('p');p.className='subtle';p.textContent='Save a color combination to make it yours.';$('saved-looks').append(p);}
 for(const look of presets){const row=document.createElement('div');row.className='saved-look';const remove=document.createElement('button');remove.className='delete-look';remove.textContent='×';remove.setAttribute('aria-label','Delete '+look.name);remove.onclick=()=>send({type:'deletePreset',id:look.id});row.append(lookButton(look,true),remove);$('saved-looks').append(row);}
}
const deviceButtons=new Map();
function renderDevices(){
 const list=$('device-list');const present=new Set();
 for(const device of connection.devices||[]){present.add(device.address);let b=deviceButtons.get(device.address);if(!b){b=document.createElement('button');b.className='device';const title=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small'),arrow=document.createElement('span');title.append(name,detail);arrow.textContent='Connect ↗';b.append(title,arrow);b.onclick=()=>send({type:'connect',address:device.address});deviceButtons.set(device.address,b);list.append(b);}b.querySelector('strong').textContent=device.name;b.querySelector('small').textContent=`${device.address.slice(-8)} · ${device.rssi} dBm${device.advertisesLighting?' · lighting service advertised':''}`;}
 for(const [address,b] of deviceButtons)if(!present.has(address)){b.remove();deviceButtons.delete(address);}
}
function devicesDialog(){$('devices-dialog').showModal();renderConnection();renderDevices();}
$('connect').onclick=devicesDialog;$('device-nav').onclick=devicesDialog;$('scan').onclick=()=>send({type:'scan'});$('disconnect').onclick=()=>send({type:'disconnect'});
$('devices-dialog').addEventListener('close',()=>send({type:'stopScan'}));
$('details').onclick=()=>{$('details-dialog').showModal();renderConnection();};
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
function rgbToHsv(color){const r=(color>>16)/255,g=((color>>8)&255)/255,b=(color&255)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;}return [(h+360)%360,max===0?0:d/max,max];}
function hsvColor(h,s){const c=s,x=c*(1-Math.abs((h/60)%2-1)),m=1-c;let [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return (Math.round((r+m)*255)<<16)|(Math.round((g+m)*255)<<8)|Math.round((b+m)*255);}
function drawWheel(){const canvas=$('color-wheel'),ctx=canvas.getContext('2d'),size=canvas.width,c=size/2,r=c-12;ctx.clearRect(0,0,size,size);for(let h=0;h<360;h++){ctx.beginPath();ctx.moveTo(c,c);ctx.arc(c,c,r,(h-1)*Math.PI/180,(h+1)*Math.PI/180);ctx.closePath();ctx.fillStyle=`hsl(${h} 100% 50%)`;ctx.fill();}const gradient=ctx.createRadialGradient(c,c,0,c,c,r);gradient.addColorStop(0,'#fff');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(c,c,r,0,Math.PI*2);ctx.fill();const [h,s]=rgbToHsv(currentColor()),x=c+Math.cos(h*Math.PI/180)*s*r,y=c+Math.sin(h*Math.PI/180)*s*r;ctx.shadowColor='#0008';ctx.shadowBlur=5;ctx.lineWidth=4;ctx.strokeStyle='#fff';ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
let wheelDragging=false;
function wheelPoint(e){const rect=$('color-wheel').getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*320-160,y=(e.clientY-rect.top)/rect.height*320-160;setColor(hsvColor((Math.atan2(y,x)*180/Math.PI+360)%360,Math.min(1,Math.hypot(x,y)/148)));}
$('color-wheel').onpointerdown=e=>{wheelDragging=true;$('color-wheel').setPointerCapture(e.pointerId);wheelPoint(e);};$('color-wheel').onpointermove=e=>{if(wheelDragging)wheelPoint(e);};$('color-wheel').onpointerup=()=>{if(wheelDragging){wheelDragging=false;commit();}};$('color-wheel').onpointercancel=()=>{wheelDragging=false;};
$('view-cabin').onclick=()=>{scene?.setView('cabin');$('view-cabin').classList.add('selected');$('view-exterior').classList.remove('selected');};$('view-exterior').onclick=()=>{scene?.setView('exterior');$('view-exterior').classList.add('selected');$('view-cabin').classList.remove('selected');};$('reset-view').onclick=()=>scene?.reset();
if(!native){
 try{state={...defaults,...JSON.parse(localStorage.getItem('ambient-preview-state')||'{}')};presets=JSON.parse(localStorage.getItem('ambient-preview-presets')||'[]');}catch{}
 const names=['Glacier','Violet hour','Ember','Ocean','Rose','Clean white'],colors=[[0x28d9e8,0x3978ff],[0x9755ff,0xf05ca8],[0xff7a30,0xffbd69],[0x126bff,0x28d9e8],[0xff4c84,0xff97b2],[0xffead2,0xffead2]];looks=names.map((name,i)=>({name,state:{...defaults,colorA:colors[i][0],colorB:colors[i][1],linked:false}}));
}
render();send({type:'ready'});
import('./scene.js').then(module=>{scene=module.createScene($('scene'));scene.update(state);}).catch(error=>{$('scene-fallback').hidden=false;console.warn('3D preview unavailable',error);});
