const NOTES = [
  { latin: "Do",  eng: "C"  },
  { latin: "Do#", eng: "C#" },
  { latin: "Re",  eng: "D"  },
  { latin: "Re#", eng: "D#" },
  { latin: "Mi",  eng: "E"  },
  { latin: "Fa",  eng: "F"  },
  { latin: "Fa#", eng: "F#" },
  { latin: "Sol", eng: "G"  },
  { latin: "Sol#",eng: "G#" },
  { latin: "La",  eng: "A"  },
  { latin: "La#", eng: "A#" },
  { latin: "Si",  eng: "B"  }
];

const STRINGS = [
  { num: 1, name: "1ª (Mi)",  startIndex: 4,  baseFreq: 329.63 },
  { num: 2, name: "2ª (Si)",  startIndex: 11, baseFreq: 246.94 },
  { num: 3, name: "3ª (Sol)", startIndex: 7,  baseFreq: 196.00 },
  { num: 4, name: "4ª (Re)",  startIndex: 2,  baseFreq: 146.83 },
  { num: 5, name: "5ª (La)",  startIndex: 9,  baseFreq: 110.00 },
  { num: 6, name: "6ª (Mi)",  startIndex: 4,  baseFreq: 82.41  }
];

const CHORDS = new Array(
  {
    name: "Do Mayor (C)",
    frets: new Array(-1, 3, 2, 0, 1, 0),
    fingers: new Array("X", 3, 2, 0, 1, 0),
    tips: "No toques la 6ª cuerda (X). Arquea los dedos para dejar libres la 3ª y 1ª cuerda."
  },
  {
    name: "Re Mayor (D)",
    frets: new Array(-1, -1, 0, 2, 3, 2),
    fingers: new Array("X", "X", 0, 1, 3, 2),
    tips: "Rasguea únicamente desde la 4ª cuerda (Re al aire) hacia abajo."
  },
  {
    name: "Re Menor (Dm)",
    frets: new Array(-1, -1, 0, 2, 3, 1),
    fingers: new Array("X", "X", 0, 2, 3, 1),
    tips: "Coloca el dedo 1 en el primer traste de la 1ª cuerda y rasguea desde la 4ª cuerda."
  },
  {
    name: "Mi Mayor (E)",
    frets: new Array(0, 2, 2, 1, 0, 0),
    fingers: new Array(0, 2, 3, 1, 0, 0),
    tips: "Se tocan las 6 cuerdas. Usa los dedos 2 y 3 en el segundo traste."
  },
  {
    name: "Mi Menor (Em)",
    frets: new Array(0, 2, 2, 0, 0, 0),
    fingers: new Array(0, 2, 3, 0, 0, 0),
    tips: "Solo pisa la 5ª y 4ª cuerda en el traste 2 y rasguea todas las cuerdas."
  },
  {
    name: "Sol Mayor (G)",
    frets: new Array(3, 2, 0, 0, 0, 3),
    fingers: new Array(2, 1, 0, 0, 0, 3),
    tips: "Pisa los extremos en el traste 3 (6ª y 1ª cuerda) y deja sonar las centrales al aire."
  },
  {
    name: "La Mayor (A)",
    frets: new Array(-1, 0, 2, 2, 2, 0),
    fingers: new Array("X", 0, 1, 2, 3, 0),
    tips: "Agrupa los dedos 1, 2 y 3 en el segundo traste de las cuerdas 4ª, 3ª y 2ª."
  },
  {
    name: "La Menor (Am)",
    frets: new Array(-1, 0, 2, 2, 1, 0),
    fingers: new Array("X", 0, 2, 3, 1, 0),
    tips: "Misma forma que Mi Mayor, bajando cada dedo una cuerda."
  }
);


const TOTAL_FRETS = 12;
let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playTone(freq, delay = 0) {
  ensureAudioContext();
  const startTime = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0.25, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + 1.2);
}

/* =========================================
   1. AFINADOR CROMÁTICO POR MICRÓFONO
   ========================================= */
let tunerActive = false;
let micStream = null;
let analyser = null;
let rafId = null;

const tunerToggle = document.getElementById("tunerToggle");
const tunerNoteEl = document.getElementById("tunerNote");
const tunerFreqEl = document.getElementById("tunerFreq");
const tunerNeedleEl = document.getElementById("tunerNeedle");
const tunerStatusEl = document.getElementById("tunerStatus");

function autoCorrelate(buffer, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.015) return -1;

  let r1 = 0, r2 = buffer.length - 1;
  const thres = 0.2;
  for (let i = 0; i < buffer.length / 2; i++) {
    if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < buffer.length / 2; i++) {
    if (Math.abs(buffer[buffer.length - i]) < thres) { r2 = buffer.length - i; break; }
  }

  const trimmed = buffer.slice(r1, r2);
  const c = new Array(trimmed.length).fill(0);
  for (let i = 0; i < trimmed.length; i++) {
    for (let j = 0; j < trimmed.length - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < trimmed.length; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }

  return sampleRate / maxPos;
}

function updateTuner() {
  if (!tunerActive) return;
  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);
  const freq = autoCorrelate(buffer, audioCtx.sampleRate);

  if (freq > 60 && freq < 1000) {
    const noteNum = 12 * (Math.log(freq / 440) / Math.log(2)) + 69;
    const roundedNote = Math.round(noteNum);
    const noteIndex = (roundedNote % 12 + 12) % 12;
    const octave = Math.floor(roundedNote / 12) - 1;
    const cents = Math.floor((noteNum - roundedNote) * 100);

    const nObj = NOTES[noteIndex];
    tunerNoteEl.textContent = `${nObj.latin} (${nObj.eng}${octave})`;
    tunerFreqEl.textContent = `${freq.toFixed(1)} Hz`;

    const clampedCents = Math.max(-50, Math.min(50, cents));
    tunerNeedleEl.style.left = `${50 + clampedCents}%`;

    if (Math.abs(cents) <= 5) {
      tunerNoteEl.classList.add("in-tune");
      tunerNeedleEl.style.background = "#10b981";
      tunerStatusEl.textContent = "✅ ¡Afinada!";
    } else {
      tunerNoteEl.classList.remove("in-tune");
      tunerNeedleEl.style.background = "#f59e0b";
      tunerStatusEl.textContent = cents < 0 ? "🔼 Tensa un poco la cuerda" : "🔽 Afloja un poco la cuerda";
    }
  }
  rafId = requestAnimationFrame(updateTuner);
}

tunerToggle.addEventListener("click", async () => {
  if (tunerActive) {
    tunerActive = false;
    cancelAnimationFrame(rafId);
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    tunerToggle.textContent = "🎙️ Activar Micrófono";
    tunerToggle.classList.remove("active-mic");
    tunerStatusEl.textContent = "Afinador detenido.";
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    tunerStatusEl.textContent = "⚠️ El micrófono requiere abrir la página en HTTPS o localhost.";
    return;
  }

  try {
    ensureAudioContext();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    tunerActive = true;
    tunerToggle.textContent = "⏹️ Detener Afinador";
    tunerToggle.classList.add("active-mic");
    tunerStatusEl.textContent = "Toca una cuerda al aire cerca del micrófono...";
    updateTuner();
  } catch (err) {
    tunerStatusEl.textContent = "⚠️ Acceso al micrófono denegado o bloqueado por el navegador.";
  }
});

/* =========================================
   2. DIAPASÓN Y ESCALAS PENTATÓNICAS
   ========================================= */
function getFingerInfo(fret) {
  if (fret === 0) return { label: "0", desc: "Cuerda al aire", cls: "finger-0" };
  if (fret === 1) return { label: "D1", desc: "Dedo 1 (Índice)", cls: "finger-1" };
  if (fret === 2) return { label: "D2", desc: "Dedo 2 (Medio)", cls: "finger-2" };
  if (fret === 3) return { label: "D3", desc: "Dedo 3 (Anular)", cls: "finger-3" };
  if (fret === 4) return { label: "D4", desc: "Dedo 4 (Meñique)", cls: "finger-4" };
  return { label: "1-4", desc: "Según posición de la mano", cls: "finger-x" };
}

const noteBtnContainer = document.getElementById("noteButtons");
const pentaRootSelect = document.getElementById("pentaRoot");
const pentaTypeSelect = document.getElementById("pentaType");

NOTES.forEach((n, idx) => {
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.dataset.noteIndex = idx;
  btn.textContent = `${n.latin} (${n.eng})`;
  noteBtnContainer.appendChild(btn);

  const opt = document.createElement("option");
  opt.value = idx;
  opt.textContent = `${n.latin} (${n.eng})`;
  if (idx === 9) opt.selected = true;
  pentaRootSelect.appendChild(opt);
});

const table = document.getElementById("fretboard");
const thead = document.createElement("thead");
const headRow = document.createElement("tr");
headRow.innerHTML = `<th>Cuerda</th>` + Array.from({ length: TOTAL_FRETS + 1 }, (_, i) =>
  `<th>${i === 0 ? "Al aire" : "Traste " + i}</th>`
).join("");
thead.appendChild(headRow);
table.appendChild(thead);

const tbody = document.createElement("tbody");
STRINGS.forEach((str, sIdx) => {
  const tr = document.createElement("tr");
  tr.dataset.string = sIdx;

  const labelTd = document.createElement("td");
  labelTd.className = "string-label";
  labelTd.textContent = str.name;
  tr.appendChild(labelTd);

  for (let fret = 0; fret <= TOTAL_FRETS; fret++) {
    const td = document.createElement("td");
    const noteIndex = (str.startIndex + fret) % 12;
    const noteObj = NOTES[noteIndex];
    const finger = getFingerInfo(fret);
    const freq = str.baseFreq * Math.pow(2, fret / 12);

    const marker = document.createElement("div");
    marker.className = `note-marker ${finger.cls}`;
    marker.dataset.noteIndex = noteIndex;
    marker.innerHTML = `<span>${noteObj.latin}</span><span class="finger-tag">${finger.label}</span>`;

    marker.addEventListener("click", () => {
      playTone(freq);
      document.getElementById("infoBox").innerHTML =
        `<strong>Nota:</strong> ${noteObj.latin} (${noteObj.eng}) &nbsp;|&nbsp; ` +
        `<strong>Ubicación:</strong> ${str.num}ª cuerda, ${fret === 0 ? "al aire" : "traste " + fret} &nbsp;|&nbsp; ` +
        `<strong>Posición:</strong> ${finger.desc}`;
    });

    td.appendChild(marker);
    tr.appendChild(td);
  }
  tbody.appendChild(tr);
});
table.appendChild(tbody);

const PENTA_INTERVALS = {
  minor: new Array(0, 3, 5, 7, 10),
  major: new Array(0, 2, 4, 7, 9)
};

function applyPentatonicScale() {
  const root = parseInt(pentaRootSelect.value, 10);
  const type = pentaTypeSelect.value;
  const scaleNotes = PENTA_INTERVALS[type].map(interval => (root + interval) % 12);

  document.querySelectorAll(".note-marker").forEach(m => {
    const nIdx = parseInt(m.dataset.noteIndex, 10);
    m.classList.remove("root-note", "dimmed");
    if (scaleNotes.includes(nIdx)) {
      if (nIdx === root) m.classList.add("root-note");
    } else {
      m.classList.add("dimmed");
    }
  });

  const noteNames = scaleNotes.map(i => `${NOTES[i].latin} (${NOTES[i].eng})`).join(" - ");
  document.getElementById("infoBox").innerHTML =
    `<strong>Escala Pentatónica ${type === "minor" ? "Menor" : "Mayor"} de ${NOTES[root].latin}:</strong> ${noteNames}`;
}

document.querySelectorAll(".tab-btn").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const mode = tab.dataset.mode;
    if (mode === "notes") {
      noteBtnContainer.classList.remove("hidden");
      document.getElementById("pentatonicControls").classList.add("hidden");
      document.querySelectorAll(".note-marker").forEach(m => m.classList.remove("root-note", "dimmed"));
      noteBtnContainer.querySelectorAll(".btn").forEach(b => b.classList.remove("active"));
      noteBtnContainer.querySelector('[data-note="ALL"]').classList.add("active");
    } else {
      noteBtnContainer.classList.add("hidden");
      document.getElementById("pentatonicControls").classList.remove("hidden");
      applyPentatonicScale();
    }
  });
});

noteBtnContainer.addEventListener("click", e => {
  if (!e.target.classList.contains("btn")) return;
  noteBtnContainer.querySelectorAll(".btn").forEach(b => b.classList.remove("active"));
  e.target.classList.add("active");

  const isAll = e.target.dataset.note === "ALL";
  const targetIdx = parseInt(e.target.dataset.noteIndex, 10);

  document.querySelectorAll(".note-marker").forEach(m => {
    m.classList.remove("root-note");
    const mIdx = parseInt(m.dataset.noteIndex, 10);
    m.classList.toggle("dimmed", !isAll && mIdx !== targetIdx);
  });
});

pentaRootSelect.addEventListener("change", applyPentatonicScale);
pentaTypeSelect.addEventListener("change", applyPentatonicScale);

document.getElementById("playScaleBtn").addEventListener("click", () => {
  const root = parseInt(pentaRootSelect.value, 10);
  const type = pentaTypeSelect.value;
  const intervals = [...PENTA_INTERVALS[type], 12];
  const baseA2 = 110.00;
  const rootFreq = baseA2 * Math.pow(2, (root - 9) / 12);

  intervals.forEach((semi, idx) => {
    const freq = rootFreq * Math.pow(2, semi / 12);
    playTone(freq, idx * 0.35);
  });
});

/* =========================================
   3. ACORDES BÁSICOS
   ========================================= */
const chordBtnContainer = document.getElementById("chordButtons");
const stringOrder6to1 = [...STRINGS].reverse();

function renderChord(chord) {
  const diagram = document.getElementById("chordDiagram");
  let html = `<table class="chord-grid"><thead><tr>`;

  stringOrder6to1.forEach((s, idx) => {
    const f = chord.frets[idx];
    const status = f === -1 ? "X" : (f === 0 ? "0" : "");
    html += `<th>${s.num}ª<br>${status}</th>`;
  });
  html += `</tr></thead><tbody>`;

  for (let fret = 1; fret <= 4; fret++) {
    html += `<tr>`;
    for (let s = 0; s < 6; s++) {
      if (chord.frets[s] === fret) {
        const fingerNum = chord.fingers[s];
        html += `<td><span class="chord-dot finger-${fingerNum}">${fingerNum}</span></td>`;
      } else {
        html += `<td></td>`;
      }
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  diagram.innerHTML = html;

  const details = document.getElementById("chordDetails");
  details.innerHTML = `
    <h3>${chord.name}</h3>
    <p>${chord.tips}</p>
    <button class="strum-btn" id="strumBtn">🔊 Escuchar acorde</button>
  `;

  document.getElementById("strumBtn").addEventListener("click", () => {
    chord.frets.forEach((fret, idx) => {
      if (fret >= 0) {
        const freq = stringOrder6to1[idx].baseFreq * Math.pow(2, fret / 12);
        playTone(freq, idx * 0.06);
      }
    });
  });
}

CHORDS.forEach((chord, idx) => {
  const btn = document.createElement("button");
  btn.className = idx === 0 ? "btn active" : "btn";
  btn.textContent = chord.name;
  btn.addEventListener("click", () => {
    chordBtnContainer.querySelectorAll(".btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderChord(chord);
  });
  chordBtnContainer.appendChild(btn);
});

renderChord(CHORDS.at(0));

/* =========================================
   4. METRÓNOMO VISUAL Y SONORO
   ========================================= */
let metroRunning = false;
let metroInterval = null;
let currentBeat = 0;
let tapTimes = new Array();

const bpmSlider = document.getElementById("bpmSlider");
const bpmValueEl = document.getElementById("bpmValue");
const timeSigSelect = document.getElementById("timeSignature");
const beatLightsEl = document.getElementById("beatLights");
const metroToggleBtn = document.getElementById("metroToggle");
const tapTempoBtn = document.getElementById("tapTempoBtn");

function renderBeatLights() {
  const beats = parseInt(timeSigSelect.value, 10);
  beatLightsEl.innerHTML = "";
  for (let i = 0; i < beats; i++) {
    const dot = document.createElement("div");
    dot.className = "beat-dot";
    beatLightsEl.appendChild(dot);
  }
}

function playClickSound(isAccent) {
  ensureAudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(isAccent ? 1000 : 700, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

function stepMetronome() {
  const beats = parseInt(timeSigSelect.value, 10);
  const dots = beatLightsEl.querySelectorAll(".beat-dot");

  dots.forEach(d => d.classList.remove("active-accent", "active-beat"));

  const isAccent = currentBeat === 0;
  const activeDot = dots.item(currentBeat);
  if (activeDot) {
    activeDot.classList.add(isAccent ? "active-accent" : "active-beat");
  }

  playClickSound(isAccent);
  currentBeat = (currentBeat + 1) % beats;
}

function startMetronome() {
  stopMetronome();
  currentBeat = 0;
  const bpm = parseInt(bpmSlider.value, 10);
  const ms = Math.round(60000 / bpm);
  stepMetronome();
  metroInterval = setInterval(stepMetronome, ms);
  metroRunning = true;
  metroToggleBtn.textContent = "⏹️ Detener Metrónomo";
  metroToggleBtn.classList.add("active-mic");
}

function stopMetronome() {
  if (metroInterval) clearInterval(metroInterval);
  metroRunning = false;
  metroToggleBtn.textContent = "▶️ Iniciar Metrónomo";
  metroToggleBtn.classList.remove("active-mic");
  beatLightsEl.querySelectorAll(".beat-dot").forEach(d => d.classList.remove("active-accent", "active-beat"));
}

bpmSlider.addEventListener("input", () => {
  bpmValueEl.textContent = bpmSlider.value;
  if (metroRunning) startMetronome();
});

timeSigSelect.addEventListener("change", () => {
  renderBeatLights();
  if (metroRunning) startMetronome();
});

metroToggleBtn.addEventListener("click", () => {
  if (metroRunning) {
    stopMetronome();
  } else {
    startMetronome();
  }
});

// Función Tap Tempo (calcular BPM golpeando el botón al ritmo)
tapTempoBtn.addEventListener("click", () => {
  const now = Date.now();
  if (tapTimes.length > 0 && now - tapTimes.at(-1) > 2000) {
    tapTimes = new Array();
  }
  tapTimes.push(now);
  if (tapTimes.length > 4) tapTimes.shift();

  if (tapTimes.length >= 2) {
    let sum = 0;
    for (let i = 1; i < tapTimes.length; i++) {
      sum += tapTimes.at(i) - tapTimes.at(i - 1);
    }
    const avgMs = sum / (tapTimes.length - 1);
    const calculatedBpm = Math.max(40, Math.min(220, Math.round(60000 / avgMs)));
    bpmSlider.value = calculatedBpm;
    bpmValueEl.textContent = calculatedBpm;
    if (metroRunning) startMetronome();
  }
});

renderBeatLights();

/* =========================================
   5. TEMPORIZADOR DE RUTINA DE PRÁCTICA
   ========================================= */
let timerSeconds = 300;
let initialSeconds = 300;
let timerInterval = null;
let timerRunning = false;

const timerDisplayEl = document.getElementById("timerDisplay");
const timerTaskLabelEl = document.getElementById("timerTaskLabel");
const timerStartBtn = document.getElementById("timerStartBtn");
const timerResetBtn = document.getElementById("timerResetBtn");

function updateTimerDisplay() {
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  const mStr = mins < 10 ? "0" + mins : String(mins);
  const sStr = secs < 10 ? "0" + secs : String(secs);
  timerDisplayEl.textContent = `${mStr}:${sStr}`;
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerRunning = false;
  timerStartBtn.textContent = "▶️ Iniciar";
}

timerStartBtn.addEventListener("click", () => {
  if (timerRunning) {
    stopTimer();
    return;
  }
  if (timerSeconds <= 0) timerSeconds = initialSeconds;
  timerRunning = true;
  timerStartBtn.textContent = "⏸️ Pausar";

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      stopTimer();
      playTone(523.25, 0);
      playTone(659.25, 0.2);
      playTone(783.99, 0.4);
      timerTaskLabelEl.textContent = "✅ ¡Bloque completado!";
    }
  }, 1000);
});

timerResetBtn.addEventListener("click", () => {
  stopTimer();
  timerSeconds = initialSeconds;
  updateTimerDisplay();
});

document.querySelectorAll(".preset-btns .btn").forEach(btn => {
  btn.addEventListener("click", () => {
    stopTimer();
    const mins = parseInt(btn.dataset.mins, 10);
    initialSeconds = mins * 60;
    timerSeconds = initialSeconds;
    timerTaskLabelEl.textContent = btn.dataset.task;
    updateTimerDisplay();
  });
});

updateTimerDisplay();
