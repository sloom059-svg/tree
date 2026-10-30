/* Single-page JPEG/PDF container. Rasterization is local; family data is never uploaded. */
(function(root){
  'use strict';
  function encode(jpeg,pixelWidth,pixelHeight){
    if(!(jpeg instanceof Uint8Array)||!jpeg.length||pixelWidth<=0||pixelHeight<=0)throw Error('تعذر تجهيز صورة PDF.');
    const encoder=new TextEncoder(),parts=[],offsets=[0];let length=0;
    function write(part){const bytes=typeof part==='string'?encoder.encode(part):part;parts.push(bytes);length+=bytes.length;}
    function object(id,content){offsets[id]=length;write(`${id} 0 obj\n`);write(content);write('\nendobj\n');}
    const longest=Math.min(3600,Math.max(1600,pixelWidth/3,pixelHeight/3));
    const scale=longest/Math.max(pixelWidth,pixelHeight),w=+(pixelWidth*scale).toFixed(3),h=+(pixelHeight*scale).toFixed(3);
    write('%PDF-1.4\n% botanical genealogy\n');
    object(1,'<< /Type /Catalog /Pages 2 0 R >>');
    object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    object(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Poster 4 0 R >> >> /Contents 5 0 R >>`);
    offsets[4]=length;write(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);write(jpeg);write('\nendstream\nendobj\n');
    const drawing=`q\n${w} 0 0 ${h} 0 0 cm\n/Poster Do\nQ\n`;
    object(5,`<< /Length ${encoder.encode(drawing).length} >>\nstream\n${drawing}endstream`);
    const xref=length;write('xref\n0 6\n0000000000 65535 f \n');
    for(let i=1;i<=5;i++)write(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
    write(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const output=new Uint8Array(length);let cursor=0;for(const part of parts){output.set(part,cursor);cursor+=part.length;}return output;
  }
  if(typeof module==='object'&&module.exports)module.exports={encode};else root.FamilyBotanicalPDF={encode};
})(typeof window==='undefined'?globalThis:window);
