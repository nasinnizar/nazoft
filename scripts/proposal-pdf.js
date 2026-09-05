(function(root){
  const defaults=[
    {description:'Professional fee for MISA investment registration and Saudi LLC incorporation, including post-incorporation portal registrations as per the scope of work.',quantity:1,price:25000},
    {description:'Parent Company (India)',quantity:1,price:15000},
    {description:'Subsidiary Company (USA)',quantity:1,price:5000},
    {description:'Subsidiary Company (UK)',quantity:1,price:5000},
    {description:'Saudi Government Fees (approximately). Actual amount to be paid by client directly.',quantity:1,price:6000}
  ];
  function totals(data){
    if(!Array.isArray(data.items)||!data.items.length||data.items.length>10)throw Error('Add between 1 and 10 services.');
    let subtotal=0;
    for(const item of data.items){
      if(!item.description?.trim()||item.description.length>600)throw Error('Each service needs a description of up to 600 characters.');
      if(!Number.isFinite(+item.quantity)||+item.quantity<=0||+item.quantity>100000||!Number.isFinite(+item.price)||+item.price<0||+item.price>100000000)throw Error('Enter valid quantities and non-negative prices.');
      subtotal+=Math.round(+item.quantity * +item.price * 100);
    }
    const discount=Math.round(+data.discount*100),vat=+data.vat;
    if(!Number.isFinite(discount)||discount<0||discount>subtotal||!Number.isFinite(vat)||vat<0||vat>100)throw Error('Check discount and VAT: discount cannot exceed subtotal.');
    const tax=Math.round((subtotal-discount)*vat/100);
    return {subtotal:subtotal/100,discount:discount/100,tax:tax/100,total:(subtotal-discount+tax)/100};
  }
  async function generate(data,template){
    const {PDFDocument,StandardFonts,rgb}=root.PDFLib;
    const amounts=totals(data),doc=await PDFDocument.load(template),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
    const ink=rgb(.08,.13,.14),green=rgb(0,.46,.40),white=rgb(1,1,1);
    const format=value=>Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const clean=value=>String(value||'').replace(/[\r\n]+/g,' ').trim();
    const text=(page,value,x,top,width,size=11,color=ink,face=font)=>{
      value=clean(value);let actual=size;
      try{while(face.widthOfTextAtSize(value,actual)>width&&actual>7)actual-=.25;
      if(face.widthOfTextAtSize(value,actual)>width)throw Error('Text is too long. Shorten the client or contact details.');
      page.drawText(value,{x,y:page.getHeight()-top-actual,size:actual,font:face,color});
      }catch(error){if(/WinAnsi/.test(error.message))throw Error('This template currently supports Latin text. Use Latin-script names for PDF export.');throw error;}
    };
    const cover=doc.getPage(0);
    text(cover,data.preparedBy,137.4,640,370,12,white);
    text(cover,data.designation,137.4,657,370,12,white);
    text(cover,data.preparerPhone,68,676,120,11,white);
    text(cover,data.preparerEmail,211.4,675,330,11,white);
    text(cover,data.preparedFor,141.3,723,400,11,white);
    text(cover,data.clientPhone,68.7,740,120,11,white);
    text(cover,data.clientEmail,211.4,740,330,11,white);
    text(cover,data.reference,99.8,773,82,10,white);
    text(cover,data.date,227.5,773,230,11,white);
    const page=doc.getPage(5),h=page.getHeight();
    const rect=(x,top,w,height,color)=>page.drawRectangle({x,y:h-top-height,width:w,height,color});
    rect(200,42,200,32,green);text(page,'Quotation',215,43,174,24,white,bold);
    text(page,`Client: ${data.preparedFor}`,32,98,530,11);
    text(page,`Proposed license: ${data.license}`,32,119,530,10);
    text(page,`Proposed structure: ${data.structure}`,32,139,530,10);
    text(page,`Date: ${data.date}`,32,160,260,10);text(page,`Ref: ${data.reference}`,330,160,230,10);
    let top=191;rect(32,top,531,30,green);
    [['No.',38,28],['Service description',70,290],['Qty',380,40],['Price',427,60],['SAR',510,48]].forEach(([v,x,w])=>text(page,v,x,top+8,w,10,white,bold));top+=30;
    function wrap(value,width,size){
      const lines=[];let line='';
      for(const word of clean(value).split(' ')){
        if(font.widthOfTextAtSize(word,size)>width)throw Error('A service description contains an overlong word. Please shorten it.');
        const candidate=line?`${line} ${word}`:word;
        if(font.widthOfTextAtSize(candidate,size)>width){lines.push(line);line=word;}else line=candidate;
      }
      if(line)lines.push(line);return lines;
    }
    for(const [index,item] of data.items.entries()){
      const lines=wrap(item.description,295,10),height=Math.max(32,lines.length*13+16);
      if(top+height>604)throw Error('The quotation is too long for this page. Shorten descriptions or combine services.');
      if(index%2===0)rect(32,top,531,height,rgb(.95,.98,.97));
      text(page,String(index+1),38,top+8,25,10);
      lines.forEach((line,i)=>text(page,line,70,top+8+i*13,295,10));
      text(page,item.quantity,380,top+8,35,10);text(page,format(item.price),424,top+8,66,9);text(page,format(item.quantity*item.price),496,top+8,63,9);
      top+=height;
    }
    top+=10;
    for(const [label,value] of [['Subtotal',amounts.subtotal],['Discount',amounts.discount],[`VAT (${data.vat}%)`,amounts.tax],['Total (SAR)',amounts.total]]){
      text(page,label,335,top,140,10,ink,label==='Total (SAR)'?bold:font);text(page,format(value),479,top,80,10,ink,bold);top+=19;
    }
    text(page,'Exclusions',42,top+10,500,13,green,bold);
    const exclusions=wrap(data.exclusions||'None specified.',510,10);
    if(top+35+exclusions.length*13>792)throw Error('Exclusions are too long for the quotation page.');
    exclusions.forEach((line,i)=>text(page,line,42,top+35+i*13,510,10));
    if(data.note?.trim()) {
      const noteTop=top+48+exclusions.length*13,lines=wrap(data.note,510,10);
      if(noteTop+22+lines.length*13>792)throw Error('The note is too long for the quotation page. Shorten the note or service descriptions.');
      text(page,'Note',42,noteTop,510,13,green,bold);
      lines.forEach((line,i)=>text(page,line,42,noteTop+22+i*13,510,10));
    }
    page.drawLine({start:{x:42,y:40},end:{x:554,y:40},thickness:.5,color:green});
    text(page,'Corprights',485,805,70,9,green,bold);text(page,'5',292,810,20,9);
    doc.setTitle(`Proposal ${data.reference}`);doc.setAuthor(data.preparedBy||'');doc.setSubject('Client proposal');
    return doc.save();
  }
  root.CrmProposalPdf={defaults,totals,generate};
})(typeof window==='undefined'?globalThis:window);
