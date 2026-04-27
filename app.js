// ── App Bootstrap ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  // Populate location selects
  refreshLocationSelects();

  // Apply active location to generate tab
  const gLocSel = document.getElementById('g-location-select');
  if (gLocSel) {
    gLocSel.value = appSettings.active_location || 0;
    applyLocationToGenerate();
  }
  const sLocSel = document.getElementById('s-active-loc');
  if (sLocSel) sLocSel.value = appSettings.active_location || 0;

  // Settings features text
  const featEl = document.getElementById('s-features');
  if (featEl) featEl.value = appSettings.features || '';

  // Photo upload handlers
  const gPhotoInput = document.getElementById('g-photo-input');
  if (gPhotoInput) gPhotoInput.addEventListener('change', () => handleStickerPhoto(gPhotoInput));

  const qPhotoInput = document.getElementById('q-photo-input');
  if (qPhotoInput) qPhotoInput.addEventListener('change', () => handleQuotePhoto(qPhotoInput));

  // Drag-and-drop on generate drop zone
  const gDrop = document.getElementById('g-drop-zone');
  if (gDrop) {
    gDrop.addEventListener('dragover', e => { e.preventDefault(); gDrop.style.borderColor='#502020'; });
    gDrop.addEventListener('dragleave', () => { gDrop.style.borderColor=''; });
    gDrop.addEventListener('drop', e => {
      e.preventDefault(); gDrop.style.borderColor='';
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        gPhotoInput.files = e.dataTransfer.files;
        handleStickerPhoto(gPhotoInput);
      }
    });
  }

  // Close modal on overlay click
  document.getElementById('edit-modal')?.addEventListener('click', e => {
    if (e.target.id === 'edit-modal') closeModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
});

// Expose IMG constants for logo (aliased from images.js)
// images.js defines: IMG_LOGOWHITE, IMG_LOGOBLACK, IMG_QRLOGO, IMG_SHEDDEFAULT
