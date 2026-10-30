/* Deterministic botanical genealogy. Identity and links always come from record IDs. */
(function(root){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function graph(records){
    if(!Array.isArray(records)||!records.length)throw Error('لا توجد أسماء في الشجرة لعرض التصميم.');
    const nodes=[],byId=new Map(),roots=[];
    for(const [index,p] of records.entries()){
      if(!p||!p.id||!String(p.name||'').trim())throw Error('يوجد فرد بلا اسم أو معرّف صالح. راجع بيانات الشجرة.');
      if(byId.has(p.id))throw Error('يوجد معرّف فرد مكرر. راجع بيانات الشجرة قبل التصدير.');
      const n={id:p.id,name:String(p.name),parentId:p.parent_id??p.father_id??null,order:Number.isFinite(p.sort_order)?p.sort_order:index,index,children:[]};
      nodes.push(n);byId.set(n.id,n);
    }
    for(const n of nodes){
      if(n.parentId===null||n.parentId===''){n.parentId=null;roots.push(n);}
      else{
        const parent=byId.get(n.parentId);
        if(!parent)throw Error('الأب المرتبط بـ «'+n.name+'» غير موجود ضمن البيانات المتاحة. حدّث الشجرة قبل التصدير.');
        parent.children.push(n);
      }
    }
    const order=(a,b)=>a.order-b.order||a.index-b.index;
    roots.sort(order);nodes.forEach(n=>n.children.sort(order));
    const active=new Set(),done=new Set();
    function visit(n,depth){
      if(active.has(n.id))throw Error('توجد حلقة في روابط الأبوة. راجع النسب قبل التصدير.');
      if(done.has(n.id))return;
      if(depth>500)throw Error('عدد الأجيال يتجاوز حجم التصميم المدعوم.');
      active.add(n.id);n.depth=depth;n.size=1;n.leaves=0;
      for(const c of n.children){visit(c,depth+1);n.size+=c.size;n.leaves+=c.leaves;}
      if(!n.children.length)n.leaves=1;
      active.delete(n.id);done.add(n.id);
    }
    roots.forEach(n=>visit(n,0));
    // A disconnected cycle has no root; inspect it rather than silently omitting it.
    nodes.filter(n=>!done.has(n.id)).forEach(n=>visit(n,0));
    if(!roots.length)throw Error('لا يوجد جد أساسي واضح في بيانات الشجرة.');
    return{nodes,byId,roots};
  }
  function layout(records){
    const g=graph(records),edges=[];let forestX=0,forestHeight=0;
    for(const rootNode of g.roots){
      let cursor=0;const local=[];
      function slots(n){
        local.push(n);
        n.start=cursor;
        if(n.children.length)n.children.forEach(slots);else cursor++;
        n.end=cursor;
        n.slot=(n.start+n.end)/2;
      }
      slots(rootNode);
      const span=Math.min(2.12,1.05+Math.log2(rootNode.leaves+1)*.20);
      const maxDepth=Math.max(...local.map(n=>n.depth)),radii=[0];
      local.forEach(n=>{
        n.angle=-Math.PI/2+(n.slot/rootNode.leaves-.5)*span;
        n.rx=n===rootNode?139:n.children.length?Math.max(99,Math.min(240,n.name.length*12)):Math.max(108,Math.min(250,n.name.length*12));
        n.ry=n===rootNode?79:n.children.length?56:64;
      });
      // Fit each generation in its allocated angular intervals. The spacing grows
      // with occupied leaves, so siblings move apart when a descendant branch grows.
      for(let depth=1;depth<=maxDepth;depth++){
        const row=local.filter(n=>n.depth===depth).sort((a,b)=>a.angle-b.angle);
        let radius=(radii[depth-1]||0)+270;
        for(let i=1;i<row.length;i++){
          const a=row[i-1],b=row[i],dx=Math.abs(Math.cos(a.angle)-Math.cos(b.angle)),dy=Math.abs(Math.sin(a.angle)-Math.sin(b.angle))*1.3;
          // Axis-aligned boxes remain disjoint even after names grow in length.
          radius=Math.max(radius,Math.min(dx>1e-6?(a.rx+b.rx+40)/dx:Infinity,dy>1e-6?(a.ry+b.ry+40)/dy:Infinity));
        }
        radii.push(radius);
      }
      function position(){local.forEach(n=>{const r=radii[n.depth];n.x=Math.cos(n.angle)*r;n.y=Math.sin(n.angle)*r*1.3;});}
      position();
      // Start with a planar fan, then shorten branches into a compact crown.
      // Node/edge repulsion preserves clear ancestry while filling unused space.
      const spread=Math.max(...local.map(n=>Math.hypot(n.x,n.y)),1);
      const compact=Math.min(1,(320+Math.sqrt(local.length)*230)/spread);
      local.forEach(n=>{n.x*=compact;n.y*=compact;});
      const links=local.filter(n=>n!==rootNode).map(n=>[g.byId.get(n.parentId),n]);
      const incident=new Map(local.map(n=>[n,links.filter(([a,b])=>a===n||b===n)]));
      const crosses=(a,b,c,d)=>{
        if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.max(c.y,d.y)<Math.min(a.y,b.y))return false;
        const orient=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
        return orient(a,b,c)*orient(a,b,d)<-1e-6&&orient(c,d,a)*orient(c,d,b)<-1e-6;
      };
      function planarMove(n){
        for(const [a,b] of incident.get(n))for(const [c,d] of links){
          if(a===c||a===d||b===c||b===d)continue;
          if(crosses(a,b,c,d))return false;
        }
        return true;
      }

      for(let step=0;step<(local.some(n=>n.children.length>20)?0:1600);step++){
        const forces=new Map(local.map(n=>[n.id,{x:0,y:0}]));
        const force=(n,x,y)=>{const f=forces.get(n.id);f.x+=x;f.y+=y;};
        for(const [a,b] of links){
          const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
          const target=230+Math.min(110,Math.sqrt(b.size)*13),pull=(len-target)*.025*Math.min(5,Math.sqrt(b.size));
          force(a,dx/len*pull,dy/len*pull);force(b,-dx/len*pull,-dy/len*pull);
          if(b.y>a.y-130){const f=(b.y-a.y+130)*.12;force(b,0,-f);force(a,0,f);}
        }
        for(let i=0;i<local.length;i++)for(let j=i+1;j<local.length;j++){
          const a=local[i],b=local[j],dx=b.x-a.x,dy=b.y-a.y;
          const sx=a.rx+b.rx+38,sy=a.ry+b.ry+45;
          const d=Math.sqrt((dx/sx)**2+(dy/sy)**2)||.001;
          if(d<1.25){const power=(1.25-d)*12;force(a,-dx/(Math.abs(dx)+Math.abs(dy)+1)*power,-dy/(Math.abs(dx)+Math.abs(dy)+1)*power);force(b,dx/(Math.abs(dx)+Math.abs(dy)+1)*power,dy/(Math.abs(dx)+Math.abs(dy)+1)*power);}
        }
        for(const n of local)for(const [a,b] of links){
          if(n===a||n===b)continue;
          const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy||1;
          const t=Math.max(0,Math.min(1,((n.x-a.x)*dx+(n.y-a.y)*dy)/len2));
          const qx=a.x+t*dx,qy=a.y+t*dy,ox=n.x-qx,oy=n.y-qy,dist=Math.hypot(ox,oy)||.01;
          const nx=ox/dist,ny=oy/dist,clearance=Math.sqrt((n.rx*nx)**2+(n.ry*ny)**2)+28;
          if(dist<clearance){const power=(clearance-dist)*.18;force(n,nx*power,ny*power);force(a,-nx*power*(1-t)*.5,-ny*power*(1-t)*.5);force(b,-nx*power*t*.5,-ny*power*t*.5);}
        }
        for(const n of local){
          if(n===rootNode)continue;
          const f=forces.get(n.id),length=Math.hypot(f.x,f.y)||1,limit=step<1200?3:1;
          const oldX=n.x,oldY=n.y,dx=f.x*Math.min(1,limit/length),dy=f.y*Math.min(1,limit/length);
          for(const fraction of [1,.25,0]){n.x=oldX+dx*fraction;n.y=oldY+dy*fraction;if(planarMove(n))break;}
        }
      }
      // A tall, oval crown like the approved print, not a flat organization chart.
      local.forEach(n=>{n.x*=.92;n.y*=1.5;});
      let safeScale=1;
      for(let i=0;i<local.length;i++)for(let j=i+1;j<local.length;j++){
        const a=local[i],b=local[j],dx=a.x-b.x,dy=a.y-b.y;
        const q=Math.sqrt((dx/(a.rx+b.rx+24))**2+(dy/(a.ry+b.ry+28))**2);
        if(q>0)safeScale=Math.max(safeScale,1/q);
      }
      for(const n of local)for(const [a,b] of links){
        if(n===a||n===b)continue;
        const pad=22+Math.min(110,9+10*Math.sqrt(b.size))/2;
        const ax=(a.x-n.x)/(n.rx+pad),ay=(a.y-n.y)/(n.ry+pad),bx=(b.x-n.x)/(n.rx+pad),by=(b.y-n.y)/(n.ry+pad);
        const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
        const distance=Math.hypot(ax+t*dx,ay+t*dy);
        if(distance>1e-5)safeScale=Math.max(safeScale,1/distance);
      }
      if(safeScale>1)local.forEach(n=>{n.x*=safeScale;n.y*=safeScale;});
      const minX=Math.min(...local.map(n=>n.x-n.rx),-310),maxX=Math.max(...local.map(n=>n.x+n.rx),310),minY=Math.min(...local.map(n=>n.y-n.ry));
      const maxY=Math.max(...local.map(n=>n.y+n.ry),rootNode.y+320);
      const width=maxX-minX+200,height=maxY-minY+100;
      for(const n of local){n.x+=forestX-minX+100;n.y-=minY;n.rootId=rootNode.id;}
      forestX+=width+160;forestHeight=Math.max(forestHeight,height);
    }
    const width=Math.max(1500,forestX-160+220),height=Math.max(1800,forestHeight+540);
    const contentWidth=forestX-160,offsetX=(width-contentWidth)/2,offsetY=390;
    for(const n of g.nodes){n.x+=offsetX;n.y+=offsetY;}
    for(const n of g.nodes){
      if(!n.parentId)continue;
      const p=g.byId.get(n.parentId),dx=n.x-p.x,dy=n.y-p.y;
      const start=[p.x,p.y],end=[n.x,n.y];
      // Curves remain inside the angular wedge occupied by this branch.
      const controls=[start,[p.x+dx*.16,p.y+dy*.54],[n.x-dx*.22,n.y-dy*.14],end];
      edges.push({parentId:p.id,childId:n.id,controls,width:Math.min(110,9+10*Math.sqrt(n.size)),endWidth:Math.min(80,6+6*Math.sqrt(n.size))});
    }
    // Do not let a curved twig pass behind an unrelated person's name.
    // Reduce only the offending curve toward its already separated straight edge.
    for(const edge of edges){
      const original=edge.controls,[a,,,b]=original;
      const line=[a,[a[0]+(b[0]-a[0])/3,a[1]+(b[1]-a[1])/3],[a[0]+(b[0]-a[0])*2/3,a[1]+(b[1]-a[1])*2/3],b];
      for(const bend of [1,.75,.5,.25,0]){
        const candidate=original.map((p,i)=>p.map((v,k)=>line[i][k]+(v-line[i][k])*bend));
        const blocked=g.nodes.some(n=>{
          if(n.id===edge.parentId||n.id===edge.childId)return false;
          for(let j=1;j<64;j++){
            const[x,y]=point(candidate,j/64),pad=12+(edge.width+(edge.endWidth-edge.width)*j/64)/2;
            if(((x-n.x)/(n.rx+pad))**2+((y-n.y)/(n.ry+pad))**2<1)return true;
          }
          return false;
        });
        edge.controls=candidate;if(!blocked)break;
      }
    }
    const intersects=(a,b,c,d)=>{
      const o=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
      return o(a,b,c)*o(a,b,d)<-1e-6&&o(c,d,a)*o(c,d,b)<-1e-6;
    };
    function straighten(e){const[a,,,b]=e.controls;e.controls=[a,[a[0]+(b[0]-a[0])/3,a[1]+(b[1]-a[1])/3],[a[0]+(b[0]-a[0])*2/3,a[1]+(b[1]-a[1])*2/3],b];}
    for(let pass=0;pass<3;pass++){
      const points=edges.map(e=>Array.from({length:17},(_,i)=>point(e.controls,i/16)));let changed=false;
      for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
        const a=edges[i],b=edges[j];if(a.parentId===b.parentId||a.parentId===b.childId||a.childId===b.parentId)continue;
        const p=points[i],q=points[j];
        if(p.some((v,k)=>k>0&&q.some((w,l)=>l>0&&intersects(p[k-1],v,q[l-1],w)))){straighten(a);straighten(b);changed=true;}
      }
      if(!changed)break;
    }
    return{...g,edges,width,height};
  }
  const number=n=>Number(n.toFixed(2));
  function point(c,t){return[0,1].map(k=>(1-t)**3*c[0][k]+3*(1-t)**2*t*c[1][k]+3*(1-t)*t*t*c[2][k]+t**3*c[3][k]);}
  function branch(edge){
    const c=edge.controls,pts=Array.from({length:25},(_,i)=>point(c,i/24)),left=[],right=[];
    pts.forEach(([x,y],i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(24,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],norm=Math.hypot(dx,dy)||1,r=(edge.width+(edge.endWidth-edge.width)*i/24)/2;left.push([x-dy/norm*r,y+dx/norm*r]);right.push([x+dy/norm*r,y-dx/norm*r]);});
    const path='M'+left.concat(right.reverse()).map(p=>p.map(number).join(',')).join(' L')+'Z';
    const spine=`M${c[0].map(number)} C${c[1].map(number)} ${c[2].map(number)} ${c[3].map(number)}`;
    return`<g data-parent-id="${escape(edge.parentId)}" data-child-id="${escape(edge.childId)}"><path d="${path}" fill="url(#bark)" stroke="#4b3523" stroke-width="1.5"/><path d="${spine}" fill="none" stroke="#cda16a" stroke-width="${number(Math.max(1,edge.width*.07))}" opacity=".42"/></g>`;
  }
  function svg(records,defs){
    const data=layout(records),{width:W,height:H}=data;
    const text=(x,y,t,size=38,color='#273c2d')=>`<text x="${number(x)}" y="${number(y)}" text-anchor="middle" direction="rtl" font-family="FamilyNaskh, Noto Naskh Arabic, serif" font-weight="700" font-size="${size}" fill="${color}">${escape(t)}</text>`;
    let result=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="شجرة عائلة الجارالله">${defs}<rect width="${W}" height="${H}" fill="url(#paper)"/><rect x="60" y="60" width="${W-120}" height="${H-120}" fill="url(#paperpattern)"/>`;
    for(const [inset,sw] of [[45,2],[62,5],[79,1]])result+=`<rect x="${inset}" y="${inset}" width="${W-inset*2}" height="${H-inset*2}" rx="3" fill="none" stroke="url(#gold)" stroke-width="${sw}"/>`;
    for(const [x,y,sx,sy] of [[81,81,1,1],[W-81,81,-1,1],[81,H-81,1,-1],[W-81,H-81,-1,-1]])result+=`<use xlink:href="#corner" transform="translate(${x} ${y}) scale(${sx} ${sy})"/>`;
    result+=text(W/2,128,'بسم الله الرحمن الرحيم',32,'#8c713e')+text(W/2,247,'شجرة عائلة الجارالله',Math.min(180,W/18),'#1c4934');
    result+=`<path d="M${W/2-400} 292H${W/2-110}M${W/2+110} 292H${W/2+400}" stroke="#b29a61" stroke-width="1.6"/><path d="M${W/2-40} 292Q${W/2} 264 ${W/2+40} 292Q${W/2} 320 ${W/2-40} 292Z" fill="none" stroke="#b29a61" stroke-width="2"/>`;
    for(const root of data.roots){
      const x=root.x,y=root.y,base=y+280;
      result+=`<ellipse cx="${x}" cy="${base+10}" rx="320" ry="25" fill="#8b9872" opacity=".13"/><path d="M${x-310} ${base}C${x-130} ${base-60} ${x-76} ${y+90} ${x-62} ${y-30}L${x+50} ${y-30}C${x+75} ${y+100} ${x+90} ${base-70} ${x+310} ${base}C${x+130} ${base-20} ${x+140} ${base-33} ${x+90} ${base-36}L${x+146} ${base+14}Q${x} ${base-22} ${x-72} ${base+14}L${x-65} ${base-32}Q${x-180} ${base-1} ${x-310} ${base}Z" fill="url(#bark)" stroke="#4d3827" stroke-width="4"/>`;
      result+=`<path d="M${x-10} ${y+75}Q${x+22} ${y+190} ${x-110} ${base-20}M${x+30} ${y+100}Q${x+15} ${y+210} ${x+140} ${base-20}" fill="none" stroke="#d7b476" stroke-width="2.2" opacity=".35"/>`;
    }
    result+=data.edges.slice().sort((a,b)=>b.width-a.width).map(branch).join('');
    for(const edge of data.edges){
      if(!data.byId.get(edge.childId).children.length)continue;
      const [x,y]=point(edge.controls,.48),[u,v]=point(edge.controls,.49),angle=Math.atan2(v-y,u-x)*180/Math.PI;
      for(const side of [-1,1])result+=`<g transform="translate(${x} ${y}) rotate(${angle+side*48})"><path d="M7 0Q31 -25 63 0Q31 25 7 0Z" fill="#4d7650" opacity=".85"/><path d="M9 0H57" stroke="#a5b17b" stroke-width="1"/></g>`;
    }
    for(const [i,n] of data.nodes.entries()){
      const{x,y,rx,ry}=n,root=!n.parentId,internal=root||n.children.length;
      result+=`<g data-person-id="${escape(n.id)}" data-father-id="${escape(n.parentId||'')}"><title>${escape(n.name)}${n.parentId?' — الأب: '+escape(data.byId.get(n.parentId).name):''}</title>`;
      if(internal){
        result+=`<ellipse cx="${x}" cy="${y+5}" rx="${rx+4}" ry="${ry+4}" fill="#3b2c1f" opacity=".16"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#plaque)" stroke="#8b6935" stroke-width="3"/><ellipse cx="${x}" cy="${y}" rx="${rx-8}" ry="${ry-7}" fill="none" stroke="#fff7d8" stroke-width="1.4"/>`;
        for(const side of [-1,1]){const cx=x+side*(rx-17);result+=`<path d="M${cx} ${y-4}l4 4-4 4-4-4Z" fill="#a08046"/>`;}
      }else{
        const angle=n.angle<-Math.PI/2?-11:11;
        result+=`<g transform="translate(${x} ${y}) rotate(${angle})"><path d="M${-rx} 0C${-rx*.4} ${-ry*1.48} ${rx*.55} ${-ry*1.15} ${rx} 0C${rx*.45} ${ry*1.3} ${-rx*.5} ${ry*1.25} ${-rx} 0Z" fill="url(#leaf${i%3===0?'2':''})" stroke="#194a33" stroke-width="2"/><path d="M${-rx+11} 0Q0 20 ${rx-12} 0" fill="none" stroke="#c9cda0" stroke-width="1.2" opacity=".26"/><path d="M${-rx*.4} -27Q0 -52 ${rx*.55} -19" fill="none" stroke="#bdd099" stroke-width="1.1" opacity=".3"/></g>`;
      }
      const size=root?48:n.name.length>8?32:38;
      // Text may wrap; no name is truncated or merged with a namesake.
      const words=n.name.split(/\s+/),rows=[];let line='';
      const maxChars=Math.floor((rx*1.8)/(size*.38));
      for(const word of words){if(line&&(line+' '+word).length>maxChars){rows.push(line);line=word;}else line+=(line?' ':'')+word;}
      if(line)rows.push(line);
      const fontSize=rows.length>2?Math.min(size,92/(rows.length*1.16)):size;
      rows.forEach((row,j)=>result+=text(x,y+(j-(rows.length-1)/2)*fontSize*1.12+fontSize*.30,row,fontSize,internal?'#392e1d':'#fff9df'));
      result+='</g>';
    }
    result+=`<path d="M${W/2-290} ${H-175}H${W/2+290}" stroke="#b39860" stroke-width="1.4"/>`+text(W/2,H-130,'جذور تجمعنا، وأغصان تمتد',35,'#716748')+text(W/2,H-90,'عائلة الجارالله',24,'#927f54')+'</svg>';
    return{svg:result,layout:data};
  }
  const api={graph,layout,svg,point};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FamilyBotanical=api;
})(typeof window==='undefined'?globalThis:window);
