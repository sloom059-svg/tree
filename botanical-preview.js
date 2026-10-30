/* Preview reads the same in-memory authorized records as the main tree. No database writes. */
(()=>{
'use strict';
const button=document.getElementById('familyDesignButton'),dialog=document.getElementById('familyDesignDialog');
if(!button||!dialog)return;
const sheet=document.getElementById('designSheet'),viewport=document.getElementById('designViewport'),status=document.getElementById('designStatus'),download=document.getElementById('designDownload'),busy=document.getElementById('designBusy');
let prepared=null,signature='',generation=0,exporting=false,fontPromise=null,frame=0,view={x:0,y:0,scale:1},previousFocus=null,cancelLayout=null,readyUrl=null;
const pointers=new Map();let pinch=null;
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
function snapshot(){return people.filter(p=>!p.deleted_at).map(p=>({id:p.id,name:p.name,parent_id:p.parent_id,sort_order:p.sort_order}));}
function paint(){sheet.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.scale})`;document.getElementById('designZoom').textContent=Math.round(view.scale*100)+'%';}
function fit(){if(!prepared)return;const{width,height}=prepared.layout;view.scale=Math.min((viewport.clientWidth-32)/width,(viewport.clientHeight-32)/height,1);view.x=(viewport.clientWidth-width*view.scale)/2;view.y=(viewport.clientHeight-height*view.scale)/2;paint();}
function zoom(factor,x=viewport.clientWidth/2,y=viewport.clientHeight/2){if(!prepared)return;const next=Math.min(3,Math.max(.01,view.scale*factor)),ratio=next/view.scale;view={x:x-(x-view.x)*ratio,y:y-(y-view.y)*ratio,scale:next};paint();}
function font(){
 if(!fontPromise)fontPromise=(async()=>{
  const response=await fetch(new URL('assets/noto-naskh-arabic-bold.ttf',document.baseURI));if(!response.ok)throw Error('تعذر تحميل خط التصميم. تحقق من الاتصال وأعد المحاولة.');
  const buffer=await response.arrayBuffer(),bytes=new Uint8Array(buffer);let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const base64=btoa(binary),face=new FontFace('FamilyNaskh',buffer,{weight:'700'});await face.load();document.fonts.add(face);return base64;
 })().catch(error=>{fontPromise=null;throw error;});
 return fontPromise;
}
function draw(records){
 if(typeof Worker==='undefined')return Promise.resolve(window.FamilyBotanical.svg(records,window.FamilyBotanicalTheme));
 cancelLayout?.();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('botanical-worker.js',document.baseURI));
  const finish=()=>{worker.terminate();cancelLayout=null;};
  cancelLayout=()=>{finish();reject(Error('أُغلقت المعاينة.'));};
  worker.onmessage=e=>{finish();e.data.error?reject(Error(e.data.error)):resolve(e.data);};
  worker.onerror=()=>{finish();reject(Error('تعذر تجهيز التصميم. حدّث الصفحة وحاول مرة أخرى.'));};
  worker.postMessage(records);
 });
}
function clearDownload(){if(readyUrl){URL.revokeObjectURL(readyUrl);readyUrl=null;}const link=document.getElementById('designReadyPdf');link.hidden=true;link.removeAttribute('href');}
async function update(force=false){
 const records=snapshot(),next=JSON.stringify(records);if(!force&&next===signature)return;
 const revision=++generation;clearDownload();download.disabled=true;busy.hidden=false;message('جارٍ ترتيب الفروع وتجهيز المعاينة…');
 try{
  await font();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(revision!==generation||!dialog.open)return;
  const result=await draw(records);
  if(revision!==generation||!dialog.open)return;
  const parsed=new DOMParser().parseFromString(result.svg,'image/svg+xml');if(parsed.querySelector('parsererror'))throw Error('تعذر رسم التصميم.');
  const svg=document.importNode(parsed.documentElement,true);sheet.replaceChildren(svg);prepared=result;signature=next;
  sheet.style.width=result.layout.width+'px';sheet.style.height=result.layout.height+'px';fit();
  download.disabled=exporting;message(`${result.layout.nodes.length.toLocaleString('ar-SA')} اسمًا · اسحب للتحريك وكبّر لقراءة الأسماء`);
 }catch(error){if(revision!==generation)return;prepared=null;signature='';sheet.replaceChildren();download.disabled=true;message(error.message||'تعذر تجهيز التصميم.',true);}
 finally{if(revision===generation)busy.hidden=true;}
}
button.addEventListener('click',()=>{
 if(!people.length){showMessage('افتح الشجرة المحفوظة أولًا لعرض تصميمها.');return;}
 previousFocus=document.activeElement;button.closest('details')?.removeAttribute('open');dialog.showModal();update(true);
});
document.getElementById('designClose').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{generation++;cancelLayout?.();clearDownload();prepared=null;signature='';sheet.replaceChildren();pointers.clear();pinch=null;busy.hidden=true;previousFocus?.focus();});
window.addEventListener('tree:render',event=>{if(!dialog.open)return;if(!event.detail.hasAccess||!people.length){dialog.close();return;}cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>update());});
document.getElementById('designZoomIn').onclick=()=>zoom(1.25);
document.getElementById('designZoomOut').onclick=()=>zoom(.8);
document.getElementById('designFit').onclick=fit;
new ResizeObserver(()=>{if(dialog.open)fit();}).observe(viewport);
viewport.addEventListener('wheel',e=>{e.preventDefault();const rect=viewport.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.002),e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
function geometry(){const[a,b]=[...pointers.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)};}
viewport.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);pinch=pointers.size===2?geometry():null;});
viewport.addEventListener('pointermove',e=>{
 const prior=pointers.get(e.pointerId);if(!prior)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size>=2){const g=geometry(),rect=viewport.getBoundingClientRect();if(pinch&&pinch.d>0){view.x+=g.x-pinch.x;view.y+=g.y-pinch.y;zoom(g.d/pinch.d,g.x-rect.left,g.y-rect.top);}pinch=g;}
 else{view.x+=e.clientX-prior.x;view.y+=e.clientY-prior.y;paint();}
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,e=>{pointers.delete(e.pointerId);pinch=null;});
viewport.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.25);}else if(e.key==='-'){e.preventDefault();zoom(.8);}else if(e.key==='0'){e.preventDefault();fit();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();view.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;view.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;paint();}});
download.onclick=async()=>{
 if(!prepared||exporting)return;exporting=true;download.disabled=true;const label=download.textContent;download.textContent='جارٍ تجهيز PDF…';const current=prepared,revision=generation;
 let svgUrl=null;
 try{
  const base64=await font();
  const withFont=current.svg.replace('<defs>','<defs><style>@font-face{font-family:FamilyNaskh;src:url(data:font/ttf;base64,'+base64+') format("truetype");font-weight:700}</style>');
  svgUrl=URL.createObjectURL(new Blob([withFont],{type:'image/svg+xml;charset=utf-8'}));
  const img=new Image();img.src=svgUrl;await img.decode();
  const{width,height}=current.layout,scale=Math.min(3,8000/Math.max(width,height),Math.sqrt(24000000/(width*height)));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('المتصفح لم يتمكن من تجهيز الصورة.');context.fillStyle='#f8f4e7';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
  const jpeg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.98));if(!jpeg)throw Error('تعذر تجهيز PDF. أغلق بعض التطبيقات ثم أعد المحاولة.');
  const pdf=window.FamilyBotanicalPDF.encode(new Uint8Array(await jpeg.arrayBuffer()),canvas.width,canvas.height);canvas.width=canvas.height=1;
  if(!dialog.open||revision!==generation)return;
  clearDownload();readyUrl=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));const a=document.getElementById('designReadyPdf');a.href=readyUrl;a.hidden=false;a.click();
  message('ملف PDF جاهز. إن لم يبدأ التنزيل، اضغط «حفظ الملف».');
 }catch(error){if(dialog.open)message(error.message||'تعذر تنزيل PDF. حاول مرة أخرى.',true);}
 finally{if(svgUrl)URL.revokeObjectURL(svgUrl);exporting=false;download.textContent=label;download.disabled=!prepared;}
};
})();
