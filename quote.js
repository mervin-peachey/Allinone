// ── Quote PDF Generator ─────────────────────────────────────────────────────
// Matches the Python quote_app.py output using jsPDF

let quoteShedImageDataURL = null;

function handleQuotePhoto(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    quoteShedImageDataURL = e.target.result;
    document.getElementById('q-drop-name').textContent = '✅ ' + file.name;
  };
  reader.readAsDataURL(file);
}

// ── Floor plan drawing ──────────────────────────────────────────────────────
function drawFloorPlan(ctx, widthFt, depthFt, btype, rstyle, boxW, boxH) {
  const MAX = Math.min(boxW, boxH) * 0.85;
  const scale = Math.min(MAX / widthFt, MAX / depthFt);
  const pw = widthFt * scale, ph = depthFt * scale;
  const ox = (boxW - pw) / 2, oy = (boxH - ph) / 2;

  // Colors
  const FLOOR   = '#F0EDE8', WALL  = '#3A3A3A', DOOR = '#8B6914';
  const LOFT    = '#D4C5A0', LOFT2 = '#B8A070', PORCH = '#E0D8C8';
  const WIN     = '#AED6F1', GRID  = '#E0D8D0';

  // Grid
  ctx.strokeStyle = GRID; ctx.lineWidth = 0.5;
  const step = scale;
  for (let x = ox; x <= ox+pw; x += step) { ctx.beginPath(); ctx.moveTo(x,oy); ctx.lineTo(x,oy+ph); ctx.stroke(); }
  for (let y = oy; y <= oy+ph; y += step) { ctx.beginPath(); ctx.moveTo(ox,y); ctx.lineTo(ox+pw,y); ctx.stroke(); }

  const isDeluxe = rstyle.toLowerCase().includes('deluxe') || rstyle.toLowerCase().includes('7/12');
  const isBarn   = rstyle.toLowerCase().includes('barn');
  const isCabin  = btype.toLowerCase().includes('cabin');
  const isGarage = btype.toLowerCase().includes('garage');

  // Porch for cabin
  const porchDepth = isCabin ? 6*scale : 0;

  // Main floor
  ctx.fillStyle = FLOOR; ctx.strokeStyle = WALL; ctx.lineWidth = 2;
  ctx.fillRect(ox, oy+porchDepth, pw, ph-porchDepth);
  ctx.strokeRect(ox, oy+porchDepth, pw, ph-porchDepth);

  // Porch
  if (isCabin && porchDepth > 0) {
    ctx.fillStyle = PORCH;
    ctx.fillRect(ox, oy, pw, porchDepth);
    ctx.strokeStyle = WALL; ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, pw, porchDepth);
  }

  // Loft
  if (isDeluxe || isBarn) {
    const loftDepth = 6*scale;
    ctx.fillStyle = LOFT;
    ctx.fillRect(ox+2, oy+porchDepth+2, pw-4, loftDepth-2);
    ctx.strokeStyle = WALL; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
    ctx.strokeRect(ox+2, oy+porchDepth+2, pw-4, loftDepth-2);
    ctx.setLineDash([]);
  }
  if (isBarn) {
    const l2 = 6*scale;
    ctx.fillStyle = LOFT2;
    ctx.fillRect(ox+pw-l2-2, oy+porchDepth+2, l2-2, ph-porchDepth-4);
    ctx.strokeStyle = WALL; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
    ctx.strokeRect(ox+pw-l2-2, oy+porchDepth+2, l2-2, ph-porchDepth-4);
    ctx.setLineDash([]);
  }

  // Door
  const doorW = isGarage ? Math.min(9*scale, pw*0.7) : Math.min(6*scale, pw*0.45);
  const doorX = ox + (pw - doorW) / 2;
  const doorY = oy + ph - 2;
  ctx.fillStyle = DOOR;
  ctx.fillRect(doorX, doorY - 8, doorW, 10);

  // Door swing arc
  if (!isGarage) {
    ctx.strokeStyle = DOOR; ctx.lineWidth = 1;
    ctx.setLineDash([3,2]);
    ctx.beginPath();
    ctx.arc(doorX, doorY - 3, doorW*0.5, -Math.PI*0.5, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(doorX+doorW, doorY - 3, doorW*0.5, -Math.PI, -Math.PI*0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Windows
  ctx.fillStyle = WIN; ctx.strokeStyle = WALL; ctx.lineWidth = 1;
  const winW = 2*scale, winH = 8;
  const winsPerSide = Math.max(1, Math.floor(widthFt/8));
  for (let w=0; w<winsPerSide; w++) {
    const wx = ox + (w+1)*pw/(winsPerSide+1) - winW/2;
    ctx.fillRect(wx, oy+porchDepth+4, winW, winH);
    ctx.strokeRect(wx, oy+porchDepth+4, winW, winH);
  }

  // Dimension labels
  ctx.fillStyle = '#6B1A1A'; ctx.font = 'bold 11px Helvetica';
  ctx.textAlign = 'center';
  ctx.fillText(`${widthFt} ft`, ox+pw/2, oy-6);
  ctx.save(); ctx.translate(ox-14, oy+ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText(`${depthFt} ft`, 0, 0); ctx.restore();
}

// ── RTO table calculation ───────────────────────────────────────────────────
function calcRTOTable(price, taxRate) {
  const taxed = price * (1 + taxRate);
  const rows = [];
  for (const [months, div] of [[27,27],[36,32],[48,38],[60,45]]) {
    rows.push({ months, payment: (taxed/div).toFixed(2) });
  }
  return rows;
}

// ── Main quote PDF ──────────────────────────────────────────────────────────
async function generateQuote() {
  const name = document.getElementById('q-name').value.trim();
  if (!name) { showStatus('q-status','Please enter a customer name.','err'); return; }

  const price   = parseFloat((document.getElementById('q-price').value||'').replace(/[^\d.]/g,'')) || 0;
  const state   = document.getElementById('q-state').value;
  const taxRate = state === 'MI' ? 0.06 : 0.07;
  const btype   = document.getElementById('q-type').value;
  const rstyle  = document.getElementById('q-roof').value;
  const size    = document.getElementById('q-size').value.trim();
  const zip     = document.getElementById('q-zip').value.trim();
  const notes   = document.getElementById('q-notes').value.trim();
  const locName = document.getElementById('q-loc-name').value.trim();
  const locAddr = document.getElementById('q-loc-address').value.trim();
  const locPhone= document.getElementById('q-loc-phone').value.trim();

  showStatus('q-status','Generating PDF…','');

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'letter' });
    const PW = 612, PH = 792;
    const ML=54, MR=54, MT=54, MB=54;
    const CW = PW-ML-MR;
    const MAROON = '#6B1A1A', MAROON_LIGHT = '#F5EDED';
    const GRAY = '#CCCCCC', DGRAY = '#333333';

    // ── PAGE 1 ──────────────────────────────────────────────────────────────
    const drawHdr = (pageLabel) => {
      // Logo
      if (typeof IMG_LOGOBLACK !== 'undefined') {
        try { doc.addImage(IMG_LOGOBLACK,'PNG',ML,MT-10,160,53); } catch(e){}
      }
      // Location info top center
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(MAROON);
      doc.text(locName, PW/2, MT+12, {align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(DGRAY);
      doc.text(locAddr, PW/2, MT+28, {align:'center'});
      doc.text(locPhone, PW/2, MT+43, {align:'center'});
      // Page label right
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(MAROON);
      doc.text(pageLabel, PW-MR, MT+12, {align:'right'});
      // Rule
      doc.setDrawColor(MAROON); doc.setLineWidth(2);
      doc.line(ML, MT+58, PW-MR, MT+58);
    };

    drawHdr('');

    let y = MT + 72;

    // Title
    doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor(MAROON);
    doc.text('CUSTOMER QUOTE', ML, y); y += 28;

    // Customer info section
    const drawSection = (title, rows, startY) => {
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(MAROON);
      doc.text(title, ML, startY); startY += 4;
      doc.setDrawColor(MAROON); doc.setLineWidth(1.5); doc.line(ML, startY, PW-MR, startY); startY += 12;
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(DGRAY);
      for (const [label,val] of rows) {
        doc.setFont('helvetica','bold'); doc.text(label+':', ML, startY);
        doc.setFont('helvetica','normal'); doc.text(String(val), ML+160, startY);
        startY += 16;
      }
      return startY + 6;
    };

    const today = new Date();
    const exp   = new Date(today); exp.setDate(exp.getDate()+15);
    const fmt   = d => d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

    y = drawSection('Customer Information', [
      ['Customer Name', name],
      ['ZIP Code', zip||'—'],
      ['Quote Date', fmt(today)],
      ['Quote Expires', fmt(exp)],
    ], y);

    y = drawSection('Building Specifications', [
      ['Size', size],
      ['Type', btype],
      ['Roof Style', rstyle],
    ], y);

    // Pricing table
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(MAROON);
    doc.text('Pricing', ML, y); y += 4;
    doc.setDrawColor(MAROON); doc.setLineWidth(1.5); doc.line(ML,y,PW-MR,y); y+=12;

    const taxed   = price*(1+taxRate);
    const pRows = [
      ['Building Price', `$${price.toLocaleString('en-US',{minimumFractionDigits:2})}`],
      [`Tax (${(taxRate*100).toFixed(0)}%)`, `$${(price*taxRate).toLocaleString('en-US',{minimumFractionDigits:2})}`],
      ['Total', `$${taxed.toLocaleString('en-US',{minimumFractionDigits:2})}`],
    ];

    const colW = CW/2;
    // Header row
    doc.setFillColor(MAROON); doc.rect(ML,y-10,CW,16,'F');
    doc.setTextColor('#FFFFFF'); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Item', ML+6, y+1); doc.text('Amount', ML+colW+6, y+1); y+=16;

    for(let i=0;i<pRows.length;i++){
      const [label,val]=pRows[i];
      const isTotal=label==='Total';
      if(isTotal){ doc.setFillColor(MAROON_LIGHT); doc.rect(ML,y-10,CW,15,'F'); }
      else if(i%2===0){ doc.setFillColor('#FAFAFA'); doc.rect(ML,y-10,CW,15,'F'); }
      doc.setTextColor(isTotal?MAROON:DGRAY); doc.setFont('helvetica', isTotal?'bold':'normal'); doc.setFontSize(10);
      doc.text(label, ML+6, y); doc.text(val, ML+colW+6, y); y+=15;
    }
    y+=10;

    // RTO table
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(MAROON);
    doc.text('Rent-to-Own Options', ML, y); y+=4;
    doc.setDrawColor(MAROON); doc.setLineWidth(1.5); doc.line(ML,y,PW-MR,y); y+=12;

    const rtoRows = calcRTOTable(price, taxRate);
    const rtoColW = CW/4;
    doc.setFillColor(MAROON); doc.rect(ML,y-10,CW,16,'F');
    doc.setTextColor('#FFFFFF'); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    ['Term','Monthly Payment','Total RTO Cost','Savings vs Cash'].forEach((h,i)=>{
      doc.text(h, ML+rtoColW*i+6, y+1);
    }); y+=16;

    rtoRows.forEach((r,i)=>{
      if(i%2===0){ doc.setFillColor('#FAFAFA'); doc.rect(ML,y-10,CW,15,'F'); }
      doc.setTextColor(DGRAY); doc.setFont('helvetica','normal'); doc.setFontSize(10);
      const total=(parseFloat(r.payment)*r.months).toFixed(2);
      const savings=(parseFloat(total)-taxed).toFixed(2);
      [r.months+' months','$'+r.payment,'$'+total,'$'+savings].forEach((v,ci)=>{
        doc.text(v, ML+rtoColW*ci+6, y);
      }); y+=15;
    }); y+=12;

    // Notes
    if(notes){
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(MAROON);
      doc.text('Notes', ML, y); y+=4;
      doc.setDrawColor(MAROON); doc.setLineWidth(1.5); doc.line(ML,y,PW-MR,y); y+=12;
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(DGRAY);
      const noteLines = doc.splitTextToSize(notes, CW-10);
      doc.text(noteLines, ML, y); y+=noteLines.length*14+10;
    }

    // Terms
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor('#999999');
    const terms = 'This quote is valid for 15 days. Prices subject to change. RTO rates are estimates and subject to approval. Tax rates based on state of delivery.';
    const tLines = doc.splitTextToSize(terms, CW);
    doc.text(tLines, ML, PH-MB-20);

    // ── PAGE 2 — FLOOR PLAN ──────────────────────────────────────────────────
    doc.addPage();
    drawHdr('FLOOR PLAN');

    // Parse size
    const sizeNums = (size||'').match(/\d+(?:\.\d+)?/g);
    const wFt = sizeNums ? parseFloat(sizeNums[0]) : 12;
    const dFt = sizeNums ? parseFloat(sizeNums[1]||sizeNums[0]) : 16;

    // Draw floor plan on a canvas, then add to PDF
    const fpCanvas = document.createElement('canvas');
    fpCanvas.width = 400; fpCanvas.height = 400;
    const fpCtx = fpCanvas.getContext('2d');
    fpCtx.fillStyle = '#FFFFFF'; fpCtx.fillRect(0,0,400,400);
    drawFloorPlan(fpCtx, wFt, dFt, btype, rstyle, 400, 400);
    const fpImg = fpCanvas.toDataURL('image/png');

    const fpY = MT+70;
    doc.addImage(fpImg,'PNG', ML+(CW-280)/2, fpY, 280, 280);

    // Customer summary below floor plan
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(DGRAY);
    doc.text(`Customer: ${name}   |   Size: ${size}   |   Type: ${btype.split('(')[0].trim()}`, ML, fpY+295);

    // Legend
    const legend = [
      {color:'#F0EDE8',label:'Floor Area'},
      {color:'#8B6914',label:'Door'},
      {color:'#AED6F1',label:'Window'},
      {color:'#D4C5A0',label:'Loft'},
    ];
    let lx = ML, ly = fpY+315;
    doc.setFontSize(9);
    for (const {color,label} of legend) {
      doc.setFillColor(color); doc.rect(lx,ly-8,12,10,'F');
      doc.setDrawColor('#999'); doc.setLineWidth(0.5); doc.rect(lx,ly-8,12,10,'S');
      doc.setTextColor(DGRAY); doc.text(label, lx+16, ly);
      lx += doc.getTextWidth(label)+36;
    }

    // ── PAGE 3 — SHED IMAGE ──────────────────────────────────────────────────
    doc.addPage();
    drawHdr('BUILDING ILLUSTRATION');

    const imgSrc = quoteShedImageDataURL || (typeof IMG_SHEDDEFAULT !== 'undefined' ? IMG_SHEDDEFAULT : null);
    if (imgSrc) {
      try {
        // Fit image to page width maintaining aspect ratio
        const tmpImg = new Image();
        await new Promise(res => { tmpImg.onload=res; tmpImg.onerror=res; tmpImg.src=imgSrc; });
        const aspect = tmpImg.naturalHeight/tmpImg.naturalWidth || 0.75;
        const imgW = CW, imgH = Math.min(imgW*aspect, PH-MT-MB-100);
        doc.addImage(imgSrc,'PNG', ML, MT+70, imgW, imgH);
        doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor('#999999');
        doc.text('not to scale', PW-MR, MT+70+imgH+14, {align:'right'});
      } catch(e) {}
    }

    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(DGRAY);
    doc.text(`${name} — ${size} ${btype.split('(')[0].trim()}`, ML, PH-MB-20);

    // Save
    doc.save(`${name.replace(/\s+/g,'_')}_Quote.pdf`);
    showStatus('q-status',`✅ Downloaded: ${name.replace(/\s+/g,'_')}_Quote.pdf`,'ok');

  } catch(e) {
    console.error(e);
    showStatus('q-status','❌ Error: '+e.message,'err');
  }
}
