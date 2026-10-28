const {test}=require('node:test');
const assert=require('node:assert/strict');
const U=require('../request-utils.js');
test('structured names take precedence; old literal newline requests still render individual names',()=>{
  assert.deepEqual(U.namesFromRequest({proposed_names:[' محمد ','صالح'],details:'ignored'}),['محمد','صالح']);
  assert.deepEqual(U.namesFromRequest({details:'محمد\\nصالح\nأحمد'}),['محمد','صالح','أحمد']);
});
test('name validation rejects empty, mixed and repeated rows before any submission',()=>{
  assert.deepEqual(U.validateNames([' محمد ','صالح']),['محمد','صالح']);
  for(const names of [[],[''],['محمد',' '],['خالد، فهد'],['محمد','مُحَمَّد'],Array(51).fill('ابن')])assert.throws(()=>U.validateNames(names));
});
test('same-name fathers can be found by their father/grandfather and by the chosen branch',()=>{
  const people=[{id:'root',name:'عبدالله'},{id:'a',name:'صالح',parent_id:'root'},{id:'b',name:'أحمد',parent_id:'root'},{id:'c',name:'محمد',parent_id:'a'},{id:'d',name:'محمد',parent_id:'b'}];
  assert.equal(U.findPeople(people,'محمد').length,2);
  assert.equal(U.findPeople(people,'محمد صالح')[0].id,'c');
  assert.equal(U.findPeople(people,'محمد','b')[0].id,'d');
  assert.equal(U.findPeople(people,'احمد')[0].id,'b');
});
test('request dates use Gregorian Saudi dates even across UTC midnight',()=>{
  const result=U.dateParts('2026-10-27T22:15:00Z');
  assert.match(result.date,/٢٨/);assert.match(result.date,/٢٠٢٦/);assert.match(result.time,/١:١٥/);
  assert.deepEqual(U.dateParts('invalid'),{date:'غير متاح',time:''});
});

test('editable names escape quotes and markup in input attributes',()=>{
  assert.equal(U.escapeHTML('" onfocus="test <tag> &'), '&quot; onfocus=&quot;test &lt;tag&gt; &amp;');
  assert.equal(U.phoneDigits('٠٥٠١٢٣٤٥٦٧'), '0501234567');
});

test('shared invitation links use a compact fragment on the canonical domain',()=>{
  const link=U.inviteLink('ExampleCode12345');
  assert.equal(link,'https://aljarallah.vercel.app/#i=ExampleCode12345');
  assert.equal(new URL(link).search,'');
  assert.equal(U.inviteLink(''),'');
});

test('unread notifications are independent of approval status and opening one preserves pending review',()=>{
  const pending={id:'pending',status:'pending',notification_read_at:null};
  const automatic={id:'automatic',status:'approved',notification_read_at:null};
  const readPending={id:'read',status:'pending',notification_read_at:'2026-10-28T12:00:00Z'};
  assert.deepEqual(U.unreadNotifications([pending,automatic,readPending]).map(r=>r.id),['pending','automatic']);
  assert.deepEqual(U.unreadNotifications([pending,automatic,readPending],new Set(['pending'])).map(r=>r.id),['automatic']);
  assert.equal(pending.status,'pending');
});
