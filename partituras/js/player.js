document.addEventListener('DOMContentLoaded', () => {
    const song = window.CURRENT_SONG;
    if (!song) return;

    let currentIndex = -1;
    let isPlaying = false;
    let timerId = null;
    let audioCtx = null;

    const tempoInput = document.getElementById('tempo');
    const tempoVal = document.getElementById('tempoVal');
    if (song.defaultBpm) {
        tempoInput.value = song.defaultBpm;
        tempoVal.textContent = `${song.defaultBpm} BPM`;
    }

    function playGuitarTone(freq, durationSec) {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1900, now);
        filter.frequency.exponentialRampToValueAtTime(380, now + durationSec);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.42, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + durationSec + 0.3);
    }

    function renderSheet() {
        const paper = document.getElementById('sheetPaper');
        paper.innerHTML = '';

        const bottomLineY = 108; // Bajado ligeramente para dar aire a las notas agudas superiores
        const stepHeight = 5.5;
        const timeSigTop = Array.isArray(song.timeSignature) ? song.timeSignature[0] : 4;
        const timeSigBottom = Array.isArray(song.timeSignature) ? song.timeSignature[1] : 4;

        song.phraseTitles.forEach((title, pIdx) => {
            const phraseNotes = song.notes
                .map((n, idx) => ({ ...n, globalIndex: idx }))
                .filter(n => n.phrase === pIdx);

            const block = document.createElement('div');
            block.className = 'phrase-block';
            block.innerHTML = `<div class="phrase-header">${title}</div>`;

            const startX = 105;
            const colWidth = 58;
            const totalWidth = Math.max(920, startX + phraseNotes.length * colWidth + 30);

            let svgContent = `<svg class="staff-svg" viewBox="0 0 ${totalWidth} 184" preserveAspectRatio="xMinYMid meet">`;

            // 5 líneas principales del pentagrama (steps 0, 2, 4, 6, 8)
            for (let i = 0; i < 5; i++) {
                const y = bottomLineY - i * (stepHeight * 2);
                svgContent += `<line x1="15" y1="${y}" x2="${totalWidth - 15}" y2="${y}" stroke="#64748b" stroke-width="1.2"/>`;
            }

            // Barras inicial y final
            const topLineY = bottomLineY - 4 * (stepHeight * 2);
            svgContent += `<line x1="15" y1="${topLineY}" x2="15" y2="${bottomLineY}" stroke="#0f172a" stroke-width="2"/>`;
            svgContent += `<line x1="${totalWidth - 15}" y1="${topLineY}" x2="${totalWidth - 15}" y2="${bottomLineY}" stroke="#0f172a" stroke-width="2.5"/>`;

            // Clave de Sol
            svgContent += `<text x="20" y="${bottomLineY + 6}" font-size="54" font-family="serif" fill="#0f172a">𝄞</text>`;

            // Armadura (Si bemol si hasFlat es true) y compás
            let timeSigX = 58;
            if (song.hasFlat) {
                const bbY = bottomLineY - 4 * stepHeight + 5;
                svgContent += `<text x="56" y="${bbY}" font-size="22" font-family="serif" fill="#0f172a">♭</text>`;
                timeSigX = 74;
            }
            svgContent += `<text x="${timeSigX}" y="${bottomLineY - 23}" font-size="18" font-weight="700" font-family="serif" fill="#0f172a">${timeSigTop}</text>`;
            svgContent += `<text x="${timeSigX}" y="${bottomLineY - 4}" font-size="18" font-weight="700" font-family="serif" fill="#0f172a">${timeSigBottom}</text>`;

            // Etiquetas laterales
            svgContent += `<text class="top-label" x="15" y="24" font-size="11" font-weight="700" fill="#0284c7">NOTA:</text>`;
            svgContent += `<text class="bottom-label" x="15" y="148" font-size="10" font-weight="700" fill="#475569">GUITARRA:</text>`;
            svgContent += `<text class="bottom-label" x="15" y="162" font-size="10" font-weight="700" fill="#475569">DEDO:</text>`;

            phraseNotes.forEach((item, localIdx) => {
                const x = startX + localIdx * colWidth;
                const y = bottomLineY - item.step * stepHeight;
                const fingerText = item.finger === 0 ? "Al aire" : `Dedo ${item.finger}`;
                const posText = `C${item.string}·T${item.fret}`;

                svgContent += `<g class="note-group" id="note-${item.globalIndex}" data-index="${item.globalIndex}">`;
                svgContent += `<rect class="highlight-bg" x="${x - 23}" y="8" width="46" height="168" rx="8" fill="rgba(245, 158, 11, 0.16)" opacity="0"/>`;
                svgContent += `<text class="top-label" x="${x}" y="24" text-anchor="middle" font-size="13" font-weight="700" fill="#0369a1">${item.note}</text>`;

                // Líneas adicionales inferiores (Do central = -2, La3 = -4, etc.)
                if (item.step <= -2) {
                    for (let s = -2; s >= item.step; s -= 2) {
                        const ledgerY = bottomLineY - s * stepHeight;
                        svgContent += `<line x1="${x - 13}" y1="${ledgerY}" x2="${x + 13}" y2="${ledgerY}" stroke="#0f172a" stroke-width="1.4"/>`;
                    }
                }

                // Líneas adicionales superiores (La5 = 10, Do6 = 12, etc.)
                if (item.step >= 10) {
                    for (let s = 10; s <= item.step; s += 2) {
                        const ledgerY = bottomLineY - s * stepHeight;
                        svgContent += `<line x1="${x - 13}" y1="${ledgerY}" x2="${x + 13}" y2="${ledgerY}" stroke="#0f172a" stroke-width="1.4"/>`;
                    }
                }

                // Cabeza de la nota
                const isHalfOrDotted = item.dur >= 3;
                const fillHead = isHalfOrDotted ? "#f8fafc" : "#0f172a";
                svgContent += `<ellipse class="note-head" cx="${x}" cy="${y}" rx="6.5" ry="4.8" transform="rotate(-18 ${x} ${y})" fill="${fillHead}" stroke="#0f172a" stroke-width="1.8"/>`;

                // Puntillo
                if (item.dur === 3) {
                    svgContent += `<circle cx="${x + 11}" cy="${y}" r="2.2" fill="#0f172a"/>`;
                }

                // Plica y corchete
                if (item.step < 4) {
                    svgContent += `<line class="note-stem" x1="${x + 5.8}" y1="${y}" x2="${x + 5.8}" y2="${y - 30}" stroke="#0f172a" stroke-width="1.6"/>`;
                    if (item.dur === 1) {
                        svgContent += `<path class="note-stem" d="M ${x + 5.8} ${y - 30} Q ${x + 14} ${y - 22} ${x + 12} ${y - 12}" fill="none" stroke="#0f172a" stroke-width="1.6"/>`;
                    }
                } else {
                    svgContent += `<line class="note-stem" x1="${x - 5.8}" y1="${y}" x2="${x - 5.8}" y2="${y + 30}" stroke="#0f172a" stroke-width="1.6"/>`;
                    if (item.dur === 1) {
                        svgContent += `<path class="note-stem" d="M ${x - 5.8} ${y + 30} Q ${x + 2} ${y + 22} ${x} ${y + 12}" fill="none" stroke="#0f172a" stroke-width="1.6"/>`;
                    }
                }

                // Etiquetas inferiores (posición guitarra, dedo y letra)
                svgContent += `<text class="bottom-label" x="${x}" y="148" text-anchor="middle" font-size="11" font-weight="700" fill="#1e293b">${posText}</text>`;
                svgContent += `<text class="bottom-label" x="${x}" y="162" text-anchor="middle" font-size="10.5" font-weight="600" fill="#475569">${fingerText}</text>`;

                if (item.lyric) {
                    svgContent += `<text x="${x}" y="177" text-anchor="middle" font-size="11" font-style="italic" fill="#64748b">${item.lyric}</text>`;
                }

                svgContent += `</g>`;
            });

            svgContent += `</svg>`;
            block.innerHTML += svgContent;
            paper.appendChild(block);
        });

        document.querySelectorAll('.note-group').forEach(group => {
            group.addEventListener('click', () => {
                const idx = parseInt(group.getAttribute('data-index'), 10);
                stopPlayback();
                triggerNote(idx);
            });
        });
    }

    function toggleLabels() {
        const paper = document.getElementById('sheetPaper');
        const showNotes = document.getElementById('chkNotes').checked;
        const showFingers = document.getElementById('chkFingers').checked;

        paper.classList.toggle('hide-top', !showNotes);
        paper.classList.toggle('hide-bottom', !showFingers);
    }

    function highlightNote(index) {
        const notes = song.notes;
        document.querySelectorAll('.note-group').forEach(el => el.classList.remove('active'));
        if (index >= 0 && index < notes.length) {
            const el = document.getElementById(`note-${index}`);
            el.classList.add('active');
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

            const item = notes[index];
            const dedoDesc = item.finger === 0 ? "cuerda al aire" : `dedo ${item.finger}`;
            document.getElementById('statusPanel').innerHTML =
                `Paso <strong>${index + 1} / ${notes.length}</strong> — Nota: <strong>${item.note}</strong> | Cuerda: <strong>${item.string}.ª</strong> | Traste: <strong>${item.fret}</strong> (${dedoDesc})`;
        }
    }

    function triggerNote(index) {
        const notes = song.notes;
        currentIndex = index;
        highlightNote(index);
        const item = notes[index];
        const bpm = parseInt(tempoInput.value, 10);
        const eighthSec = (60 / bpm) / 2;
        playGuitarTone(item.freq, item.dur * eighthSec);
    }

    function startPlayback() {
        const notes = song.notes;
        if (isPlaying) return;
        isPlaying = true;
        if (currentIndex < 0 || currentIndex >= notes.length - 1) {
            currentIndex = 0;
        }
        playSequence();
    }

    function playSequence() {
        const notes = song.notes;
        if (!isPlaying) return;
        if (currentIndex >= notes.length) {
            stopPlayback();
            currentIndex = -1;
            return;
        }

        triggerNote(currentIndex);
        const item = notes[currentIndex];
        const bpm = parseInt(tempoInput.value, 10);
        const stepMs = ((60 / bpm) / 2) * item.dur * 1000;

        currentIndex++;
        timerId = setTimeout(playSequence, stepMs);
    }

    function stopPlayback() {
        isPlaying = false;
        clearTimeout(timerId);
    }

    document.getElementById('btnStart').addEventListener('click', startPlayback);
    document.getElementById('btnStop').addEventListener('click', stopPlayback);

    document.getElementById('btnNext').addEventListener('click', () => {
        const notes = song.notes;
        stopPlayback();
        const next = currentIndex + 1 < notes.length ? currentIndex + 1 : 0;
        triggerNote(next);
    });

    document.getElementById('btnPrev').addEventListener('click', () => {
        const notes = song.notes;
        stopPlayback();
        const prev = currentIndex - 1 >= 0 ? currentIndex - 1 : notes.length - 1;
        triggerNote(prev);
    });

    tempoInput.addEventListener('input', (e) => {
        tempoVal.textContent = `${e.target.value} BPM`;
    });

    document.getElementById('chkNotes').addEventListener('change', toggleLabels);
    document.getElementById('chkFingers').addEventListener('change', toggleLabels);

    renderSheet();
});

