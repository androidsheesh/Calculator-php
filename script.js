// ===== Configuration =====
const API_URL = 'api/calculate.php';

// ===== State =====
let currentMode = 'both'; // 'both' | 'lecture' | 'laboratory'

// ===== DOM Helpers =====
const $ = (id) => document.getElementById(id);

// ===== Mode Selector =====
function setMode(mode) {
  currentMode = mode;

  // Update active button
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const lectureSection = $('lectureSection');
  const labSection = $('labSection');
  const grid = document.querySelector('.sections-grid');

  // Show/hide sections with transitions
  if (mode === 'both') {
    lectureSection.classList.remove('section-hidden');
    labSection.classList.remove('section-hidden');
    grid.classList.remove('single-col');
  } else if (mode === 'lecture') {
    lectureSection.classList.remove('section-hidden');
    labSection.classList.add('section-hidden');
    grid.classList.add('single-col');
  } else if (mode === 'laboratory') {
    lectureSection.classList.add('section-hidden');
    labSection.classList.remove('section-hidden');
    grid.classList.add('single-col');
  }

  // Hide results when mode changes
  $('resultPanel').classList.remove('show');
}

// ===== Add a new exam row =====
function addRow(tbodyId) {
  const tbody = $(tbodyId);
  const tr = document.createElement('tr');
  tr.style.animation = 'fadeInUp 0.3s ease both';
  tr.innerHTML = `
    <td><input type="text" class="input-field" name="examName" placeholder="e.g. Quiz" /></td>
    <td><input type="number" class="input-field" name="score" placeholder="0" min="0" step="any" /></td>
    <td><input type="number" class="input-field" name="totalScore" placeholder="100" min="1" step="any" /></td>
    <td><input type="number" class="input-field" name="percentage" placeholder="50" min="0" max="100" step="any" /></td>
    <td><button type="button" class="btn btn-remove" title="Remove row" onclick="removeRow(this)">✕</button></td>
  `;
  tbody.appendChild(tr);
  tr.querySelector('input[name="examName"]').focus();
}

// ===== Remove an exam row =====
function removeRow(btn) {
  const tr = btn.closest('tr');
  const tbody = tr.parentElement;

  if (tbody.querySelectorAll('tr').length <= 1) {
    showError('You need at least one exam row.');
    return;
  }

  tr.style.animation = 'fadeOutUp 0.2s ease forwards';

  setTimeout(() => {
    tr.remove();
  }, 200); // match animation duration
}

// ===== Gather data from a section =====
function gatherSection(tbodyId) {
  const rows = $(tbodyId).querySelectorAll('tr');
  const entries = [];
  rows.forEach((row) => {
    const name = row.querySelector('[name="examName"]').value.trim() || 'Untitled';
    const score = parseFloat(row.querySelector('[name="score"]').value);
    const totalScore = parseFloat(row.querySelector('[name="totalScore"]').value);
    const percentage = parseFloat(row.querySelector('[name="percentage"]').value);
    entries.push({ name, score, totalScore, percentage });
  });
  return entries;
}

// ===== Validate entries =====
function validateEntries(entries, label) {
  for (const e of entries) {
    if (isNaN(e.score) || isNaN(e.totalScore) || isNaN(e.percentage)) {
      showError(`${label}: Please fill in all numeric fields for "${e.name}".`);
      return false;
    }
    if (e.score < 0) {
      showError(`${label}: Score cannot be negative for "${e.name}".`);
      return false;
    }
    if (e.totalScore <= 0) {
      showError(`${label}: Total score must be greater than 0 for "${e.name}".`);
      return false;
    }
    if (e.score > e.totalScore) {
      showError(`${label}: Score cannot exceed total score for "${e.name}".`);
      return false;
    }
    if (e.percentage < 0 || e.percentage > 100) {
      showError(`${label}: Percentage must be between 0 and 100 for "${e.name}".`);
      return false;
    }
  }
  return true;
}

// ===== Check percentage sums =====
function checkPercentageSum(entries, warningId) {
  const sum = entries.reduce((acc, e) => acc + (isNaN(e.percentage) ? 0 : e.percentage), 0);
  const warningEl = $(warningId);
  if (Math.abs(sum - 100) > 0.01) {
    warningEl.classList.add('show');
    return false;
  } else {
    warningEl.classList.remove('show');
    return true;
  }
}

// ===== Calculate (call PHP backend) =====
async function calculate() {
  const payload = { mode: currentMode };

  // Gather and validate based on mode
  if (currentMode === 'both' || currentMode === 'lecture') {
    const lectureEntries = gatherSection('lectureExams');
    if (!validateEntries(lectureEntries, 'Lecture')) return;
    checkPercentageSum(lectureEntries, 'lecturePctWarning');
    payload.lecture = lectureEntries.map((e) => ({
      name: e.name, score: e.score, totalScore: e.totalScore, percentage: e.percentage,
    }));
  }

  if (currentMode === 'both' || currentMode === 'laboratory') {
    const labEntries = gatherSection('labExams');
    if (!validateEntries(labEntries, 'Laboratory')) return;
    checkPercentageSum(labEntries, 'labPctWarning');
    payload.laboratory = labEntries.map((e) => ({
      name: e.name, score: e.score, totalScore: e.totalScore, percentage: e.percentage,
    }));
  }

  // Call PHP backend
  const btn = $('calculateBtn');
  btn.classList.add('loading');
  btn.textContent = 'Calculating…';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Server error ${response.status}`);
    }

    const result = await response.json();
    displayResults(result);
  } catch (err) {
    showError('Calculation failed: ' + err.message);
  } finally {
    btn.classList.remove('loading');
    btn.textContent = 'Calculate Grade';
  }
}

// ===== Display results =====
function displayResults(result) {
  const panel = $('resultPanel');
  panel.classList.add('show');

  const lectureItem = $('lectureResultItem');
  const labItem = $('labResultItem');
  const finalItem = $('finalResultItem');
  const finalSub = $('finalGradeSub');

  // Reset visibility
  lectureItem.classList.remove('result-hidden');
  labItem.classList.remove('result-hidden');
  finalItem.classList.remove('result-hidden');

  if (currentMode === 'both') {
    animateValue('lectureGradeValue', result.lectureGrade);
    animateValue('labGradeValue', result.labGrade);
    animateValue('finalGradeValue', result.finalGrade);
    finalSub.textContent = 'Lecture × 0.30 + Lab × 0.70';
  } else if (currentMode === 'lecture') {
    labItem.classList.add('result-hidden');
    finalItem.classList.add('result-hidden');
    animateValue('lectureGradeValue', result.lectureGrade);
  } else if (currentMode === 'laboratory') {
    lectureItem.classList.add('result-hidden');
    finalItem.classList.add('result-hidden');
    animateValue('labGradeValue', result.labGrade);
  }

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== Animate a number from 0 =====
function animateValue(elementId, target) {
  const el = $(elementId);
  const duration = 600;
  const start = performance.now();
  const from = 0;

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (target - from) * eased;
    el.textContent = current.toFixed(2);
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

// ===== Reset all fields =====
function resetAll() {
  const lectureBody = $('lectureExams');
  lectureBody.innerHTML = `
    <tr>
      <td><input type="text" class="input-field" name="examName" placeholder="e.g. Midterm" /></td>
      <td><input type="number" class="input-field" name="score" placeholder="0" min="0" step="any" /></td>
      <td><input type="number" class="input-field" name="totalScore" placeholder="100" min="1" step="any" /></td>
      <td><input type="number" class="input-field" name="percentage" placeholder="50" min="0" max="100" step="any" /></td>
      <td><button type="button" class="btn btn-remove" title="Remove row" onclick="removeRow(this)">✕</button></td>
    </tr>
  `;

  const labBody = $('labExams');
  labBody.innerHTML = `
    <tr>
      <td><input type="text" class="input-field" name="examName" placeholder="e.g. Lab 1" /></td>
      <td><input type="number" class="input-field" name="score" placeholder="0" min="0" step="any" /></td>
      <td><input type="number" class="input-field" name="totalScore" placeholder="100" min="1" step="any" /></td>
      <td><input type="number" class="input-field" name="percentage" placeholder="50" min="0" max="100" step="any" /></td>
      <td><button type="button" class="btn btn-remove" title="Remove row" onclick="removeRow(this)">✕</button></td>
    </tr>
  `;

  $('lecturePctWarning').classList.remove('show');
  $('labPctWarning').classList.remove('show');
  $('resultPanel').classList.remove('show');
}

// ===== Show error toast =====
function showError(message) {
  const toast = $('errorToast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}
