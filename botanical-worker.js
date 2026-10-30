/* Layout runs off the UI thread so large families do not block pan/zoom or close. */
importScripts('botanical-theme.js','botanical-layout.js');
self.onmessage=event=>{
 try{const result=self.FamilyBotanical.svg(event.data,self.FamilyBotanicalTheme);self.postMessage({svg:result.svg,layout:{width:result.layout.width,height:result.layout.height,nodes:result.layout.nodes.map(n=>({id:n.id}))}});}
 catch(error){self.postMessage({error:error.message||'تعذر ترتيب الفروع.'});}
};
