(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FamilyRequestUtils=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const escapeHTML=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const unreadNotifications=(requests,locallyRead=new Set())=>requests.filter(request=>!request.notification_read_at&&!locallyRead.has(request.id));
  const inviteLink=code=>code?'https://aljarallah.vercel.app/#i='+encodeURIComponent(code):'';
  const normalize=value=>String(value||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').trim().toLowerCase();
  function namesFromRequest(request){
    if(Array.isArray(request.proposed_names))return request.proposed_names.map(x=>String(x??'').trim()).filter(Boolean);
    return String(request.details||'').split(/\r?\n|\\n/).map(x=>x.trim()).filter(Boolean);
  }
  function validateNames(values){
    const names=values.map(x=>String(x??'').trim());
    if(!names.length||names.length>50)throw Error('أضف اسمًا واحدًا على الأقل، وبحد أقصى ٥٠ اسمًا.');
    if(names.some(x=>!x))throw Error('توجد خانة اسم فارغة. اكتب الاسم أو احذف الخانة.');
    if(names.some(x=>x.length>100||/[\r\n،,؛;:]/.test(x)))throw Error('اكتب اسمًا واحدًا في كل خانة، وبحد أقصى ١٠٠ حرف للاسم.');
    const seen=new Set();for(const name of names){const key=normalize(name).replace(/\s/g,'');if(seen.has(key))throw Error('الاسم «'+name+'» مكرر في هذا الطلب. احذف النسخة المكررة.');seen.add(key);}
    return names;
  }
  const phoneDigits=value=>String(value||'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g,'');
  function dateParts(iso){
    const date=new Date(iso);if(!iso||Number.isNaN(date.valueOf()))return{date:'غير متاح',time:''};
    return{date:new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Riyadh'}).format(date),time:new Intl.DateTimeFormat('ar-SA',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Riyadh'}).format(date)};
  }
  function ancestry(person,people,max=30){
    const index=new Map(people.map(p=>[String(p.id),p])),names=[],seen=new Set();
    let current=person;
    while(current&&names.length<max&&!seen.has(String(current.id))){
      seen.add(String(current.id));names.push(String(current.name||'').trim());
      current=current.parent_id?index.get(String(current.parent_id)):null;
    }
    return names.filter(Boolean);
  }
  const fullName=(person,people)=>ancestry(person,people).join(' بن ');
  const childFullName=(name,parent,people)=>[String(name||'').trim(),...(parent?ancestry(parent,people):[])].filter(Boolean).join(' بن ');
  function lineage(person,people){const parent=people.find(p=>p.id===person?.parent_id),grandparent=people.find(p=>p.id===parent?.parent_id);return{person:person||null,parent:parent||null,grandparent:grandparent||null};}
  function findPeople(people,query,grandparentId=''){
    const terms=normalize(query).split(/\s+/).filter(term=>term&&term!=='بن'&&term!=='ابن');
    return people.filter(person=>{if(grandparentId&&person.parent_id!==grandparentId)return false;const text=normalize(fullName(person,people));return terms.every(t=>text.includes(t));});
  }
  return{ancestry,fullName,childFullName,normalize,namesFromRequest,validateNames,dateParts,lineage,findPeople,phoneDigits,escapeHTML,inviteLink,unreadNotifications};
});
