/* DOM References */
const dropTarget = document.getElementById('drop-target');
const mediaInput = document.getElementById('media-input');
const mediaContainer = document.getElementById('media-preview-container');
const mediaPreview = document.getElementById('media-preview');
const mediaFilename = document.getElementById('media-filename');

const tabImage = document.getElementById('tab-image');
const tabText = document.getElementById('tab-text');
const zoneImage = document.getElementById('zone-image');
const zoneText = document.getElementById('zone-text');
const textQuery = document.getElementById('text-query');

const btnExecute = document.getElementById('btn-execute');
const apiVault = document.getElementById('api-vault');
const logOutput = document.getElementById('log-output');

const secInput = document.getElementById('interface-input');
const secProcess = document.getElementById('interface-processing');
const secOutput = document.getElementById('interface-output');
const secError = document.getElementById('interface-error');
const errorMessage = document.getElementById('error-message');

/* State */
let selectedMedia = null;
let currentMode = 'image';

const API_KEY_DEFAULT = "AIzaSyBlqBbsR02Cw9fp8Z-RfFbJ_ej6UwcBdQc";

/* Initialization */
document.addEventListener('DOMContentLoaded', () => {
  apiVault.value = API_KEY_DEFAULT;

  if (dropTarget) {
    dropTarget.addEventListener('dragover', e => { e.preventDefault(); dropTarget.classList.add('drag-over'); });
    dropTarget.addEventListener('dragleave', () => dropTarget.classList.remove('drag-over'));
    dropTarget.addEventListener('drop', e => {
      e.preventDefault();
      dropTarget.classList.remove('drag-over');
      if (e.dataTransfer.files.length) handleMediaFile(e.dataTransfer.files[0]);
    });
  }

  if (mediaInput) {
    mediaInput.addEventListener('change', () => {
      if (mediaInput.files.length) handleMediaFile(mediaInput.files[0]);
    });
  }
});

function setMode(mode) {
  currentMode = mode;
  if (mode === 'image') {
    tabImage.classList.add('active');
    tabText.classList.remove('active');
    zoneImage.classList.remove('hidden');
    zoneText.classList.add('hidden');
  } else {
    tabText.classList.add('active');
    tabImage.classList.remove('active');
    zoneText.classList.remove('hidden');
    zoneImage.classList.add('hidden');
  }
  validateInput();
}

function handleMediaFile(file) {
  if (!file.type.startsWith('image/')) return;
  selectedMedia = file;
  mediaFilename.textContent = file.name;

  const reader = new FileReader();
  reader.onload = e => {
    mediaPreview.src = e.target.result;
    mediaContainer.classList.remove('hidden');
    document.getElementById('upload-copy-layer').classList.add('hidden');
    validateInput();
  }
  reader.readAsDataURL(file);
}

function clearMedia() {
  selectedMedia = null;
  mediaInput.value = '';
  mediaPreview.src = '';
  mediaContainer.classList.add('hidden');
  document.getElementById('upload-copy-layer').classList.remove('hidden');
  validateInput();
}

function validateInput() {
  let isValid = false;
  if (currentMode === 'image' && selectedMedia) isValid = true;
  if (currentMode === 'text' && textQuery.value.trim().length > 0) isValid = true;

  if (isValid) {
    btnExecute.classList.remove('disabled');
  } else {
    btnExecute.classList.add('disabled');
  }
}

function triggerError(msg) {
  errorMessage.textContent = msg;
  secProcess.classList.add('hidden');
  secInput.classList.add('hidden');
  secOutput.classList.add('hidden');
  secError.classList.remove('hidden');
}

function resetProtocol() {
  secError.classList.add('hidden');
  secOutput.classList.add('hidden');
  secProcess.classList.add('hidden');
  secInput.classList.remove('hidden');
  clearMedia();
  textQuery.value = '';
  validateInput();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Logging Animation */
const standardLogs = [
  "[ SYS ] Initiating molecular extraction...",
  "[ INF ] Transmitting geometry...",
  "[ OCR ] Decoding typographical syntax...",
  "[ AI ] Formulating structural equivalence...",
  "[ OK ] Compiling derived matrix..."
];

let logInterval;
function startLogs() {
  logOutput.innerHTML = '';
  let idx = 0;
  logInterval = setInterval(() => {
    if (idx < standardLogs.length) {
      const isOk = standardLogs[idx].includes('[ OK ]');
      const color = isOk ? '#A8D8A8' : '#A8C5A0';
      logOutput.innerHTML += `<div style="color:${color}">${standardLogs[idx]}</div>`;
      logOutput.scrollTop = logOutput.scrollHeight;
      idx++;
    }
  }, 700);
}

/* API Execution */
async function executeProtocol() {
  if (btnExecute.classList.contains('disabled')) return;
  const apiKey = apiVault.value.trim() || API_KEY_DEFAULT;

  secInput.classList.add('hidden');
  secProcess.classList.remove('hidden');
  startLogs();

  try {
    let base64Data = null;
    if (currentMode === 'image' && selectedMedia) {
      base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(selectedMedia);
      });
    }

    const promptText = `You are a clinical pharmacology assistant helping Indian patients find affordable generic equivalents.
${currentMode === 'text' ? `User Query: "${textQuery.value.trim()}"` : `A product image has been provided. Identify the product from the label/packaging.`}

TASK:
1. Identify the original branded dermatological/pharmaceutical product.
2. Find up to 3 cheaper generic equivalents available in India with the SAME active ingredient(s) and concentration.
3. For each generic, assign it to the BEST matching Indian e-pharmacy (1mg, PharmEasy, Apollo Pharmacy, or Netmeds).

IMPORTANT: Be medically accurate. Use real Indian brand names for generics. All prices in INR.

Return ONLY valid JSON — no markdown, no explanation:
{
  "original": {
    "brand_name": "Full Brand Name",
    "manufacturer": "Company Name",
    "active_ingredients": [{"name": "INN Name", "concentration": "0.1%"}],
    "route": "Topical",
    "form_factor": "Gel",
    "quantity": "15g",
    "estimated_price_inr": 850,
    "why_expensive": "One-line reason (brand premium, import duty, etc.)"
  },
  "alternatives": [
    {
      "rank": 1,
      "platform": "1mg",
      "product_name": "Generic Brand Name",
      "manufacturer": "Manufacturer Name",
      "active_ingredients": [{"name": "INN Name", "concentration": "0.1%"}],
      "form_factor": "Gel",
      "quantity": "15g",
      "price_inr": 180,
      "price_per_unit_inr": 12.0,
      "unit_label": "per gram",
      "savings_pct": 79,
      "savings_vs_original": 670,
      "bioequivalent": true,
      "prescription_required": false,
      "url": "https://www.1mg.com/search/all?name=GenericName"
    }
  ]
}`;

    let parts = [{ text: promptText }];
    if (currentMode === 'image' && base64Data) {
      parts.push({ inline_data: { mime_type: selectedMedia.type, data: base64Data } });
    }

    const requestBody = {
      contents: [{ parts }],
      generationConfig: { temperature: 0.1 }
    };

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await resp.json();
    clearInterval(logInterval);

    if (!resp.ok) {
      triggerError(data.error?.message || 'Protocol failure at Gemini endpoint.');
      return;
    }

    let rawResponse = data.candidates[0].content.parts[0].text;
    rawResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(rawResponse);

    renderOutput(parsedData);

  } catch (err) {
    clearInterval(logInterval);
    console.error(err);
    triggerError('Analysis unresolvable. Integrity check failed.');
  }
}

/* =====================
   PHARMACY URL BUILDER
   Returns a real search URL for the given platform + product name.
   Falls back to a Google search if the platform is unrecognised.
   ===================== */
function getPharmacyUrl(alt) {
  const raw = (alt.url || '').trim();
  // Use the AI-provided URL if it looks real (not a placeholder)
  if (raw && raw !== '#' && raw.startsWith('http')) return raw;

  const name = encodeURIComponent((alt.product_name || '').trim());
  const platform = (alt.platform || '').toLowerCase();

  if (platform.includes('1mg')) {
    return `https://www.1mg.com/search/all?name=${name}`;
  } else if (platform.includes('pharmeasy')) {
    return `https://pharmeasy.in/search/all?name=${name}`;
  } else if (platform.includes('apollo')) {
    return `https://www.apollopharmacy.in/search-medicines/${name}`;
  } else if (platform.includes('netmeds')) {
    return `https://www.netmeds.com/catalogsearch/result?q=${name}`;
  } else {
    // Fallback: Google search scoped to known pharmacies
    return `https://www.google.com/search?q=${name}+generic+buy+india+site:1mg.com+OR+site:pharmeasy.in`;
  }
}

function renderOutput(data) {
  const { original, alternatives } = data;

  // --- Original Product Card ---
  document.getElementById('out-original-name').textContent = original.brand_name || 'Unknown Product';
  document.getElementById('out-original-price').textContent = `₹${original.estimated_price_inr ?? '—'}`;

  // Ref ID
  const d = new Date();
  const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  const refId = document.getElementById('out-ref-id');
  if (refId) refId.innerHTML = `
    <span style="color:var(--ink-light);">${original.manufacturer ? `By ${original.manufacturer} · ` : ''}${original.route || ''} · ${original.quantity || ''}</span>
    <br><span style="opacity:0.5;">Extracted ${dateStr}</span>`;

  // Tags
  const tagsContainer = document.getElementById('out-original-tags');
  tagsContainer.innerHTML = '';
  if (original.active_ingredients) {
    original.active_ingredients.forEach(i => {
      tagsContainer.innerHTML += `<div class="outline-pill">${i.name}${i.concentration ? ' ' + i.concentration : ''}</div>`;
    });
  }
  if (original.form_factor) tagsContainer.innerHTML += `<div class="outline-pill">${original.form_factor}</div>`;
  if (original.quantity) tagsContainer.innerHTML += `<div class="outline-pill">${original.quantity}</div>`;
  if (original.why_expensive) {
    tagsContainer.innerHTML += `
      <div style="margin-top:12px; width:100%; font-family:var(--font-sans); font-size:0.78rem; color:var(--ink-medium); background:rgba(194,59,59,0.06); border-left:3px solid var(--accent-red); padding:8px 12px; border-radius:0 6px 6px 0;">
        💡 ${original.why_expensive}
      </div>`;
  }

  // Date elements
  document.querySelectorAll('#current-date, #current-date-footer').forEach(el => el && (el.textContent = dateStr));

  // Count label
  const countLabel = document.getElementById('equivalents-count-label');
  if (countLabel && alternatives) {
    countLabel.textContent = `🔬 ${alternatives.length} Generic Equivalent${alternatives.length !== 1 ? 's' : ''} Found`;
  }

  // --- Alternative Cards ---
  const grid = document.getElementById('matrix-grid');
  grid.innerHTML = '';

  if (!alternatives || alternatives.length === 0) {
    grid.innerHTML = `
      <div style="font-family:var(--font-mono);text-align:center;font-size:0.75rem;padding:32px;color:var(--ink-medium);border:2px dashed var(--grid-color);border-radius:12px;">
        No generics located in database.
      </div>`;
    secProcess.classList.add('hidden');
    secOutput.classList.remove('hidden');
    return;
  }

  alternatives.forEach((alt, idx) => {
    const rank = alt.rank || (idx + 1);
    const savingsPct = parseFloat(alt.savings_pct) || 0;
    const savingsAmt = parseFloat(alt.savings_vs_original) || 0;
    const isBest = rank === 1;

    // Rank label
    const rankColors = [
      { bg: '#2E7D52', light: '#D4EDE0', label: '#1 Best Value' },
      { bg: '#1E3A6E', light: '#DCE6F5', label: '#2 Runner-Up' },
      { bg: '#7A5C1E', light: '#F5ECD4', label: '#3 Alternative' },
    ];
    const rc = rankColors[idx] || rankColors[2];

    // Bioequivalent badge
    const bioBadge = alt.bioequivalent !== false
      ? `<span class="match-pill" style="color:#2E7D52;background:#D4EDE0;border-color:#2E7D52;">✓ Bioequivalent</span>`
      : `<span class="match-pill" style="color:#7A5C1E;background:#F5ECD4;border-color:#7A5C1E;">~ Therapeutic Equiv.</span>`;

    // Rx badge
    const rxBadge = alt.prescription_required
      ? `<span style="font-family:var(--font-mono);font-size:0.6rem;font-weight:700;color:var(--accent-red);background:rgba(194,59,59,0.08);border:1px solid rgba(194,59,59,0.3);border-radius:4px;padding:3px 7px;letter-spacing:0.05em;">Rx REQUIRED</span>`
      : `<span style="font-family:var(--font-mono);font-size:0.6rem;font-weight:700;color:var(--accent-green);background:var(--accent-green-bg);border:1px solid rgba(46,125,82,0.3);border-radius:4px;padding:3px 7px;letter-spacing:0.05em;">OTC</span>`;

    // Active ingredients for this alternative
    const altIngredients = (alt.active_ingredients || original.active_ingredients || []);
    const ingredientTags = altIngredients.map(i =>
      `<span style="font-family:var(--font-mono);font-size:0.62rem;font-weight:600;background:var(--pill-bg);border:1px solid var(--grid-color);border-radius:20px;padding:3px 10px;color:var(--ink-dark);">⬡ ${i.name} ${i.concentration || ''}</span>`
    ).join('');

    // Per-unit display
    const perUnit = alt.price_per_unit_inr
      ? `<div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--ink-medium);margin-top:3px;">₹${alt.price_per_unit_inr} ${alt.unit_label || 'per unit'}</div>`
      : '';

    const pharmacyUrl = getPharmacyUrl(alt);
    const platformIcons = { '1mg': '💊', 'pharmeasy': '🟢', 'apollo': '🔵', 'netmeds': '🟣' };
    const pIcon = Object.entries(platformIcons).find(([k]) => (alt.platform || '').toLowerCase().includes(k))?.[1] || '🏥';

    grid.innerHTML += `
      <div class="refined-card" style="${isBest ? `border-color:${rc.bg};box-shadow:4px 4px 0 ${rc.bg};` : ''}">

        <!-- Rank header strip -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="background:${rc.bg};color:#fff;font-family:var(--font-mono);font-size:0.65rem;font-weight:700;padding:4px 10px;border-radius:6px;letter-spacing:0.1em;text-transform:uppercase;">${rc.label}</div>
            ${rxBadge}
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--font-mono);font-size:1.7rem;font-weight:700;color:${rc.bg};line-height:1;">₹${alt.price_inr}</div>
            ${perUnit}
            <div style="font-family:var(--font-mono);font-size:0.7rem;color:var(--ink-light);text-decoration:line-through;margin-top:2px;">₹${original.estimated_price_inr ?? '—'}</div>
          </div>
        </div>

        <!-- Product name & manufacturer -->
        <div style="font-family:var(--font-sans);font-size:1.15rem;font-weight:700;color:var(--ink-dark);line-height:1.2;margin-bottom:4px;">${alt.product_name}</div>
        <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--ink-medium);letter-spacing:0.05em;margin-bottom:14px;">by ${alt.manufacturer || 'Unknown Mfg.'} · ${alt.form_factor || original.form_factor || ''} · ${alt.quantity || original.quantity || ''}</div>

        <!-- Active ingredient tags -->
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">${ingredientTags}</div>

        <!-- Bioequivalent badge -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          ${bioBadge}
          ${savingsPct > 0 ? `<span class="yield-pill-dark">${savingsPct}% cheaper</span>` : ''}
          ${savingsAmt > 0 ? `<span style="font-family:var(--font-mono);font-size:0.68rem;font-weight:700;color:var(--accent-green);">Save ₹${savingsAmt}</span>` : ''}
        </div>

        <!-- Savings bar -->
        ${savingsPct > 0 ? `
        <div style="margin-bottom:18px;">
          <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:0.58rem;color:var(--ink-light);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.08em;">
            <span>Savings</span><span>${savingsPct}%</span>
          </div>
          <div style="height:6px;background:var(--grid-color);border-radius:6px;overflow:hidden;">
            <div style="height:100%;width:${Math.min(savingsPct, 100)}%;background:${rc.bg};border-radius:6px;transition:width 0.6s ease;"></div>
          </div>
        </div>` : ''}

        <!-- CTA Button -->
        <a href="${pharmacyUrl}" target="_blank" rel="noopener noreferrer"
          style="display:flex;align-items:center;justify-content:space-between;width:100%;background:${rc.bg};color:#fff;border:2px solid ${rc.bg};padding:14px 18px;border-radius:10px;font-family:var(--font-mono);font-size:0.82rem;font-weight:700;text-decoration:none;transition:all 0.2s;box-shadow:3px 3px 0 rgba(0,0,0,0.2);letter-spacing:0.06em;text-transform:uppercase;"
          onmouseover="this.style.opacity='0.85';this.style.transform='translate(-1px,-1px)'"
          onmouseout="this.style.opacity='1';this.style.transform='none'">
          <span>${pIcon} Buy on ${alt.platform || 'Pharmacy'}</span>
          <span>↗</span>
        </a>

      </div>
    `;
  });

  secProcess.classList.add('hidden');
  secOutput.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
