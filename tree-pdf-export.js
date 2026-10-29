/* Printable genealogy based on actual father IDs — independent of the canvas zoom. */
(()=>{
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function exportTree(){
 const persons=people.filter(p=>p&&p.id);
 if(!persons.length){showMessage('لا توجد أسماء في الشجرة لتصديرها.');return;}
 const byId=new Map(persons.map(p=>[p.id,p]));
 const children=new Map(persons.map(p=>[p.id,[]]));
 const roots=[];
 for(const p of persons){if(p.parent_id&&p.parent_id!==p.id&&byId.has(p.parent_id))children.get(p.parent_id).push(p);else roots.push(p);}
 if(!roots.length){showMessage('تعذر تصدير الشجرة: لا يوجد جد أساسي واضح.');return;}
 // Depth-first leaf placement preserves sibling groupings and actual parent links.
 const positions=new Map(),visiting=new Set(),completed=new Set();
 let leaf=0,maxDepth=0;
 function place(p,depth){
  if(visiting.has(p.id)||completed.has(p.id))return;
  visiting.add(p.id);maxDepth=Math.max(maxDepth,depth);
  const kids=(children.get(p.id)||[]).filter(c=>!visiting.has(c.id)&&!completed.has(c.id));
  kids.forEach(c=>place(c,depth+1));
  const xs=kids.filter(c=>positions.has(c.id)).map(c=>positions.get(c.id).x);
  const x=xs.length?(Math.min(...xs)+Math.max(...xs))/2:leaf++;
  positions.set(p.id,{x,depth});visiting.delete(p.id);completed.add(p.id);
 }
 roots.forEach(p=>place(p,0));
 const COL=174,ROW=119,NW=128,NH=46,MARGIN=68,TOP=190;
 const width=Math.max(850,(Math.max(leaf,5)-1)*COL+NW+MARGIN*2);
 const height=TOP+maxDepth*ROW+NH+125;
 const offset=(width-((Math.max(leaf,1)-1)*COL+NW))/2;
 const center=p=>{const a=positions.get(p.id);return{x:offset+a.x*COL+NW/2,y:TOP+a.depth*ROW+NH/2}};
 let connectors='',nodes='';
 for(const p of persons){
  const pos=positions.get(p.id);if(!pos)continue;
  const x=offset+pos.x*COL,y=TOP+pos.depth*ROW;
  const parent=byId.get(p.parent_id);
  if(parent&&positions.has(parent.id)){
    const f=center(parent),c=center(p),sy=f.y+NH/2,ey=c.y-NH/2;
    const mid=sy+(ey-sy)*.52;
    connectors+=`<path d="M ${f.x} ${sy} C ${f.x} ${mid}, ${c.x} ${mid}, ${c.x} ${ey}" fill="none" stroke="#94b8a1" stroke-width="2.1"/><circle cx="${c.x}" cy="${ey}" r="3.2" fill="#c8a468"/>`;
  }
  const isRoot=!parent,fill=isRoot?'#164635':'#fff',stroke=isRoot?'#164635':'#cfdfd2',fg=isRoot?'#fff':'#254b3c';
  const name=escape(p.name);
  nodes+=`<g><rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/><rect x="${x+12}" y="${y+12}" width="3.5" height="22" rx="2" fill="${isRoot?'#d0b06c':'#7cae93'}"/><text x="${x+NW/2+6}" y="${y+30}" font-family="Tajawal,Arial,sans-serif" font-size="${name.length>12?14:17}" font-weight="700" fill="${fg}" text-anchor="middle" direction="rtl">${name}</text></g>`;
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="شجرة عائلة الجارالله"><rect x="1" y="1" width="${width-2}" height="${height-2}" rx="22" fill="#f9faf6" stroke="#d3e0d4"/><text x="${width/2}" y="72" fill="#234b3b" font-size="40" font-weight="700" font-family="Tajawal,Arial,sans-serif" text-anchor="middle">شجرة عائلة الجارالله</text><text x="${width/2}" y="105" fill="#859988" font-size="17" font-family="Tajawal,Arial,sans-serif" text-anchor="middle">جذور تجمعنا، وأجيال تمتد</text><path d="M${width/2-95} 125h190" stroke="#c6a66f" stroke-width="2"/>${connectors}${nodes}<text x="${width/2}" y="${height-35}" fill="#829486" font-size="14" font-family="Tajawal,Arial,sans-serif" text-anchor="middle">عدد الأفراد: ${persons.length} • العلاقات وفق بيانات شجرة العائلة</text></svg>`;
 const pop=window.open('','_blank');
 if(!pop){showMessage('اسمح بفتح النافذة المنبثقة لتصدير PDF.');return;}
 const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>شجرة عائلة الجارالله — PDF</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700&display=swap" rel="stylesheet"><style>@page{size:A3 landscape;margin:8mm}html,body{margin:0;background:#f2f4ef;font-family:Tajawal,Arial,sans-serif;color:#244938}.toolbar{display:flex;gap:12px;justify-content:center;align-items:center;padding:14px}.toolbar button{background:#196948;border:0;color:white;border-radius:10px;padding:11px 22px;font:700 15px Tajawal,Arial;cursor:pointer}.toolbar span{font-size:13px;color:#5c7565}.page{max-width:95vw;margin:0 auto 24px;overflow:auto;background:#f9faf6;box-shadow:0 6px 32px #2333}.page svg{display:block;width:100%;height:auto} @media print{html,body{background:white!important}.toolbar{display:none!important}.page{box-shadow:none;margin:0;max-width:none;overflow:visible}.page svg{width:100%;height:auto;max-height:95vh;object-fit:contain;print-color-adjust:exact;-webkit-print-color-adjust:exact}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><div class="toolbar"><button onclick="window.print()">تنزيل PDF / طباعة</button><span>اختر «حفظ بتنسيق PDF» من وجهة الطباعة — الصفحة أفقية.</span></div><div class="page">${svg}</div></body></html>`;
 pop.document.open();pop.document.write(html);pop.document.close();
}
document.getElementById('downloadStyledPdf')?.addEventListener('click',exportTree);
document.getElementById('downloadStyledPdfTop')?.addEventListener('click',exportTree);
})();
