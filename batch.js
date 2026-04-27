// ── Batch Import ────────────────────────────────────────────────────────────

const PREFIX_MAP = {
  'CCPA':'Cape Cod','DCPA':'Deluxe Cabin','DUPA':'Deluxe Utility',
  'GHPA':'Greenhouse','GPA':'Portable Garage','GSPA':'Garden Shed',
  'LGSPA':'Lofted Garden Shed','LPA':'Lofted Barn','UPA':'Utility',
  'BPA':'Barn','CPA':'Cabin','CSPA':'Cottage Shed','GLPA':'Lofted Garage','LCPA':'Lofted Cabin'
};

let batchRows = [];
let editingRowIdx = null;

function parseInventoryNumber(inv) {
  const parts = inv.trim().split('-');
  if (parts.length < 2) return {prefix:'',style:'Unknown',size:''};
  const prefix = parts[0].toUpperCase();
  const style  = PREFIX_MAP[prefix] || prefix;
  const raw    = parts[1];
  let size = raw;
  if (raw.length===4) size = `${raw.slice(0,2)}x${raw.slice(2)}`;
  else if (raw.length===3) size = `${raw[0]}x${raw.slice(1)}`;
  return {prefix, style, size};
}

function cleanPrice(val) {
  const n = parseFloat((val||'').replace(/[^\d.]/g,''));
  return isNaN(n) ? 0 : n;
}

function importCSV() {
  document.getElementById('csv-input').click();
}

function loadCSV(input) {
  const file = input.files[0];
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete(results) {
      batchRows = [];
      const loc = getActiveLocation();
      for (const row of results.data) {
        const inv = (row['Inventory Number']||'').trim();
        if (!inv) continue;
        const {style, size} = parseInventoryNumber(inv);
        const subtotal = cleanPrice(row['Subtotal']||'0');
        const wall = (row['Wall Color']||'').trim();
        const trim = (row['Trim Color']||'').trim();
        const color = [wall,trim].filter(Boolean).join(' / ');
        batchRows.push({
          serial: inv, style, size, color,
          cash_price: subtotal ? `$${subtotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '',
          rto_price:  subtotal ? `$${(subtotal/27).toFixed(2)}/mo` : '',
          product_url: '',
          photo_path: '',
          photoDataURL: null,
          show_qr: loc.qr_default !== false,
          selected: true,
        });
      }
      renderBatchTable();
      document.getElementById('batch-info').textContent = `${batchRows.length} sheds loaded`;
      input.value = '';
    },
    error(e) { alert('CSV error: '+e.message); }
  });
}

function renderBatchTable() {
  const tbody = document.getElementById('batch-tbody');
  tbody.innerHTML = '';
  batchRows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.className = row.selected ? 'row-checked' : 'row-unchecked';
    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" ${row.selected?'checked':''} onchange="toggleRow(${i},this.checked)"></td>
      <td>${row.serial}</td>
      <td>${row.style}</td>
      <td>${row.size}</td>
      <td>${row.color}</td>
      <td>${row.cash_price}</td>
      <td><span class="badge ${row.photoDataURL||row.photo_path?'badge-ok':'badge-no'}">${row.photoDataURL||row.photo_path?'✓ set':'— none'}</span></td>
      <td><span class="badge ${row.product_url?'badge-ok':'badge-no'}">${row.product_url?'✓ set':'— none'}</span></td>`;
    tr.addEventListener('dblclick', () => openEditModal(i));
    tbody.appendChild(tr);
  });
}

function toggleRow(i, checked) {
  batchRows[i].selected = checked;
  renderBatchTable();
}

function selectAllBatch(val) {
  batchRows.forEach(r => r.selected = val);
  renderBatchTable();
}

// ── Edit Modal ──────────────────────────────────────────────────────────────

function openEditModal(i) {
  editingRowIdx = i;
  const row = batchRows[i];
  document.getElementById('modal-title').textContent = `Edit — ${row.serial}`;
  document.getElementById('m-size').value  = row.size || '';
  document.getElementById('m-style').value = row.style || '';
  document.getElementById('m-cash').value  = row.cash_price || '';
  document.getElementById('m-rto').value   = row.rto_price || '';
  document.getElementById('m-url').value   = row.product_url || '';
  document.getElementById('m-qr').checked  = row.show_qr !== false;
  document.getElementById('m-photo-display').value = row.photo_path || '';
  document.getElementById('edit-modal').style.display = 'flex';
}

function handleModalPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('m-photo-display').value = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    if (editingRowIdx !== null) batchRows[editingRowIdx]._pendingPhotoDataURL = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveModal() {
  if (editingRowIdx === null) return;
  const row = batchRows[editingRowIdx];
  row.size        = document.getElementById('m-size').value.trim();
  row.style       = document.getElementById('m-style').value.trim();
  row.cash_price  = document.getElementById('m-cash').value.trim();
  row.rto_price   = document.getElementById('m-rto').value.trim();
  row.product_url = document.getElementById('m-url').value.trim();
  row.show_qr     = document.getElementById('m-qr').checked;
  if (row._pendingPhotoDataURL) {
    row.photoDataURL = row._pendingPhotoDataURL;
    row.photo_path = document.getElementById('m-photo-display').value;
    delete row._pendingPhotoDataURL;
  }
  closeModal();
  renderBatchTable();
}

function closeModal() {
  document.getElementById('edit-modal').style.display = 'none';
  editingRowIdx = null;
}

// ── Batch PDF Generation ────────────────────────────────────────────────────

async function generateBatch() {
  const selected = batchRows.filter(r => r.selected);
  if (!selected.length) { showStatus('batch-status','Select at least one shed.','err'); return; }

  const loc = getActiveLocation();
  const features = appSettings.features || document.getElementById('g-features').value;

  showStatus('batch-status',`Generating ${selected.length} stickers…`,'');

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'landscape', unit:'pt', format:'letter' });
    const W=792, H=612;

    for (let i=0; i<selected.length; i++) {
      if (i > 0) doc.addPage('letter','landscape');
      showStatus('batch-status',`Generating ${i+1} of ${selected.length}…`,'');
      const row = selected[i];
      await buildStickerPage(doc, {
        ...row,
        contacts: loc.contacts || '',
        tagline:  loc.tagline  || 'FREE DELIVERY & SETUP UP TO 50 MILES',
        features,
      }, W, H);
    }

    const date = new Date().toISOString().slice(0,10);
    doc.save(`Window_Stickers_${date}.pdf`);
    showStatus('batch-status',`✅ ${selected.length} stickers downloaded as one PDF`,'ok');
  } catch(e) {
    console.error(e);
    showStatus('batch-status','❌ Error: '+e.message,'err');
  }
}
