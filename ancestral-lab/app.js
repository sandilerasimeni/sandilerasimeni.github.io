(function () {
  'use strict';

  const input = document.getElementById('photo-input');
  const preview = document.getElementById('photo-preview');
  const previewWrap = document.getElementById('preview-wrap');
  const removeButton = document.getElementById('remove-photo');
  const status = document.getElementById('model-status');
  const generation = document.getElementById('generation');
  const generationValue = document.getElementById('generation-value');
  const generationBadge = document.getElementById('generation-badge');
  const seedInput = document.getElementById('seed-input');
  const generateButton = document.getElementById('generate-button');
  const emptyState = document.getElementById('empty-state');
  const resultsGrid = document.getElementById('results-grid');
  const analysisNote = document.getElementById('analysis-note');
  const canvas = document.getElementById('analysis-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let detector = null;
  let selectedFile = null;
  let objectUrl = null;
  let visualSeed = null;
  let modelReady = false;

  function setStatus(message, state) {
    status.className = 'model-status' + (state ? ' ' + state : '');
    status.querySelector('span:last-child').textContent = message;
  }

  async function loadDetector() {
    try {
      if (!window.tf || !window.blazeface) throw new Error('TensorFlow.js or BlazeFace did not load. Check your internet connection and reload.');
      await window.tf.ready();
      detector = await window.blazeface.load();
      modelReady = true;
      setStatus('CNN face detector ready · runs on this device', 'ready');
      generateButton.disabled = !selectedFile;
    } catch (error) {
      setStatus('CNN could not load. Check your connection and reload to use face detection.', 'error');
      console.error('Could not load BlazeFace:', error);
    }
  }

  function clearResults() {
    resultsGrid.replaceChildren();
    emptyState.hidden = false;
    analysisNote.hidden = true;
  }

  function removeImage() {
    selectedFile = null;
    visualSeed = null;
    input.value = '';
    preview.removeAttribute('src');
    previewWrap.hidden = true;
    generateButton.disabled = true;
    clearResults();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    setStatus(modelReady ? 'CNN face detector ready · runs on this device' : 'Waiting for CNN face detector…', modelReady ? 'ready' : '');
  }

  input.addEventListener('change', function () {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setStatus('Please choose a JPG, PNG, or WebP image.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStatus('That image is larger than 8 MB. Choose a smaller file.', 'error');
      input.value = '';
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    selectedFile = file;
    objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    previewWrap.hidden = false;
    clearResults();
    setStatus('Image selected · stays in this browser', 'ready');
    generateButton.disabled = !modelReady;
  });

  removeButton.addEventListener('click', removeImage);
  generation.addEventListener('input', function () {
    generationValue.value = generation.value;
    generationBadge.textContent = 'GEN ' + generation.value;
  });

  function seededRandom(seed) {
    let state = (seed >>> 0) || 1;
    return function () {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(random) {
    const first = Math.max(random(), 1e-8);
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random());
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function svgPortrait(traits, variant, generationNumber) {
    const [headWidth, eyeGap, faceLength, browTilt, noseLength, mouthWidth] = traits;
    const cx = 120;
    const width = 43 + headWidth * 17;
    const rx = clamp(width + variant * 1.4, 36, 62);
    const ry = clamp(56 + faceLength * 20, 52, 82);
    const leftEye = cx - (12 + eyeGap * 8);
    const rightEye = cx + (12 + eyeGap * 8);
    const eyeY = 103 + browTilt * 2;
    const noseBottom = 119 + noseLength * 9;
    const mouthHalf = 8 + mouthWidth * 5;
    const hairStyles = ['#253b35', '#3e3b32', '#35444a', '#58443b'];
    const hair = hairStyles[(Math.floor((traits[0] * 100 + variant + generationNumber) % hairStyles.length) + hairStyles.length) % hairStyles.length];
    const face = '#d9b99a';
    return `<svg viewBox="0 0 240 240" role="img" aria-label="Fictional illustrated face variation ${variant + 1}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg${variant}" x2="1" y2="1"><stop stop-color="#e8eddf"/><stop offset="1" stop-color="#f7f5ed"/></linearGradient></defs><rect width="240" height="240" rx="8" fill="url(#bg${variant})"/><circle cx="120" cy="110" r="91" fill="none" stroke="#b9c9a6" stroke-width="1"/><path d="M65 225c5-34 25-48 55-48s50 14 55 48" fill="#718d65"/><path d="M${cx-rx} 104c-5-42 17-70 55-70s60 28 55 70l-5-10c-8-12-17-21-28-25-20 18-51 26-75 24l-4 12z" fill="${hair}"/><ellipse cx="${cx}" cy="112" rx="${rx}" ry="${ry}" fill="${face}"/><path d="M${leftEye-8} ${eyeY-9}q8-5 16 0M${rightEye-8} ${eyeY-9}q8-5 16 0" fill="none" stroke="#443a34" stroke-width="3" stroke-linecap="round"/><ellipse cx="${leftEye}" cy="${eyeY}" rx="4.2" ry="3" fill="#263a35"/><ellipse cx="${rightEye}" cy="${eyeY}" rx="4.2" ry="3" fill="#263a35"/><path d="M120 ${eyeY+5}q-5 15-3 ${noseBottom- eyeY-5}q3 4 8 0" fill="none" stroke="#a77e68" stroke-width="2.5" stroke-linecap="round"/><path d="M${cx-mouthHalf} 151q${mouthHalf} 7 ${mouthHalf*2} 0" fill="none" stroke="#985f58" stroke-width="3" stroke-linecap="round"/><path d="M${cx-rx+5} 119q-10 5 1 17M${cx+rx-5} 119q10 5-1 17" fill="none" stroke="#bd957d" stroke-width="2"/><text x="14" y="222" fill="#65776a" font-family="sans-serif" font-size="9" letter-spacing="1.5">ILLUSTRATIVE · NOT A REAL PERSON</text></svg>`;
  }

  function mutate(parent, random, amount) {
    return parent.map(function (value, index) {
      const ranges = [0.14, 0.18, 0.15, 0.22, 0.16, 0.18];
      return clamp(value + gaussian(random) * ranges[index] * amount, -1.5, 1.5);
    });
  }

  function renderPortrait(traits, index, generationNumber) {
    const card = document.createElement('article');
    card.className = 'portrait-card';
    const art = document.createElement('div');
    art.className = 'portrait-art';
    art.innerHTML = svgPortrait(traits, index, generationNumber);
    const caption = document.createElement('div');
    caption.className = 'portrait-caption';
    const title = document.createElement('strong');
    title.textContent = 'Imagined variation ' + String(index + 1).padStart(2, '0');
    const subtitle = document.createElement('span');
    subtitle.textContent = 'Generation ' + generationNumber + ' · fictional';
    caption.append(title, subtitle);
    card.append(art, caption);
    return card;
  }

  async function analyzeAndGenerate() {
    if (!selectedFile || !modelReady || !detector) return;
    generateButton.disabled = true;
    generateButton.textContent = 'Analyzing portrait…';
    setStatus('Running CNN face detection locally…', 'working');

    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const sx = (image.naturalWidth - side) / 2;
      const sy = (image.naturalHeight - side) / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
      const faces = await detector.estimateFaces(canvas, false);
      if (!faces.length) {
        visualSeed = null;
        setStatus('No face detected. Try a clear, front-facing portrait with one person.', 'error');
        clearResults();
        return;
      }

      const face = faces[0];
      const topLeft = face.topLeft.map(Number);
      const bottomRight = face.bottomRight.map(Number);
      const boxWidth = Math.max(1, bottomRight[0] - topLeft[0]);
      const boxHeight = Math.max(1, bottomRight[1] - topLeft[1]);
      const landmarks = (face.landmarks || []).map(function (point) { return [Number(point[0]), Number(point[1])]; });
      const eyeDistance = landmarks.length >= 2 ? Math.hypot(landmarks[0][0] - landmarks[1][0], landmarks[0][1] - landmarks[1][1]) / boxWidth : 0.35;
      const centerOffset = (topLeft[0] + boxWidth / 2 - canvas.width / 2) / canvas.width;
      // Only broad, non-identifying geometry initializes the illustration; no identity, ethnicity, or ancestry is inferred.
      visualSeed = [clamp(boxWidth / boxHeight - 0.72, -1, 1), clamp(eyeDistance - 0.35, -1, 1), clamp(boxHeight / canvas.height - 0.58, -1, 1), clamp(centerOffset, -1, 1), 0, 0];
      setStatus('Face detected · only rough geometry is used in this illustration', 'ready');
      simulate();
    } catch (error) {
      console.error('Face analysis failed:', error);
      setStatus('Could not analyze this image. Try another JPG, PNG, or WebP.', 'error');
      clearResults();
    } finally {
      generateButton.disabled = !modelReady || !selectedFile;
      generateButton.innerHTML = '<span aria-hidden="true">✳</span> Explore imagined paths';
    }
  }

  function simulate() {
    if (!visualSeed) return;
    const depth = Number(generation.value);
    const seedValue = Math.abs(parseInt(seedInput.value, 10) || 1);
    const random = seededRandom(seedValue);
    let lineage = visualSeed.slice();
    // Generations are a creative random walk, not a biological inheritance model.
    for (let step = 0; step < depth; step += 1) {
      const secondImaginedParent = mutate(lineage, random, 0.55);
      const child = lineage.map(function (trait, index) {
        const inherited = random() < 0.5 ? trait : secondImaginedParent[index];
        return clamp(inherited + gaussian(random) * 0.055, -1.5, 1.5);
      });
      lineage = child;
    }

    const portraits = [];
    for (let i = 0; i < 4; i += 1) portraits.push(mutate(lineage, random, 0.8));
    resultsGrid.replaceChildren(...portraits.map(function (traits, index) { return renderPortrait(traits, index, depth); }));
    emptyState.hidden = true;
    analysisNote.hidden = false;
    analysisNote.textContent = 'CNN detection initialized simple geometry only. The portraits above come from a seeded random-walk illustration—not a VAE, genetic model, or reconstruction of actual relatives.';
    generationBadge.textContent = 'GEN ' + depth;
  }

  generateButton.addEventListener('click', analyzeAndGenerate);
  loadDetector();
})();
