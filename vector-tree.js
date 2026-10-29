/* Optional interactive force-directed family view; existing family data is the source of truth. */
(()=>{
'use strict';
const host=document.getElementById('vectorTree'),toggle=document.getElementById('toggleVectorView');
const normal=document.getElementById('treeCanvas'),tools=document.getElementById('vectorControls');
if(!host||!toggle||!normal)return;
let active=false,svg=null,group=null,zoom=null,simulation=null,signature='',resizeObserver=null;
const NS='http://www.w3.org/2000/svg';
const mk=(tag,attrs={},parent)=>{const el=document.createElementNS(NS,tag);for(const [key,val] of Object.entries(attrs))el.setAttribute(key,String(val));if(parent)parent.appendChild(el);return el;};
const data=()=>Array.isArray(people)?people.filter(p=>p&&p.id):[];
function stop(){if(simulation){simulation.stop();simulation=null;}}
function render(){
 if(!active||!window.d3)return;
 const persons=data(),sig=JSON.stringify(persons.map(p=>[p.id,p.name,p.parent_id]));
 if(sig===signature&&svg)return;signature=sig;stop();host.replaceChildren();
 const w=Math.max(host.clientWidth,350),h=Math.max(host.clientHeight,460);
 svg=window.d3.select(host).append('svg').attr('width','100%').attr('height','100%').attr('role','img').attr('aria-label','شجرة العائلة التفاعلية بنظام المتجهات');
 group=svg.append('g');zoom=window.d3.zoom().scaleExtent([.12,4]).on('zoom',e=>group.attr('transform',e.transform));
 svg.call(zoom).on('dblclick.zoom',null);
 if(!persons.length)return;
 const all=new Set(persons.map(p=>p.id)),virtual='__root__';
 const rows=[{id:virtual,name:'',parentId:null},...persons.map(p=>({id:p.id,name:p.name,parentId:all.has(p.parent_id)?p.parent_id:virtual}))];
 let root;try{root=window.d3.stratify().id(d=>d.id).parentId(d=>d.parentId)(rows);}catch(e){host.textContent='تعذر ترتيب بيانات النسب';return;}
 window.d3.tree().nodeSize([165,125])(root);
 const nodes=root.descendants().filter(d=>d.id!==virtual),links=root.links().filter(d=>d.source.id!==virtual);
 const line=window.d3.linkVertical().x(d=>d.x).y(d=>-d.y);
 group.selectAll('.link').data(links).enter().append('path').attr('class','link').attr('d',line).attr('fill','none').attr('stroke','#9ca3af').attr('stroke-width',2.5);
 const g=group.selectAll('.vector-node').data(nodes).enter().append('g').attr('class','vector-node').attr('transform',d=>'translate('+d.x+','+(-d.y)+')');
 g.append('rect').attr('x',-70).attr('y',-25).attr('width',140).attr('height',50).attr('rx',25).attr('fill',d=>d.parent.id===virtual?'#92400e':'#047857').attr('stroke','#d4af37').attr('stroke-width',2);
 g.append('text').text(d=>d.data.name).attr('text-anchor','middle').attr('dominant-baseline','middle').attr('fill','white').attr('font-family','Cairo,Tajawal').attr('font-size',18).attr('font-weight',700);
 const bounds={minX:window.d3.min(nodes,d=>d.x-75),maxX:window.d3.max(nodes,d=>d.x+75),minY:window.d3.min(nodes,d=>-d.y-25),maxY:window.d3.max(nodes,d=>-d.y+25)};
 const k=Math.min(1.2,(w-40)/(bounds.maxX-bounds.minX),(h-40)/(bounds.maxY-bounds.minY));
 svg.call(zoom.transform,window.d3.zoomIdentity.translate(w/2-k*(bounds.minX+bounds.maxX)/2,h/2-k*(bounds.minY+bounds.maxY)/2).scale(k));
}
function switchView(show){
 active=show;host.classList.toggle('hidden',!show);normal.classList.toggle('hidden',show);tools?.classList.toggle('hidden',!show);
 toggle.setAttribute('aria-pressed',String(show));toggle.textContent=show?'العرض العادي':'متجهات';
 if(show){
  if(!window.d3){host.textContent='تعذر تحميل عرض المتجهات. تحقق من اتصال الإنترنت.';return;}
  signature='';requestAnimationFrame(render);
 }else{stop();window.dispatchEvent(new CustomEvent('tree:layout'));}
}
toggle.addEventListener('click',()=>switchView(!active));
const buttons={vectorZoomIn:1.3,vectorZoomOut:.77};
Object.entries(buttons).forEach(([id,value])=>document.getElementById(id)?.addEventListener('click',()=>{if(active&&svg)svg.transition().duration(250).call(zoom.scaleBy,value);}));
document.getElementById('vectorZoomFit')?.addEventListener('click',()=>{signature='';render();});
window.addEventListener('tree:render',()=>{if(active)render();});
window.addEventListener('tree:navigate',e=>{if(active&&e.detail==='tree')requestAnimationFrame(render);});
if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(()=>{if(active){signature='';render();}});resizeObserver.observe(host);}
})();