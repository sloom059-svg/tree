(() => {
  'use strict';
  const U=window.FamilyRequestUtils;
  let step=1,unknown=false,filter='pending',reviewRequest=null,reviewBusy=false,requestSignature='';
  const statusLabels={pending:'قيد الانتظار',approved:'مقبول',rejected:'مرفوض'};
  function tags(names){return names.map((name,i)=>`<span class="name-tag"><i>${i+1}</i>${esc(name)}</span>`).join('');}
  function family(id){return U.lineage(people.find(p=>p.id===id),people);}
  function selectionText(id){const f=family(id);return f.person?`<b>الأب: ${esc(f.person.name)}</b><small>الجد (والد الأب): ${esc(f.parent?.name||'غير مسجل في الشجرة')}</small>`:'';}
  function setError(id,message){const el=$('#'+id);el.textContent=message;el.classList.toggle('hidden',!message);if(message){el.focus();el.scrollIntoView({behavior:'smooth',block:'center'});}}
  function renderRequests(){
    const selected=document.querySelector('input[name="requestFilter"]:checked');if(selected)filter=selected.value;
    document.querySelectorAll('[data-filter-count]').forEach(el=>{el.textContent=el.dataset.filterCount==='all'?requests.length:requests.filter(r=>r.status===el.dataset.filterCount).length;});
    $('#requestsTotal').textContent=requests.length+' طلبات';
    const shown=requests.filter(r=>filter==='all'||r.status===filter),signature=JSON.stringify([shown,people,filter,!!session&&!!invitation]);
    if(signature===requestSignature)return;requestSignature=signature;
    if(!session||!invitation){$('#requests').innerHTML='';return;}
    $('#requests').innerHTML=shown.length?shown.map(request=>{
      const names=U.namesFromRequest(request),f=family(request.selected_parent),date=U.dateParts(request.created_at);
      return `<article class="request-card" data-request-card="${esc(request.id)}"><div class="request-card-header"><div><h3>${esc(request.sender_name||'طلب إضافة أسماء')}</h3><p>طلب إضافة ${names.length} من أفراد العائلة</p></div><div><span class="request-source">رابط جمع الأسماء</span><span class="request-status status-${['pending','approved','rejected'].includes(request.status)?request.status:'pending'}">${esc(statusLabels[request.status]||request.status)}</span></div></div><section class="request-detail-section"><h4>تفاصيل الطلب</h4><div class="request-meta-grid"><dl><dt>مقدم الطلب</dt><dd>${esc(request.sender_name||'غير مسجل')}</dd></dl><dl><dt>رقم الجوال</dt><dd>${request.phone?`<a href="tel:${esc((String(request.phone).trim().startsWith('+')?'+':'')+U.phoneDigits(request.phone))}" dir="ltr">${esc(request.phone)}</a>`:'لم يُكتب'}</dd></dl><dl><dt>تاريخ الطلب</dt><dd><time datetime="${esc(request.created_at||'')}">${esc(date.date)}</time><small>${esc(date.time)} · بتوقيت السعودية</small></dd></dl></div></section><section class="request-detail-section"><h4>مكان إضافة الأسماء في الشجرة</h4><div class="request-family-grid"><dl><dt>الأب المختار</dt><dd>${esc(f.person?.name||'بحاجة إلى تحديد')}</dd></dl><dl><dt>الجد (والد الأب)</dt><dd>${esc(f.parent?.name||'غير مسجل')}</dd></dl><dl><dt>جد الأب</dt><dd>${esc(f.grandparent?.name||'غير مسجل')}</dd></dl></div>${request.context?`<p class="request-context"><b>توضيح مقدم الطلب:</b> ${esc(request.context)}</p>`:''}</section><section class="request-detail-section"><h4>الأسماء المطلوب إضافتها <span class="muted">(${names.length})</span></h4><div class="name-tags">${tags(names)}</div></section><div class="request-card-actions">${request.status==='pending'?`<button type="button" class="btn" data-review="${esc(request.id)}">مراجعة الطلب وتعديله</button>`:''}${f.person?`<button type="button" class="tool-btn" data-request-parent="${esc(f.person.id)}">عرض الأب في الشجرة</button>`:''}${request.status==='pending'?`<button type="button" class="reject-request" data-reject="${esc(request.id)}">رفض الطلب</button>`:''}</div></article>`;
    }).join(''):`<div class="request-empty">${filter==='pending'?'لا توجد طلبات بانتظار المراجعة.':filter==='all'?'لا توجد طلبات حتى الآن.':'لا توجد طلبات بهذه الحالة.'}</div>`;
  }
  function renderPicker(kind){
    const review=kind==='review',input=$(review?'#reviewParentSearch':'#joinParentSearch'),results=$(review?'#reviewParentResults':'#joinParentResults'),select=$(review?'#reviewParent':'#ancestor'),selection=$(review?'#reviewParentSelection':'#joinParentSelection');
    const matches=U.findPeople(people,input.value,review?$('#reviewGrandparent').value:'');
    results.innerHTML=matches.slice(0,30).map(person=>{
      const f=family(person.id),chosen=select.value===person.id&&(!unknown||review);
      return `<button class="parent-result" type="button" data-pick-parent="${esc(person.id)}" data-picker="${kind}" aria-pressed="${chosen}"><span class="parent-radio" aria-hidden="true">${chosen?'✓':''}</span><span><strong>${esc(person.name)}</strong><small><span>والده: ${esc(f.parent?.name||'غير مسجل')}</span><span>جده: ${esc(f.grandparent?.name||'غير مسجل')}</span></small></span></button>`;
    }).join('')||'<p class="picker-empty">لم نجد اسمًا مطابقًا. جرّب اسم الأب أو والده، أو اختر «لم أجد الأب في الشجرة» في نموذج المشاركة.</p>';
    if(matches.length>30)results.insertAdjacentHTML('beforeend','<p class="picker-more">توجد أسماء أخرى. اكتب الاسم أو اسم والده لتضييق النتائج.</p>');
    const text=selectionText(select.value);selection.innerHTML=text;selection.classList.toggle('hidden',!text||(!review&&unknown));
    if(review)approvalSummary();
  }
  function syncReviewOptions(){
    const prior=$('#reviewParent').value;
    $('#reviewParent').innerHTML='<option value="">اختر الأب</option>'+people.map(p=>`<option value="${esc(p.id)}">${esc(personLabel(p))}</option>`).join('');
    $('#reviewParent').value=prior;
    const oldGrand=$('#reviewGrandparent').value;
    const grandparents=people.filter(p=>people.some(child=>child.parent_id===p.id));
    $('#reviewGrandparent').innerHTML='<option value="">كل الفروع / الأجداد</option>'+grandparents.map(p=>`<option value="${esc(p.id)}">${esc(personLabel(p))}</option>`).join('');
    $('#reviewGrandparent').value=grandparents.some(p=>p.id===oldGrand)?oldGrand:'';
  }
  function rowValues(kind){return [...document.querySelectorAll('#'+kind+'NameRows input')].map(input=>input.value);}
  function syncNames(kind){const values=rowValues(kind);$(kind==='join'?'#names':'#reviewNames').value=values.join('\n');if(kind==='review')approvalSummary();return values;}
  function paintRows(kind,values=['']){
    const root=$('#'+kind+'NameRows');root.innerHTML=values.map((value,i)=>`<div class="name-row"><span class="name-row-number" aria-hidden="true">${i+1}</span><label for="${kind}Name${i}">اسم ${kind==='join'?'الابن':'الفرد'} ${i+1}<input id="${kind}Name${i}" data-name-kind="${kind}" maxlength="100" autocomplete="off" placeholder="${kind==='join'?'اكتب اسم الابن':'الاسم المطلوب إضافته'}" value="${esc(value)}"></label><button type="button" class="remove-name" data-remove-name="${i}" data-name-kind="${kind}" aria-label="حذف خانة الاسم ${i+1}" ${values.length===1?'disabled':''}>×</button></div>`).join('');
    $(kind==='join'?'#addJoinName':'#addReviewName').disabled=values.length>=50;syncNames(kind);
  }
  function addName(kind){const values=rowValues(kind);if(values.length>=50)return;values.push('');paintRows(kind,values);$('#'+kind+'Name'+(values.length-1)).focus();}
  function approvalSummary(){
    const parent=family($('#reviewParent').value),count=rowValues('review').filter(x=>x.trim()).length;
    $('#reviewApprovalSummary').innerHTML=parent.person?`عند الاعتماد ستُضاف <b>${count} أسماء</b> كأبناء لـ <b>${esc(parent.person.name)}</b>${parent.parent?'، والجد هو <b>'+esc(parent.parent.name)+'</b>':''}.`:'اختر الأب الصحيح أولًا. لن تُضاف الأسماء إلى الشجرة عند حفظ التعديلات فقط.';
  }
  function openReview(id){
    const request=requests.find(r=>r.id===id&&r.status==='pending');if(!request){showMessage('هذا الطلب لم يعد بانتظار المراجعة. حدّث الصفحة.');return;}
    reviewRequest=request;$('#reviewId').value=id;const date=U.dateParts(request.created_at);
    $('#reviewMeta').textContent=(request.sender_name||'مقدم الطلب')+' · '+date.date+' · '+date.time;
    $('#reviewContext').value=request.context||'';$('#reviewParentSearch').value='';$('#reviewGrandparent').value='';syncReviewOptions();$('#reviewParent').value=request.selected_parent||'';
    paintRows('review',U.namesFromRequest(request).length?U.namesFromRequest(request):['']);renderPicker('review');setError('reviewError','');$('#reviewDialog').showModal();
  }
  function reviewValues(requireParent){
    const names=U.validateNames(syncNames('review')),parent=$('#reviewParent').value||null;
    if(requireParent&&(!parent||!people.some(p=>p.id===parent)))throw Error('اختر الأب الصحيح من الشجرة قبل الاعتماد. يمكنك حفظ التعديلات الآن دون إضافة الأسماء.');
    return{names,parent,context:$('#reviewContext').value.trim()};
  }
  function setReviewBusy(busy){reviewBusy=busy;$('#approveRequestButton').disabled=busy;$('#saveRequestDraft').disabled=busy;$('#reviewForm').setAttribute('aria-busy',String(busy));}
  async function saveDraft(){
    if(reviewBusy||!reviewRequest)return;setError('reviewError','');
    try{
      const data=reviewValues(false);setReviewBusy(true);
      await api('/rest/v1/rpc/family_review_request',{method:'POST',admin:true,body:{p_request_id:reviewRequest.id,p_parent_id:data.parent,p_names:data.names,p_context:data.context,p_approve:false}});
      await refresh();$('#reviewDialog').close();showMessage('حُفظت التعديلات. بقي الطلب قيد الانتظار، ولم تُضف أسماء إلى الشجرة.');
    }catch(error){setError('reviewError',error.message);}finally{setReviewBusy(false);}
  }
  async function approve(e){
    e.preventDefault();if(reviewBusy||!reviewRequest)return;setError('reviewError','');
    try{
      const data=reviewValues(true);setReviewBusy(true);
      await api('/rest/v1/rpc/family_review_request',{method:'POST',admin:true,body:{p_request_id:reviewRequest.id,p_parent_id:data.parent,p_names:data.names,p_context:data.context,p_approve:true}});
      $('#reviewDialog').close();await refresh();showMessage('تم اعتماد الطلب وإضافة الأسماء المعدّلة تحت الأب الذي اخترته.');
    }catch(error){setError('reviewError',error.message==='request unavailable'?'هذا الطلب تمت مراجعته بالفعل. حدّث قائمة الطلبات.':error.message);}finally{setReviewBusy(false);}
  }
  function chosenParent(){return unknown?'الأب كما كتبته: '+$('#context').value.trim():selectionText($('#ancestor').value);}
  function showStep(next,scroll=true){
    step=next;document.querySelectorAll('.join-step').forEach(el=>el.classList.toggle('hidden',Number(el.dataset.step)!==step));
    document.querySelectorAll('[data-step-indicator]').forEach(el=>{const n=Number(el.dataset.stepIndicator);el.classList.toggle('completed',n<step);if(n===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
    if(step===2)$('#joinChosenParent').innerHTML=unknown?esc(chosenParent()):chosenParent();
    if(step===3){$('#joinFinalParent').innerHTML=unknown?esc(chosenParent()):chosenParent();$('#joinFinalNames').innerHTML=tags(rowValues('join').map(x=>x.trim()).filter(Boolean));}
    setError('joinError','');
    if(scroll){$('#joinBlock').scrollIntoView({behavior:'smooth',block:'start'});const heading=document.querySelector('.join-step:not(.hidden) h2');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
  }
  function validateParent(){
    if(unknown){if(!$('#context').value.trim())throw Error('اكتب اسم الأب واسم والده، حسب ما تعرفه، حتى يستطيع المسؤول تحديد الفرع.');}
    else if(!$('#ancestor').value||!people.some(p=>p.id===$('#ancestor').value))throw Error('اختر الأب من بطاقات الأسماء، أو اضغط «لم أجد الأب في الشجرة».');
  }
  function nextStep(next){
    try{if(next>=2)validateParent();if(next>=3)U.validateNames(syncNames('join'));showStep(next);}catch(error){setError('joinError',error.message);}
  }
  async function submitJoin(e){
    e.preventDefault();if(step<3){nextStep(step+1);return;}
    const button=$('#submitRequest');setError('joinError','');
    try{
      validateParent();const names=U.validateNames(syncNames('join'));
      const sender=$('#sender').value.trim(),phone=$('#phone').value.trim();
      if(!sender)throw Error('اكتب اسمك الرباعي في خانة «بياناتك أنت».');
      if(sender.split(/\s+/).length<4)throw Error('اكتب اسمك الرباعي: اسمك، اسم والدك، اسم جدك، واسم العائلة.');
      const digits=U.phoneDigits(phone);
      if(digits.length<8||digits.length>15)throw Error('اكتب رقم جوال صحيحًا حتى يستطيع المسؤول التواصل معك.');
      button.disabled=true;button.textContent='جارٍ إرسال الطلب…';lastSender=sender;lastPhone=phone;
      const result=await api('/rest/v1/rpc/family_submit_request',{method:'POST',body:{p_sender:sender,p_phone:phone,p_parent:unknown?null:$('#ancestor').value,p_context:unknown?$('#context').value.trim():'',p_names:names}});
      $('#form').reset();resetWizard();showReceipt(result,result.token);
    }catch(error){setError('joinError',error.message);}finally{button.disabled=false;button.textContent='إرسال الطلب إلى مسؤول العائلة';}
  }
  function resetWizard(){unknown=false;$('#unknownParent').setAttribute('aria-pressed','false');$('#unknownParentFields').classList.add('hidden');$('#joinParentSearch').value='';$('#ancestor').value='';paintRows('join');renderPicker('join');showStep(1,false);}
  document.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.review)openReview(b.dataset.review);
    if(b.dataset.reject){b.disabled=true;try{const rows=await api('/rest/v1/family_requests?id=eq.'+encodeURIComponent(b.dataset.reject)+'&status=eq.pending',{method:'PATCH',admin:true,prefer:'return=representation',body:{status:'rejected'}});if(!rows?.length)throw Error('تمت مراجعة هذا الطلب من قبل.');await refresh();showMessage('تم رفض الطلب.');}catch(error){showMessage(error.message);b.disabled=false;}}
    if(b.dataset.requestParent){navigate('tree');window.dispatchEvent(new CustomEvent('tree:focus',{detail:b.dataset.requestParent}));}
    if(b.dataset.pickParent){
      const review=b.dataset.picker==='review';$(review?'#reviewParent':'#ancestor').value=b.dataset.pickParent;
      if(!review){unknown=false;$('#unknownParent').setAttribute('aria-pressed','false');$('#unknownParentFields').classList.add('hidden');setError('joinError','');}
      renderPicker(review?'review':'join');
    }
    if(b.dataset.nextStep)nextStep(Number(b.dataset.nextStep));
    if(b.dataset.previousStep)showStep(Number(b.dataset.previousStep));
    if(b.dataset.removeName!==undefined){const kind=b.dataset.nameKind,values=rowValues(kind);if(values.length>1){values.splice(Number(b.dataset.removeName),1);paintRows(kind,values);}}
  });
  $('#requestFilters').addEventListener('change',renderRequests);
  $('#joinParentSearch').addEventListener('input',()=>renderPicker('join'));
  $('#reviewParentSearch').addEventListener('input',()=>renderPicker('review'));
  $('#reviewGrandparent').addEventListener('change',()=>{const parent=family($('#reviewParent').value).person;if($('#reviewGrandparent').value&&parent?.parent_id!==$('#reviewGrandparent').value)$('#reviewParent').value='';renderPicker('review');});
  $('#unknownParent').onclick=()=>{unknown=!unknown;$('#unknownParent').setAttribute('aria-pressed',String(unknown));$('#unknownParentFields').classList.toggle('hidden',!unknown);if(unknown){$('#ancestor').value='';$('#context').focus();}renderPicker('join');setError('joinError','');};
  $('#addJoinName').onclick=()=>addName('join');$('#addReviewName').onclick=()=>addName('review');
  document.addEventListener('input',e=>{if(e.target.matches('[data-name-kind]'))syncNames(e.target.dataset.nameKind);});
  $('#saveRequestDraft').onclick=saveDraft;$('#reviewForm').addEventListener('submit',approve);$('#form').addEventListener('submit',submitJoin);
  window.addEventListener('tree:render',()=>{renderRequests();renderPicker('join');if($('#reviewDialog').open){syncReviewOptions();renderPicker('review');}});
  window.FamilyContributions={renderRequests};
  paintRows('review');resetWizard();renderRequests();
})();
