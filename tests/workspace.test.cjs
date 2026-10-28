const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

// A small DOM adapter tests pointer math and private request badges without a browser or live database.
function setup(){
  class Element{
    constructor(id){this.id=id;this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.disabled=false;this.listeners={};this.attrs={};this.clientWidth=1000;this.clientHeight=650;this.offsetWidth=600;this.offsetHeight=350;const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,force)=>{const add=force===undefined?!classes.has(x):force;add?classes.add(x):classes.delete(x);return add;}};}
    addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
    fire(type,event={}){this.listeners[type]?.forEach(fn=>fn({target:this,preventDefault(){},stopImmediatePropagation(){},...event}));}
    setAttribute(name,value){this.attrs[name]=String(value);}
    getBoundingClientRect(){return{left:0,top:0,width:100,height:60,bottom:60};}
    closest(){return null;}
    setPointerCapture(){}
    click(){this.onclick?.();}
  }
  const ids=new Map();const $=id=>{if(!ids.has(id))ids.set(id,new Element(id));return ids.get(id);};
  const listeners={};const frames=[];let fetches=0;
  const document={hidden:false,querySelectorAll:()=>[],addEventListener(type,fn){(listeners[type]??=[]).push(fn);}};
  const context={console,Date,Math,Map,Set,document,$,people:[{id:'root',name:'اختبار'}],session:{access_token:'test-only'},requests:[],ResizeObserver:class{observe(){}},CSS:{escape:s=>s},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame:()=>{},setInterval:()=>{},showTrash:async()=>{},showMessage:()=>{},api:async()=>{fetches++;return[{id:'request',status:'pending'}];}};
  context.window={FamilyRequestUtils:require('../request-utils.js'),addEventListener(type,fn){(listeners[type]??=[]).push(fn);},print(){}};
  function emit(type,detail){listeners[type]?.forEach(fn=>fn({detail}));}
  context.render=()=>emit('tree:render',{isAdmin:true,pending:1,count:1,hasAccess:true});
  vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../workspace.js'),'utf8'),context);
  return{$,emit,document,context,get fetches(){return fetches;},flush(){frames.splice(0).forEach(fn=>fn());}};
}

test('pending badge follows current administrator counts and hides at zero or for guests',()=>{
  const env=setup(),badge=env.$('#requestsBadge');
  assert.equal(badge.textContent,'1');assert.equal(badge.classList.contains('hidden'),false);
  env.emit('tree:render',{isAdmin:true,pending:0,count:1,hasAccess:true});assert.equal(badge.classList.contains('hidden'),true);
  env.emit('tree:render',{isAdmin:true,pending:12,count:1,hasAccess:true});assert.equal(badge.textContent,'12');assert.equal(badge.classList.contains('hidden'),false);
  env.emit('tree:render',{isAdmin:false,pending:12,count:1,hasAccess:true});assert.equal(badge.classList.contains('hidden'),true);
});

test('drag pans, wheel zoom stays anchored, and two pointers pinch around their midpoint',()=>{
  const env=setup(),canvas=env.$('#treeCanvas'),stage=env.$('#treeStage');
  canvas.fire('pointerdown',{button:0,pointerId:1,clientX:100,clientY:100});
  canvas.fire('pointermove',{pointerId:1,clientX:160,clientY:140});
  assert.equal(stage.style.transform,'translate(60px, 40px) scale(1)');
  canvas.fire('pointerup',{pointerId:1});
  canvas.fire('wheel',{deltaY:-100,deltaMode:0,clientX:200,clientY:200});
  const scale=Math.exp(.2);assert.equal(env.$('#zoomValue').textContent,'122%');
  assert.equal(stage.style.transform,`translate(${200-140*scale}px, ${200-160*scale}px) scale(${scale})`);
  canvas.fire('pointerdown',{button:0,pointerId:2,clientX:100,clientY:100});
  canvas.fire('pointerdown',{button:0,pointerId:3,clientX:200,clientY:100});
  canvas.fire('pointermove',{pointerId:3,clientX:300,clientY:100});
  assert.equal(env.$('#zoomValue').textContent,'244%');
  canvas.fire('pointercancel',{pointerId:2});canvas.fire('pointercancel',{pointerId:3});
  assert.equal(canvas.classList.contains('is-dragging'),false);
});

test('zoom is bounded and fit can recover a dragged tree',()=>{
  const env=setup();for(let i=0;i<50;i++)env.$('#zoomIn').click();
  assert.equal(env.$('#zoomValue').textContent,'250%');assert.equal(env.$('#zoomIn').disabled,true);
  for(let i=0;i<70;i++)env.$('#zoomOut').click();assert.equal(env.$('#zoomValue').textContent,'18%');assert.equal(env.$('#zoomOut').disabled,true);
  env.$('#zoomFit').click();assert.equal(env.$('#zoomValue').textContent,'100%');assert.equal(env.$('#treeStage').style.transform,'translate(200px, 160px) scale(1)');
});

test('polling skips guests and hidden tabs, refreshes pending requests for an active administrator',async()=>{
  const env=setup();
  env.emit('tree:render',{isAdmin:false,pending:0,count:0,hasAccess:false});env.emit('focus');assert.equal(env.fetches,0);
  env.emit('tree:render',{isAdmin:true,pending:0,count:1,hasAccess:true});env.document.hidden=true;env.emit('focus');assert.equal(env.fetches,0);
  env.document.hidden=false;env.emit('focus');await new Promise(resolve=>setImmediate(resolve));assert.equal(env.fetches,1);assert.equal(env.context.requests.length,1);assert.equal(env.$('#requestsBadge').textContent,'1');
});
