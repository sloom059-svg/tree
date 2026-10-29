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
 const byId=new Map(persons.map(p=>[p.id,p]));
 const nodes=persons.map(p=>({id:p.id,name:p.name,parent_id:p.parent_id,depth:0}));
 const nodeMap=new Map(nodes.map(n=>[n.id,n]));
 const roots=nodes.filter(n=>!n.parent_id||!byId.has(n.parent_id)||n.id===n.parent_id);
 const visited=new Set();
 function setDepth(n,depth,ancestors=new Set()){if(ancestors.has(n.id)||depth>nodes.length)return;const next=new Set(ancestors);next.add(n.id);n.depth=depth;visited.add(n.id);nodes.filter(c=>c.parent_id===n.id).forEach(c=>setDepth(c,depth+1,next));}
 roots.forEach(n=>setDepth(n,0));nodes.filter(n=>!visited.has(n.id)).forEach(n=>setDepth(n,0));
 const links=nodes.filter(n=>n.parent_id&&nodeMap.has(n.parent_id)&&n.parent_id!==n.id).map(n=>({source:n.parent_id,target:n.id}));
 const defs=group.append('defs');
 const gradients=[['vectorRoot','#b45309','#78350f'],['vectorChild','#059669','#064e3b']];
 gradients.forEach(([id,start,end])=>{const gr=defs.append('linearGradient').attr('id',id).attr('x1','0%').attr('y1','0%').attr('x2','100%').attr('y2','100%');gr.append('stop').attr('offset','0%').attr('stop-color',start);gr.append('stop').attr('offset','100%').attr('stop-color',end);});
 const link=group.append('g').attr('class','vector-links').selectAll('line').data(links).join('line').attr('stroke','#9ca3af').attr('stroke-width',2.5).attr('stroke-opacity',.7);
 const node=group.append('g').selectAll('g').data(nodes).join('g').attr('class','vector-node').style('cursor','grab');
 node.append('rect').attr('x',-67).attr('y',-25).attr('width',134).attr('height',50).attr('rx',23).attr('fill',d=>d.depth===0?'url(#vectorRoot)':'url(#vectorChild)').attr('stroke','#d4af37').attr('stroke-width',2);
 node.append('text').text(d=>d.name.length>19?d.name.slice(0,18)+'…':d.name).attr('text-anchor','middle').attr('dominant-baseline','middle').attr('font-family','Cairo,Tajawal,sans-serif').attr('font-weight',700).attr('font-size',d=>d.depth===0?20:16).attr('fill','#fffdf0').style('pointer-events','none');
 node.append('title').text(d=>d.name);
 const row=135;
 simulation=window.d3.forceSimulation(nodes)
 .force('link',window.d3.forceLink(links).id(d=>d.id).distance(115).strength(.55))
 .force('charge',window.d3.forceManyBody().strength(-650))
 .force('collide',window.d3.forceCollide(83))
 .force('x',window.d3.forceX(0).strength(.065))
 .force('y',window.d3.forceY(d=>-d.depth*row).strength(.85))
 .alphaDecay(.045);
 node.call(window.d3.drag().on('start',(event,d)=>{if(!event.active)simulation.alphaTarget(.25).restart();d.fx=d.x;d.fy=d.y;}).on('drag',(event,d)=>{d.fx=event.x;d.fy=event.y;}).on('end',(event,d)=>{if(!event.active)simulation.alphaTarget(0);d.fx=null;d.fy=null;}));
 simulation.on('tick',()=>{link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);node.attr('transform',d=>'translate('+d.x+','+d.y+')');});
 // Place root near the lower center; the descendants expand upwards.
 svg.call(zoom.transform,window.d3.zoomIdentity.translate(w/2,h-100).scale(Math.max(.3,Math.min(.9,700/Math.max(w,nodes.length*36)))));
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