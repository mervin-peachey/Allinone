// ── Settings (localStorage) ────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  active_location: 0,
  locations: [
    {
      name: "Eagle Buildings of Goshen",
      contacts: "(574) 900-3144",
      tagline: "FREE DELIVERY & SETUP UP TO 50 MILES",
      qr_default: true,
    },
    {
      name: "Bridges Motor Sales",
      contacts: "Mike  (269) 362-5003\nGarry (269) 362-5001",
      tagline: "FREE DELIVERY & SETUP UP TO 50 MILES",
      qr_default: false,
    }
  ],
  features: `Features
Eagle Buildings Quality Includes-
16" OC Floor Joists with 4x6 Pressure Treated Skids
LP Prostruct Engineered Flooring with 10yr. Limited Warranty
LP Siding with 5/50yr Warranty
40yr Metal Roofing Warranty
7yr Craftsmanship Warranty
Free Delivery Within 50mi.`,
};

let appSettings = null;

function loadSettings() {
  try {
    const raw = localStorage.getItem('eagle_settings');
    appSettings = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  } catch(e) {
    appSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

function saveSettings() {
  // Collect location editors
  const locList = document.getElementById('s-locations-list');
  if (locList) {
    const editors = locList.querySelectorAll('.loc-editor');
    editors.forEach((ed, i) => {
      if (!appSettings.locations[i]) return;
      appSettings.locations[i].name     = ed.querySelector('.loc-name').value.trim();
      appSettings.locations[i].contacts = ed.querySelector('.loc-contacts').value.trim();
      appSettings.locations[i].tagline  = ed.querySelector('.loc-tagline').value.trim();
      appSettings.locations[i].qr_default = ed.querySelector('.loc-qr').checked;
    });
  }
  // Active location
  const activeSel = document.getElementById('s-active-loc');
  if (activeSel) appSettings.active_location = parseInt(activeSel.value) || 0;
  // Features
  const featEl = document.getElementById('s-features');
  if (featEl) appSettings.features = featEl.value;
  localStorage.setItem('eagle_settings', JSON.stringify(appSettings));
  refreshLocationSelects();
  applyLocationToGenerate();
}

function getActiveLocation() {
  const idx = appSettings.active_location || 0;
  return appSettings.locations[Math.min(idx, appSettings.locations.length - 1)] || {};
}

function refreshLocationSelects() {
  const locs = appSettings.locations;
  const names = locs.map((l, i) => `<option value="${i}">${l.name}</option>`);

  ['g-location-select', 's-active-loc'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = names.join('');
    el.value = cur || appSettings.active_location;
  });

  renderLocationEditors();
}

function renderLocationEditors() {
  const container = document.getElementById('s-locations-list');
  if (!container) return;
  container.innerHTML = '';
  appSettings.locations.forEach((loc, i) => {
    const div = document.createElement('div');
    div.className = 'loc-editor';
    div.innerHTML = `
      <div class="loc-editor-head">
        <span>Location ${i + 1}</span>
        ${appSettings.locations.length > 1 ? `<button class="btn-danger" onclick="deleteLocation(${i})">Delete</button>` : ''}
      </div>
      <div class="loc-editor-body">
        <div class="field"><label>Location Name</label><input class="loc-name" type="text" value="${esc(loc.name)}"></div>
        <div class="field"><label>Phone Numbers (one per line)</label><textarea class="loc-contacts" rows="2">${esc(loc.contacts)}</textarea></div>
        <div class="field"><label>Bottom Tagline</label><input class="loc-tagline" type="text" value="${esc(loc.tagline)}"></div>
        <label class="check-row"><input class="loc-qr" type="checkbox" ${loc.qr_default ? 'checked' : ''}><span>QR code ON by default</span></label>
      </div>`;
    container.appendChild(div);
  });
}

function addLocation() {
  appSettings.locations.push({
    name: `Location ${appSettings.locations.length + 1}`,
    contacts: "(574) 500-0000",
    tagline: "FREE DELIVERY & SETUP UP TO 50 MILES",
    qr_default: true,
  });
  refreshLocationSelects();
}

function deleteLocation(idx) {
  if (appSettings.locations.length <= 1) return alert("Need at least one location.");
  appSettings.locations.splice(idx, 1);
  if (appSettings.active_location >= appSettings.locations.length)
    appSettings.active_location = 0;
  refreshLocationSelects();
}

function applyLocationToGenerate() {
  const idx = parseInt(document.getElementById('g-location-select')?.value) || 0;
  const loc = appSettings.locations[Math.min(idx, appSettings.locations.length - 1)] || {};
  const contactsEl = document.getElementById('g-contacts');
  const taglineEl  = document.getElementById('g-tagline');
  const qrEl       = document.getElementById('g-qr');
  if (contactsEl) contactsEl.value = loc.contacts || '';
  if (taglineEl)  taglineEl.value  = loc.tagline  || 'FREE DELIVERY & SETUP UP TO 50 MILES';
  if (qrEl)       qrEl.checked     = loc.qr_default !== false;
}

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function showStatus(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'footer-status ' + (type || '');
  if (type === 'ok') setTimeout(() => { el.textContent = ''; el.className = 'footer-status'; }, 4000);
}
