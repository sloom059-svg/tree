/* Navigation, live pending counts, and a pointer-based pan/zoom workspace. */
(() => {
  'use strict';
  const icons = {
    tree:'<circle cx="12" cy="4" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 6.5v5M5 16.5v-5h14v5"/>',
    add:'<path d="M12 5v14M5 12h14"/>',
    inbox:'<path d="M3 5h18v12H3zM3 5l9 7 9-7M16 20h6M19 17v6"/>',
    chart:'<path d="M4 4v16h17M8 15v-5M13 15V6M18 15v-7"/>',
    share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    home:'<path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8"/>',
    user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    logout:'<path d="M9 4H4v16h5M10 12h11M17 8l4 4-4 4"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    expand:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
    fit:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 12h8M12 8v8"/>',
    sliders:'<path d="M6 3v7m0 4v7M12 3v3m0 4v11M18 3v11m0 4v3M3 10h6M9 6h6M15 14h6"/>'
  };
  document.querySelectorAll('[data-icon]').forEach(el=>{
    el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[el.dataset.icon]||'')+'</svg>';
  });
  const canvas=$('#treeCanvas'),stage=$('#treeStage'),lines=$('#treeLines');
  let view={x:0,y:0,scale:1}, fitted=false, layoutFrame=0, isAdmin=false, polling=false;
  const clamp=s=>Math.min(2.5,Math.max(.18,s));
  function paint(){
    stage.style.transform=`translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    $('#zoomValue').textContent=Math.round(view.scale*100)+'%';
    $('#zoomIn').disabled=view.scale>=2.5;
    $('#zoomOut').disabled=view.scale<=.18;
  }
  function zoomAt(next,x,y){
    const scale=clamp(next),factor=scale/view.scale;
    view={x:x-(x-view.x)*factor,y:y-(y-view.y)*factor,scale};paint();
  }
  function fit(){
    if(!canvas.clientWidth||!people.length)return;
    const w=stage.offsetWidth,h=stage.offsetHeight,availableH=Math.max(100,canvas.clientHeight-160);
    const scale=clamp(Math.min(1,(canvas.clientWidth-54)/w,availableH/h));
    view={x:(canvas.clientWidth-w*scale)/2,y:90+Math.max(0,(availableH-h*scale)/2),scale};paint();fitted=true;
  }
  function drawLines(){
    if(!canvas.clientWidth)return;
    lines.setAttribute('width',stage.offsetWidth);lines.setAttribute('height',stage.offsetHeight);
    const base=stage.getBoundingClientRect(),cards=new Map();
    document.querySelectorAll('#treeView [data-person]').forEach(card=>{
      const r=card.getBoundingClientRect();cards.set(card.dataset.person,{x:(r.left+r.width/2-base.left)/view.scale,top:(r.top-base.top)/view.scale,bottom:(r.bottom-base.top)/view.scale});
    });
    const paths=[];
    people.forEach(person=>{
      const parent=cards.get(person.parent_id),child=cards.get(person.id);if(!parent||!child)return;
      const middle=(parent.bottom+child.top)/2;
      paths.push(`<path d="M ${parent.x} ${parent.bottom} C ${parent.x} ${middle}, ${child.x} ${middle}, ${child.x} ${child.top}"/>`);
    });
    lines.innerHTML=paths.join('');
  }
  function scheduleLayout(){cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(()=>{drawLines();if(!fitted)fit();});}
  window.addEventListener('tree:layout',scheduleLayout);
  window.addEventListener('tree:navigate',e=>{
    closeSidebar();closeNotifications();
    document.querySelectorAll('.sidebar-nav [data-go]').forEach(b=>b.classList.toggle('active',b.dataset.go===e.detail&&!b.dataset.adminSection));
    $('#pageTitle').textContent={tree:'شجرة الجارالله',admin:'إدارة العائلة',join:'ساهم في الشجرة',home:'عائلة الجارالله',receipt:'متابعة الطلب'}[e.detail]||'شجرة الجارالله';
    if(e.detail==='tree')scheduleLayout();
  });
  window.addEventListener('tree:render',e=>{
    isAdmin=e.detail.isAdmin;
    document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!isAdmin));
    const count=e.detail.pending;
    const badge=$('#requestsBadge');badge.textContent=count>99?'99+':String(count);
    badge.classList.toggle('hidden',!isAdmin||count===0);
    badge.setAttribute('aria-label',`${count} طلبات إضافة بانتظار المراجعة`);
    renderNotifications();
    $('#accountLabel').textContent=isAdmin?'حساب المسؤول':'دخول المسؤول';
    $('#treeCountLabel').textContent=e.detail.hasAccess?e.detail.count+' أفراد في شجرة العائلة':'أسماء تجمعنا، وصلات تحفظ حكايتنا';
    $('#workspaceEmpty').classList.toggle('hidden',e.detail.count>0);
    $('#workspaceEmptyText').textContent=e.detail.hasAccess?'ابدأ بإضافة الجد أو بداية فرع من لوحة الإدارة.':'افتح رابط الدعوة أو سجل دخول المسؤول لعرض الشجرة.';
    if(!e.detail.count)fitted=false;
    scheduleLayout();
  });
  window.addEventListener('tree:focus',e=>{
    const card=document.querySelector(`[data-person="${CSS.escape(e.detail)}"]`);if(!card)return;
    const rect=card.getBoundingClientRect(),base=stage.getBoundingClientRect();
    const center={x:(rect.left+rect.width/2-base.left)/view.scale,y:(rect.top+rect.height/2-base.top)/view.scale};
    const scale=Math.max(.85,view.scale);view={x:canvas.clientWidth/2-center.x*scale,y:canvas.clientHeight/2-center.y*scale,scale};paint();
  });
  $('#zoomIn').onclick=()=>zoomAt(view.scale*1.2,canvas.clientWidth/2,canvas.clientHeight/2);
  $('#zoomOut').onclick=()=>zoomAt(view.scale/1.2,canvas.clientWidth/2,canvas.clientHeight/2);
  $('#zoomFit').onclick=fit;
  $('#printTree').onclick=()=>window.print();
  $('#fullscreenTree').onclick=async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#tree .tree-panel').requestFullscreen();}catch{showMessage('استخدم زر احتواء الشجرة لضبط العرض على شاشتك.');}
  };
  canvas.addEventListener('wheel',e=>{
    if(e.target.closest('.workspace-toolbar,.tree-tools,.person-menu'))return;
    e.preventDefault();const box=canvas.getBoundingClientRect();
    zoomAt(view.scale*Math.exp(-e.deltaY*(e.deltaMode===1?.04:.002)),e.clientX-box.left,e.clientY-box.top);
  },{passive:false});
  const pointers=new Map();let lastPinch=null,lastDragAt=0,origin=null,moved=false;
  function geometry(){const p=[...pointers.values()];return{distance:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};}
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('button,input,summary,.workspace-toolbar,.person-menu'))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
    if(pointers.size===1){origin={x:e.clientX,y:e.clientY};moved=false;}
    if(pointers.size===2){lastPinch=geometry();moved=true;}
  });
  canvas.addEventListener('pointermove',e=>{
    const previous=pointers.get(e.pointerId);if(!previous)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2){
      const g=geometry(),box=canvas.getBoundingClientRect();
      if(lastPinch&&lastPinch.distance>0){
        const scale=clamp(view.scale*g.distance/lastPinch.distance),factor=scale/view.scale;
        view={x:g.x-box.left-(lastPinch.x-box.left-view.x)*factor,y:g.y-box.top-(lastPinch.y-box.top-view.y)*factor,scale};paint();
      }
      lastPinch=g;moved=true;
    }else{
      if(origin&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>4)moved=true;
      if(moved){view.x+=e.clientX-previous.x;view.y+=e.clientY-previous.y;paint();}
    }
    canvas.classList.toggle('is-dragging',moved);
  });
  function release(e){
    if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);lastPinch=null;
    if(moved)lastDragAt=Date.now();
    if(!pointers.size){canvas.classList.remove('is-dragging');origin=null;moved=false;}
    else{const p=[...pointers.values()][0];origin=p;moved=true;}
  }
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,release));
  canvas.addEventListener('click',e=>{if(Date.now()-lastDragAt<180){e.preventDefault();e.stopImmediatePropagation();}},true);
  canvas.addEventListener('keydown',e=>{
    if(e.target!==canvas)return;
    const deltas={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};
    if(deltas[e.key]){e.preventDefault();view.x+=deltas[e.key][0];view.y+=deltas[e.key][1];paint();}
    else if(e.key==='+'||e.key==='='){$('#zoomIn').click();e.preventDefault();}
    else if(e.key==='-'){$('#zoomOut').click();e.preventDefault();}
    else if(e.key==='0'){fit();e.preventDefault();}
  });
  const locallyReadNotifications=new Set(),markingNotifications=new Map();
  let notificationSignature='';
  function closeNotifications(){$('#notificationPanel').classList.add('hidden');$('#sidebarNotifications').setAttribute('aria-expanded','false');}
  function renderNotifications(){
    const U=window.FamilyRequestUtils,unread=U.unreadNotifications(requests,locallyReadNotifications),count=unread.length;
    const badge=$('#notificationBadge');badge.textContent=count>99?'99+':String(count);badge.classList.toggle('hidden',!isAdmin||!count);
    const label=count?'الإشعارات، '+count+' غير مقروءة':'الإشعارات، لا توجد إشعارات جديدة';
    $('#sidebarNotifications').setAttribute('aria-label',label);$('#sidebarNotifications').setAttribute('title',label);
    $('#notificationSummary').textContent=count?count+' جديدة':'لا جديد';
    if(!isAdmin){closeNotifications();$('#notificationList').innerHTML='';locallyReadNotifications.clear();notificationSignature='';return;}
    const signature=JSON.stringify(requests.map(r=>[r.id,r.sender_name,r.created_at,!!r.notification_read_at||locallyReadNotifications.has(r.id)]));
    if(signature===notificationSignature)return;notificationSignature=signature;
    const unreadIds=new Set(unread.map(r=>r.id)),recent=[...unread,...requests.filter(r=>!unreadIds.has(r.id))].slice(0,8);
    $('#notificationList').innerHTML=recent.length?recent.map(r=>{
      const fresh=unreadIds.has(r.id),date=U.dateParts(r.created_at);
      return `<button type="button" class="notification-item ${fresh?'unread':'read'}" data-open-notification="${U.escapeHTML(r.id)}"><span class="notification-dot" aria-hidden="true"></span><span><strong>طلب إضافة من ${U.escapeHTML(r.sender_name||'أحد الأقارب')}</strong><small>${U.escapeHTML(date.date)} · ${U.escapeHTML(date.time)}</small><em>${fresh?'اضغط لفتح الطلب':'تم الاطلاع'}</em></span></button>`;
    }).join(''):'<p class="notifications-empty">لا توجد إشعارات حتى الآن.</p>';
  }
  function markNotificationRead(id){
    const request=requests.find(r=>r.id===id);
    if(!isAdmin||!request||request.notification_read_at||locallyReadNotifications.has(id))return Promise.resolve();
    if(markingNotifications.has(id))return markingNotifications.get(id);
    const task=(async()=>{
      const rows=await api('/rest/v1/family_requests?id=eq.'+encodeURIComponent(id),{method:'PATCH',admin:true,prefer:'return=representation',body:{notification_read_at:new Date().toISOString()}});
      if(!rows?.length)throw Error('تعذر تحديث الإشعار. حاول مرة أخرى.');
      locallyReadNotifications.add(id);requests=requests.map(r=>r.id===id?rows[0]:r);render();
    })().finally(()=>markingNotifications.delete(id));
    markingNotifications.set(id,task);return task;
  }
  $('#sidebarNotifications').onclick=()=>{const open=$('#notificationPanel').classList.contains('hidden');$('#notificationPanel').classList.toggle('hidden',!open);$('#sidebarNotifications').setAttribute('aria-expanded',String(open));};
  document.addEventListener('click',async e=>{
    const item=e.target.closest('[data-open-notification]');
    if(item){try{await markNotificationRead(item.dataset.openNotification);closeNotifications();window.FamilyContributions?.openRequest(item.dataset.openNotification);}catch(error){showMessage(error.message);}return;}
    if(!e.target.closest('#notificationPanel,#sidebarNotifications'))closeNotifications();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNotifications();});
  window.FamilyNotifications={markRead:markNotificationRead};
  function closeSidebar(){$('#appSidebar').classList.remove('open');$('#sidebarScrim').classList.add('hidden');$('#sidebarToggle').setAttribute('aria-expanded','false');}
  $('#sidebarToggle').onclick=()=>{const open=$('#appSidebar').classList.toggle('open');$('#sidebarScrim').classList.toggle('hidden',!open);$('#sidebarToggle').setAttribute('aria-expanded',String(open));};
  $('#sidebarScrim').onclick=closeSidebar;
  $('#sidebarLogout').onclick=()=>{closeSidebar();$('#logout').click();navigate('home');showMessage('تم تسجيل الخروج.');};
  $('#sidebarTrash').onclick=()=>{closeSidebar();showTrash().catch(e=>showMessage(e.message));};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar();});
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-admin-section]');if(!button)return;
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(b=>b.classList.toggle('active',b.dataset.adminSection===button.dataset.adminSection));
    requestAnimationFrame(()=>$('#'+button.dataset.adminSection)?.scrollIntoView({behavior:'smooth',block:'start'}));
  });
  async function pollRequests(){
    if(!isAdmin||!session||document.hidden||polling)return;
    polling=true;
    try{requests=await api('/rest/v1/family_requests?select=*&order=created_at.desc',{admin:true});render();}catch{/* Keep the last known count when temporarily offline. */}finally{polling=false;}
  }
  setInterval(pollRequests,20000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollRequests();});
  window.addEventListener('focus',pollRequests);
  new ResizeObserver(()=>{if(canvas.clientWidth){drawLines();if(!fitted)fit();}}).observe(canvas);
  document.fonts?.ready.then(scheduleLayout);
  paint();render();
})();
