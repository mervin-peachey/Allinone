// ── Sticker PDF Generator ──────────────────────────────────────────────────

let stickerPhotoDataURL = null;

function autoRTO(cashId, rtoId) {
  const raw = (document.getElementById(cashId)?.value || '').replace(/[$,\s]/g,'');
  const cash = parseFloat(raw);
  if (!isNaN(cash) && cash > 0) {
    const rto = (cash / 27).toFixed(2);
    const el = document.getElementById(rtoId);
    if (el) el.value = `$${parseFloat(rto).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}/mo`;
  }
}

function handleStickerPhoto(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    stickerPhotoDataURL = e.target.result;
    const prev = document.getElementById('g-photo-preview');
    const name = document.getElementById('g-drop-name');
    if (prev) { prev.src = stickerPhotoDataURL; prev.style.display = 'block'; }
    if (name) name.textContent = '✅ ' + file.name;
  };
  reader.readAsDataURL(file);
}

function makeQR(url) {
  return new Promise(resolve => {
    const holder = document.getElementById('qr-holder');
    holder.innerHTML = '';
    const div = document.createElement('div');
    holder.appendChild(div);
    try {
      new QRCode(div, {
        text: url || 'https://eaglebuildingsllc.com',
        width: 256, height: 256,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      setTimeout(() => {
        const canvas = div.querySelector('canvas');
        if (!canvas) { resolve(null); return; }
        // Overlay the Eagle Buildings logo
        const logo = new Image();
        logo.onload = () => {
          const c2 = document.createElement('canvas');
          c2.width = 256; c2.height = 256;
          const ctx = c2.getContext('2d');
          ctx.drawImage(canvas, 0, 0);
          const logoW = 256 * 0.22, logoH = logoW * 0.44;
          const lx = (256 - logoW) / 2, ly = (256 - logoH) / 2;
          ctx.fillStyle = 'white';
          ctx.fillRect(lx - 6, ly - 6, logoW + 12, logoH + 12);
          ctx.drawImage(logo, lx, ly, logoW, logoH);
          resolve(c2.toDataURL('image/png'));
        };
        logo.onerror = () => resolve(canvas.toDataURL('image/png'));
        logo.src = typeof IMG_QRLOGO !== 'undefined' ? IMG_QRLOGO : '';
      }, 300);
    } catch(e) { resolve(null); }
  });
}

function cropSquare(dataURL) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const sq = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = sq;
      c.getContext('2d').drawImage(img,
        (img.width-sq)/2, (img.height-sq)/2, sq, sq, 0, 0, sq, sq);
      resolve(c.toDataURL('image/jpeg', 0.9));
    };
    img.src = dataURL;
  });
}

async function buildStickerPage(doc, data, W, H) {
  const PAD = 26;
  const BRAND_HEX = '#502020';
  const BLACK = '#111111';
  const DGRAY = '#333333';
  const MGRAY = '#666666';
  const LGRAY = '#F0F0F0';
  const YELLOW = '#F5E642';

  const sf = hex => doc.setFillColor(hex);
  const st = hex => doc.setTextColor(hex);
  const sd = hex => doc.setDrawColor(hex);

  const fitFont = (text, size, maxW) => {
    let fs = size; doc.setFontSize(fs);
    while (doc.getTextWidth(text) > maxW && fs > 5) { fs -= 0.5; doc.setFontSize(fs); }
    return fs;
  };

  const wrapLines = (text, maxW) => {
    const words = text.split(' '), out = []; let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (doc.getTextWidth(test) <= maxW) line = test;
      else { if (line) out.push(line); line = w; }
    }
    if (line) out.push(line);
    return out;
  };

  const hline = (y, x0, x1, lw=1, col=BLACK) => {
    doc.setLineWidth(lw); sd(col); doc.line(x0, y, x1, y);
  };

  // White background
  sf('#FFFFFF'); doc.rect(0, 0, W, H, 'F');

  // Header bar
  const HDR_H = 70, HDR_BOT = H - HDR_H;
  sf(BRAND_HEX); doc.rect(0, HDR_BOT, W, HDR_H, 'F');

  // Logo in header
  if (typeof IMG_LOGOWHITE !== 'undefined') {
    try { doc.addImage(IMG_LOGOWHITE, 'PNG', PAD, HDR_BOT + 8, 160, 54); } catch(e) {}
  }

  // Title
  const title = `${(data.size||'').trim()}  ${(data.style||'').trim()}`.trim();
  doc.setFont('helvetica','bold');
  const fs_t = fitFont(title, 30, W - 200);
  st('#FFFFFF'); doc.setFontSize(fs_t);
  doc.text(title, W/2, HDR_BOT + (HDR_H + fs_t*0.35)/2, {align:'center'});
  hline(HDR_BOT, PAD, W-PAD, 1.5, BLACK);

  // Phone/contact band
  const contacts = (data.contacts||'').trim();
  const contactLines = contacts ? contacts.split('\n').map(l=>l.trim()).filter(Boolean) : ['(574) 900-3144'];
  const N = contactLines.length;
  const longest = contactLines.reduce((a,b) => a.length>b.length?a:b,'');
  let fs_ph;
  if (N===1) { doc.setFont('helvetica','bold'); fs_ph = Math.min(fitFont(contactLines[0],42,W-PAD*2-40),44); }
  else { const sw=(W-PAD*2)/N; doc.setFont('helvetica','bold'); fs_ph=Math.min(fitFont(longest,32,sw-20),34); }
  const BAND_H = fs_ph+22, FTR_TOP = BAND_H;

  // Tagline
  const tagline = (data.tagline||'FREE DELIVERY & SETUP UP TO 50 MILES').toUpperCase();
  doc.setFont('helvetica','bold');
  const fs_tag = Math.min(fitFont(tagline, fs_ph*0.9, W-PAD*2), fs_ph);
  doc.setFontSize(fs_tag); st(BLACK);
  doc.text(tagline, W/2, FTR_TOP/2 + fs_tag*0.35, {align:'center'});

  hline(FTR_TOP, 0, W, 4, BLACK);
  const PHONE_BOT = FTR_TOP+4, PHONE_TOP = PHONE_BOT+BAND_H;
  hline(PHONE_TOP, PAD, W-PAD, 1.5, BLACK);

  if (N===1) {
    const fsi = fitFont(contactLines[0], fs_ph, W-PAD*2-40);
    doc.setFont('helvetica','bold'); doc.setFontSize(fsi); st(BLACK);
    doc.text(contactLines[0], W/2, PHONE_BOT+(BAND_H+fsi*0.35)/2, {align:'center'});
  } else {
    const sw=(W-PAD*2)/N;
    contactLines.forEach((line,i) => {
      const cx=PAD+sw*i+sw/2;
      const fsi=fitFont(line,fs_ph,sw-20);
      doc.setFont('helvetica','bold'); doc.setFontSize(fsi); st(BLACK);
      doc.text(line, cx, PHONE_BOT+(BAND_H+fsi*0.35)/2, {align:'center'});
      if(i>0){hline(PHONE_TOP-3,PAD+sw*i,PAD+sw*i,0.5,'#CCCCCC');}
    });
  }

  // Content zone
  const CT=HDR_BOT-10, CB=PHONE_TOP+10, CH=CT-CB;
  const SPLIT=W/2-4;
  const LEFT_W=SPLIT-PAD, LEFT_CX=PAD+LEFT_W/2;
  const RIGHT_X=SPLIT+8, RIGHT_W=W-RIGHT_X-PAD, RIGHT_CX=RIGHT_X+RIGHT_W/2;

  const showQR = data.show_qr !== false;
  const featLines = (data.features||'').trim().split('\n');
  const bodyLines = featLines.slice(1).map(l=>l.trim()).filter(Boolean);

  let QR_SIZE=0, QR_BOT_Y=0, QR_TOP_Y=0, feat_space;
  if (showQR) {
    QR_SIZE=LEFT_W*0.28; QR_BOT_Y=CB+12; QR_TOP_Y=QR_BOT_Y+QR_SIZE+14;
    feat_space=(CT-20)-QR_TOP_Y;
  } else {
    feat_space=(CT-20)-(CB+16);
  }

  // Find best font size
  let TARGET_FS=10, TARGET_LG=5;
  outer: for(let fs=showQR?28:32;fs>=8;fs--){
    for(let lg=3;lg<=6;lg++){
      doc.setFontSize(fs); doc.setFont('helvetica','bold');
      let total=40;
      for(const ln of bodyLines){ total+=wrapLines(ln,LEFT_W-14).length*(fs+lg)+3; }
      if(total<=feat_space){TARGET_FS=fs;TARGET_LG=lg;break outer;}
    }
  }

  doc.setFontSize(TARGET_FS); doc.setFont('helvetica','bold');
  let block_h=40;
  for(const ln of bodyLines){ block_h+=wrapLines(ln,LEFT_W-14).length*(TARGET_FS+TARGET_LG)+3; }

  const anchor_y = showQR ? QR_TOP_Y : (CB+16);
  let fy = anchor_y+(feat_space-block_h)/2+block_h;
  const HEAD_SIZE = Math.round(TARGET_FS*1.25);

  if(featLines.length){
    doc.setFont('helvetica','bold'); doc.setFontSize(HEAD_SIZE); st(BLACK);
    doc.text(featLines[0].trim(), LEFT_CX, fy, {align:'center'});
    fy -= HEAD_SIZE*0.6+TARGET_FS+TARGET_LG;
  }
  for(const ln of bodyLines){
    const wrapped=wrapLines(ln,LEFT_W-14);
    doc.setFont('helvetica','bold'); doc.setFontSize(TARGET_FS); st(DGRAY);
    for(const wl of wrapped){ doc.text(wl,LEFT_CX,fy,{align:'center'}); fy-=TARGET_FS+TARGET_LG; }
    fy-=3;
  }

  // QR code
  if(showQR){
    const url=(data.product_url||'').trim()||'https://eaglebuildingsllc.com';
    const qrData = await makeQR(url);
    if(qrData){ try{ doc.addImage(qrData,'PNG',LEFT_CX-QR_SIZE/2,QR_BOT_Y,QR_SIZE,QR_SIZE); }catch(e){} }
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); st(MGRAY);
    doc.text('Scan to view this shed online',LEFT_CX,QR_BOT_Y-4,{align:'center'});
  }

  // Right: pricing
  const cash = (data.cash_price||'').trim();
  const cashNorm = cash ? (cash.startsWith('$')?cash:'$'+cash) : '';
  const priceText = cashNorm ? (cashNorm.toLowerCase().includes('+tax')?cashNorm:cashNorm+'+tax') : '';
  const rto = (data.rto_price||'').trim();
  const rtoLabel = rto ? `60 Month RTO - ${rto}${rto.toLowerCase().includes('+tax')?'':'+tax'}` : '';
  const serial = (data.serial||'').trim();

  let fs_p=10, fs_r=0, pill_h=0;
  if(priceText){ doc.setFont('helvetica','bold'); fs_p=Math.min(fitFont(priceText,120,RIGHT_W-4),CH*0.42*0.85); }
  if(rtoLabel){ doc.setFont('helvetica','bold'); fs_r=Math.min(fitFont(rtoLabel,30,RIGHT_W-16),CH*0.42*0.22); pill_h=fs_r+16; }

  const STOCK_H=26,GAP=6,GAP_S=10,PRICE_ZONE_H=CH*0.42;
  const block_bottom=CB+(PRICE_ZONE_H-fs_p-GAP-pill_h-STOCK_H-GAP_S)/2;

  if(rtoLabel){
    doc.setFont('helvetica','bold'); doc.setFontSize(fs_r);
    const pw=doc.getTextWidth(rtoLabel)+28;
    sf(YELLOW); doc.roundedRect(RIGHT_CX-pw/2,block_bottom,pw,pill_h,6,6,'F');
    st(BLACK); doc.text(rtoLabel,RIGHT_CX,block_bottom+fs_r*0.28+6,{align:'center'});
  }
  if(priceText){
    doc.setFont('helvetica','bold'); doc.setFontSize(fs_p); st(BLACK);
    doc.text(priceText,RIGHT_CX,block_bottom+pill_h+GAP+fs_p*0.75,{align:'center'});
  }
  const price_top_y=block_bottom+pill_h+GAP+fs_p;
  const stock_y=price_top_y+GAP_S+STOCK_H/2;
  if(serial){
    doc.setFont('helvetica','bold');
    const fs_s=fitFont(`Stock #${serial}`,13,RIGHT_W-8);
    doc.setFontSize(fs_s); st(DGRAY);
    doc.text(`Stock #${serial}`,RIGHT_CX,stock_y+fs_s*0.35,{align:'center'});
  }

  // Photo
  const photo_bot=stock_y+STOCK_H/2+GAP_S;
  const PHOTO_SIZE=Math.min(CT-photo_bot,RIGHT_W);
  const photo_x=RIGHT_X+(RIGHT_W-PHOTO_SIZE)/2;

  if(data.photoDataURL){
    try{
      const sq=await cropSquare(data.photoDataURL);
      doc.addImage(sq,'JPEG',photo_x,photo_bot,PHOTO_SIZE,PHOTO_SIZE);
    }catch(e){}
  }
  sf(LGRAY); doc.rect(photo_x,photo_bot,PHOTO_SIZE,PHOTO_SIZE,data.photoDataURL?'S':'F');
  sd('#BBBBBB'); doc.setLineWidth(0.5); doc.rect(photo_x,photo_bot,PHOTO_SIZE,PHOTO_SIZE);
  if(!data.photoDataURL){ doc.setFont('helvetica','normal'); doc.setFontSize(9); st(MGRAY); doc.text('Shed photo',RIGHT_CX,photo_bot+PHOTO_SIZE/2,{align:'center'}); }
}

async function generateSticker() {
  const size = document.getElementById('g-size').value.trim();
  if (!size) { showStatus('g-status','Please enter the shed size.','err'); return; }

  const loc = appSettings.locations[parseInt(document.getElementById('g-location-select').value)||0] || {};

  const data = {
    size, style: document.getElementById('g-style').value,
    serial: document.getElementById('g-serial').value.trim(),
    features: document.getElementById('g-features').value.trim(),
    cash_price: document.getElementById('g-cash').value.trim(),
    rto_price:  document.getElementById('g-rto').value.trim(),
    contacts: document.getElementById('g-contacts').value.trim() || loc.contacts || '',
    tagline:  document.getElementById('g-tagline').value.trim() || loc.tagline || '',
    product_url: document.getElementById('g-url').value.trim(),
    show_qr: document.getElementById('g-qr').checked,
    photoDataURL: stickerPhotoDataURL,
  };

  showStatus('g-status','Generating PDF…','');
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'landscape', unit:'pt', format:'letter' });
    const W=792, H=612;
    await buildStickerPage(doc, data, W, H);
    const serial_slug = (data.serial||'sticker').replace(/[/ ]/g,'-');
    const size_slug   = (data.size||'shed').replace(/\s/g,'');
    doc.save(`EagleBuildings_${size_slug}_${serial_slug}.pdf`);
    showStatus('g-status','✅ Downloaded!','ok');
  } catch(e) {
    console.error(e);
    showStatus('g-status','❌ Error: '+e.message,'err');
  }
}
