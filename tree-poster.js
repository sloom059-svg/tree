/* Botanical family-tree vector export. This is independent of the existing tree UI and JSON export. */
(() => {
  'use strict';
  const button=document.getElementById('exportBotanicalTree');
  if(!button)return;
  const escapeXml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const cropName=name=>{const s=String(name||'').trim();return s.length>44?s.slice(0,43)+'…':s;};
  function makePoster(records){
    const recordsById=new Map(records.map(p=>[p.id,{...p,children:[]}]));
    const roots=[];
    for(const p of recordsById.values()){
      if(p.parent_id&&p.parent_id!==p.id&&recordsById.has(p.parent_id))recordsById.get(p.parent_id).children.push(p);
      else roots.push(p);
    }
    if(!roots.length)throw Error('لا توجد أسماء في الشجرة لتصديرها.');
    const ordering=(a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.name.localeCompare(b.name,'ar');
    for(const p of recordsById.values())p.children.sort(ordering);
    roots.sort(ordering);
    const spacing=232,level=156,margin=170;
    let nextLeaf=0,maxDepth=0;
    const positioned=[],edges=[],seen=new Set();
    function layout(node,depth){
      if(seen.has(node.id))return null;
      seen.add(node.id);maxDepth=Math.max(maxDepth,depth);
      const kids=node.children.map(child=>layout(child,depth+1)).filter(Boolean);
      const x=kids.length?(kids[0].x+kids[kids.length-1].x)/2:nextLeaf++*spacing;
      const entry={id:node.id,name:node.name,x,depth};
      positioned.push(entry);
      for(const kid of kids)edges.push({parent:entry,child:kid});
      return entry;
    }
    for(const root of roots){layout(root,0);nextLeaf+=1;}
    const totalW=Math.max(1050,(nextLeaf+1)*spacing+margin*2);
    const totalH=Math.max(680,(maxDepth+1)*level+390);
    const xOf=n=>margin+n.x;
    const yOf=n=>168+(maxDepth-n.depth)*level;
    const defs=`<defs><linearGradient id="paper" x2="0" y2="1"><stop stop-color="#fffdf5"/><stop offset="1" stop-color="#f3efdb"/></linearGradient><linearGradient id="leaf" x2="1" y2="1"><stop stop-color="#dbecc1"/><stop offset=".58" stop-color="#b6d7a0"/><stop offset="1" stop-color="#8eb780"/></linearGradient><linearGradient id="wood" x2="1" y2="0"><stop stop-color="#806443"/><stop offset=".5" stop-color="#b58b5b"/><stop offset="1" stop-color="#735637"/></linearGradient></defs>`;
    const trunks=roots.map(root=>{
      const p=positioned.find(n=>n.id===root.id);if(!p)return '';
      const x=xOf(p),y=yOf(p);
      return `<path d="M ${x} ${totalH-115} C ${x-18} ${totalH-215},${x+20} ${y+116},${x} ${y+25}" fill="none" stroke="url(#wood)" stroke-width="24" stroke-linecap="round"/><path d="M ${x-4} ${totalH-115} Q ${x-8} ${y+85},${x-4} ${y+25}" fill="none" stroke="#d4b589" stroke-opacity=".65" stroke-width="4"/>`;
    }).join('');
    const branches=edges.map(({parent,child})=>{
      const px=xOf(parent),py=yOf(parent)-18,cx=xOf(child),cy=yOf(child)+15;
      const middle=(py+cy)/2;
      return `<path d="M ${px} ${py} C ${px} ${middle},${cx} ${middle},${cx} ${cy}" stroke="#896946" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M ${px} ${py} C ${px} ${middle},${cx} ${middle},${cx} ${cy}" stroke="#c5a87a" stroke-opacity=".55" stroke-width="2" fill="none"/>`;
    }).join('');
    const leaves=positioned.map((n,i)=>{
      const x=xOf(n),y=yOf(n),name=escapeXml(cropName(n.name));
      const root=n.depth===0,scale=root?1.11:1;
      return `<g transform="translate(${x} ${y}) scale(${scale})">
        <path d="M -102 22 C -94 -48,-8 -68,105 -28 C 92 29,19 67,-102 22 Z" fill="url(#leaf)" stroke="#527d46" stroke-width="2.2"/>
        <path d="M -95 20 Q 6 -1,99 -28" fill="none" stroke="#6c9963" stroke-width="2"/>
        <path d="M -46 7 Q -35 -22,-17 -34 M -3 -4 Q 11 -30,35 -37 M 33 -13 Q 50 8,56 20 M -35 6 Q -21 29,5 34" fill="none" stroke="#84ac77" stroke-width="1.5"/>
        <text x="0" y="8" text-anchor="middle" font-family="Tahoma, Arial, sans-serif" font-size="${n.name.length>24?13:16}" font-weight="${root?'700':'600'}" fill="#203522" direction="rtl" unicode-bidi="plaintext">${name}</text></g>`;
    }).join('');
    const border=`<rect x="24" y="24" width="${totalW-48}" height="${totalH-48}" rx="26" fill="none" stroke="#c7b991" stroke-width="3"/><rect x="35" y="35" width="${totalW-70}" height="${totalH-70}" rx="18" fill="none" stroke="#ddcfab" stroke-width="1.5"/>`;
    const title=`<text x="${totalW/2}" y="88" text-anchor="middle" font-family="Tahoma,Arial,sans-serif" font-size="42" font-weight="700" fill="#4f5834">شجرة عائلة الجارالله</text><text x="${totalW/2}" y="122" text-anchor="middle" font-family="Tahoma,Arial,sans-serif" font-size="19" fill="#79815d">جذور راسخة وأغصان تمتد للأجيال</text>`;
    const footer=`<text x="${totalW/2}" y="${totalH-70}" text-anchor="middle" font-family="Tahoma,Arial,sans-serif" font-size="15" fill="#80765e">${positioned.length} اسمًا · يمتد النسب من الجذور أسفل الشجرة إلى الأجيال في الأعلى</text>`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">${defs}<rect width="100%" height="100%" fill="url(#paper)"/>${border}${title}${trunks}${branches}${leaves}${footer}</svg>`;
  }
  const preview=document.getElementById('botanicalPreview');
  const previewFrame=document.getElementById('botanicalPreviewFrame');
  const download=document.getElementById('botanicalDownload');
  const close=document.getElementById('botanicalClose');
  let preparedSvg='';
  button.addEventListener('click',()=>{
    try{
      if(!session||!invitation){showMessage('سجل دخول المسؤول لعرض الشجرة.');return;}
      if(!people.length){showMessage('أضف أسماء إلى الشجرة أولًا، ثم جرّب المعاينة.');return;}
      preparedSvg=makePoster(people);
      previewFrame.replaceChildren();
      const doc=new DOMParser().parseFromString(preparedSvg,'image/svg+xml');
      const svg=document.importNode(doc.documentElement,true);
      svg.removeAttribute('width');svg.removeAttribute('height');
      svg.style.width='100%';svg.style.height='100%';
      previewFrame.appendChild(svg);
      preview.showModal();
    }catch(error){showMessage('تعذر عرض الشجرة: '+error.message);}
  });
  close.addEventListener('click',()=>preview.close());
  preview.addEventListener('close',()=>{preparedSvg='';previewFrame.replaceChildren();});
  download.addEventListener('click',()=>{
    if(!preparedSvg)return;
    const url=URL.createObjectURL(new Blob([preparedSvg],{type:'image/svg+xml;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='aljarallah-botanical-family-tree.svg';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    preview.close();showMessage('تم تنزيل الشجرة بصيغة SVG عالية الجودة.',3500);
  });
})();
