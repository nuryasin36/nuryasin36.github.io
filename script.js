/* ==========================================================================
   nuryasin36.github.io — script.js

   Nol dependensi, nol permintaan jaringan. Tiga hal yang dikerjakan berkas ini:

     1. Menggambar gelombang satu nada dengan menjumlahkan harmonik.

     2. Membuat gelombang itu bisa dimainkan. Geser di atasnya untuk mengubah
        jumlah harmonik, dan dengar bedanya. Bunyinya dibuat pakai
        createPeriodicWave, yang menerima amplitudo harmonik langsung, jadi
        gambar dan bunyi di sini berasal dari angka yang sama.

     3. Menampilkan baris proyek satu per satu saat masuk layar.

   Kalau JavaScript mati, halaman tetap terbaca. Yang hilang hanya gambar
   gelombang, suaranya, dan animasinya.
   ========================================================================== */

(function () {
  'use strict';

  /* --- angka dari mesin suara ------------------------------------------- */
  var F0 = 261.6256;                 // C4
  var HARMONICS = [1, 0.48, 0.30, 0.20, 0.13, 0.09, 0.06, 0.04];
  var MAX_HARMONICS = HARMONICS.length;
  var INHARMONICITY = 0.0004;        // senar piano itu kaku
  var DETUNE_CENTS = 1.7;            // dua senar yang tidak persis sama
  var ATTACK = 0.004;                // detik
  var DECAY = 0.62;                  // detik
  var DURATION = 1.7;                // detik
  var RELEASE = 0.12;                // detik

  var WAVE_W = 1200, WAVE_H = 240, WAVE_SPAN = 0.02, WAVE_SAMPLES = 1400;
  var ENV_W = 1200, ENV_H = 90, ENV_SAMPLES = 420;

  var WHITE_MIDI = [60, 62, 64, 65, 67, 69, 71, 72];   // satu oktaf, C4 sampai C5
  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var harmonics = MAX_HARMONICS;     // jumlah harmonik yang sedang ditampilkan
  var freq = F0;                     // nada yang sedang digambar
  var selectedMidi = 60;             // C4
  var audio = null;                  // dibikin malas, saat sentuhan pertama
  var sweepEl = null;                // penanda selubung, diisi waktu build

  /* --- kisi strip chart -------------------------------------------------- */
  function drawGrid(group, width, height, columns, rows) {
    if (!group) return;
    var frag = document.createDocumentFragment();
    var i, line;

    for (i = 1; i < columns; i++) {
      line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', (width / columns) * i);
      line.setAttribute('x2', (width / columns) * i);
      line.setAttribute('y1', 0);
      line.setAttribute('y2', height);
      frag.appendChild(line);
    }
    for (i = 1; i < rows; i++) {
      line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('x2', width);
      line.setAttribute('y1', (height / rows) * i);
      line.setAttribute('y2', (height / rows) * i);
      if (i * 2 === rows) line.setAttribute('class', 'is-major');
      frag.appendChild(line);
    }
    group.appendChild(frag);
  }

  /* --- gelombang --------------------------------------------------------- */
  /* Nilai sesaat sebuah nada pada waktu t, memakai `count` harmonik pertama.
     Satu harmonik menghasilkan gelombang sinus yang rata. Semakin banyak yang
     ditumpuk, semakin bergerigi bentuknya. */
  function tone(t, count) {
    var v = 0;
    var detune = Math.pow(2, DETUNE_CENTS / 1200);
    var voices = [1, detune];
    var limit = Math.min(count, MAX_HARMONICS);

    for (var vi = 0; vi < voices.length; vi++) {
      var voiceGain = vi === 0 ? 1 : 0.8;
      for (var h = 1; h <= limit; h++) {
        var stretch = Math.sqrt(1 + INHARMONICITY * h * h);
        var f = freq * h * stretch * voices[vi];
        v += HARMONICS[h - 1] * voiceGain * Math.sin(2 * Math.PI * f * t);
      }
    }
    return v;
  }

  function drawWave(path, count) {
    if (!path) return;

    var span = WAVE_SPAN;            // jendela waktu tetap, jadi nada yang
                                     // lebih tinggi terlihat lebih rapat
    var peak = 0, i, t, v;
    var values = new Array(WAVE_SAMPLES + 1);

    for (i = 0; i <= WAVE_SAMPLES; i++) {
      t = (i / WAVE_SAMPLES) * span;
      v = tone(t, count);
      values[i] = v;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }

    var mid = WAVE_H / 2;
    var amp = (WAVE_H / 2) * 0.92;
    var d = '';
    for (i = 0; i <= WAVE_SAMPLES; i++) {
      var x = (i / WAVE_SAMPLES) * WAVE_W;
      var y = mid - (values[i] / peak) * amp;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    path.setAttribute('d', d);
  }

  /* --- selubung amplitudo ------------------------------------------------ */
  /* Ini yang menjawab "kenapa nadanya terdengar seperti piano": naik dalam
     4 milidetik, lalu meredup perlahan sampai habis. */
  function envelope(t) {
    var a = t < ATTACK ? t / ATTACK : 1;
    var decay = Math.exp(-t / DECAY);
    var release = 1;
    if (t > DURATION - RELEASE) {
      var k = (t - (DURATION - RELEASE)) / RELEASE;
      release = 0.5 * (1 + Math.cos(Math.PI * k));
    }
    return Math.max(0, a * decay * release);
  }

  function drawEnvelope(path) {
    if (!path) return;
    var pad = 6;
    var d = '';
    for (var i = 0; i <= ENV_SAMPLES; i++) {
      var t = (i / ENV_SAMPLES) * DURATION;
      var x = (i / ENV_SAMPLES) * ENV_W;
      var y = (ENV_H - pad) - envelope(t) * (ENV_H - pad * 2);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    path.setAttribute('d', d);
  }

  /* --- bunyi ------------------------------------------------------------- */
  /* AudioContext dibuat saat sentuhan pertama, bukan saat halaman dibuka:
     peramban memblokir bunyi yang berbunyi sendiri, dan memaksa bunyi keluar
     tanpa diminta itu memang tidak sopan. */
  function audioGraph() {
    if (audio) return audio;

    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    var ctx = new Ctx();
    var gain = ctx.createGain();
    var osc = ctx.createOscillator();

    gain.gain.value = 0;             // mulai senyap, biar tidak ada letupan
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start();

    audio = { ctx: ctx, osc: osc, gain: gain };
    setTimbre(harmonics);
    return audio;
  }

  /* Amplitudo harmonik dikirim apa adanya, jadi bentuk gelombang yang
     terdengar sama persis dengan yang tergambar. */
  function setTimbre(count) {
    if (!audio) return;
    var size = MAX_HARMONICS + 1;    // indeks 0 tidak dipakai
    var real = new Float32Array(size);
    var imag = new Float32Array(size);
    for (var i = 1; i < size; i++) {
      imag[i] = i <= count ? HARMONICS[i - 1] : 0;
    }
    audio.osc.setPeriodicWave(audio.ctx.createPeriodicWave(real, imag));
  }

  /* Nada yang ditahan selama jari menempel, untuk mendengar perubahan timbre
     secara langsung. */
  function startTone() {
    var a = audioGraph();
    if (!a) return;
    if (a.ctx.state === 'suspended') a.ctx.resume();
    var now = a.ctx.currentTime;
    a.gain.gain.cancelScheduledValues(now);
    a.gain.gain.setTargetAtTime(0.1, now, 0.02);
  }

  function stopTone() {
    if (!audio) return;
    var now = audio.ctx.currentTime;
    audio.gain.gain.cancelScheduledValues(now);
    audio.gain.gain.setTargetAtTime(0, now, 0.06);
  }

  /* Penanda yang menyusuri selubung. Menjelaskan bahwa nada sedang berbunyi,
     sekaligus memperlihatkan bentuk kekuatannya sepanjang waktu. */
  function runSweep() {
    if (!sweepEl || reduced) return;
    var width = sweepEl.parentElement.getBoundingClientRect().width;
    sweepEl.style.setProperty('--sweep-w', width.toFixed(1) + 'px');
    sweepEl.classList.remove('is-running');
    void sweepEl.offsetWidth;        // paksa animasinya diulang dari awal
    sweepEl.classList.add('is-running');
  }

  /* Satu nada penuh, lengkap dengan selubungnya, supaya terdengar seperti
     nada piano dan bukan dengung yang rata. */
  function playNote() {
    runSweep();                      // visual tetap jalan walau audio diblokir
    var a = audioGraph();
    if (!a) return;
    if (a.ctx.state === 'suspended') a.ctx.resume();

    var now = a.ctx.currentTime;
    var g = a.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(0, now);
    g.linearRampToValueAtTime(0.16, now + ATTACK);
    g.setTargetAtTime(0.0001, now + ATTACK, DECAY);
  }

  /* --- papan nada -------------------------------------------------------- */
  /* Satu oktaf, dihitung dari jarak antar nada. Tuts hitam hanya muncul di
     antara dua tuts putih yang jaraknya dua seminada, jadi susunannya tidak
     bisa salah. Ini logika yang sama seperti di aplikasi pianonya. */
  function buildKeys(container, onPick) {
    if (!container) return null;

    var buttons = {};
    var step = 100 / WHITE_MIDI.length;
    var frag = document.createDocumentFragment();
    var i;

    function addKey(midi, isBlack, leftPct, widthPct) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'key ' + (isBlack ? 'key--black' : 'key--white');
      b.style.left = leftPct.toFixed(4) + '%';
      b.style.width = widthPct.toFixed(4) + '%';
      b.dataset.midi = String(midi);
      b.setAttribute('aria-label', NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1));
      b.setAttribute('aria-pressed', 'false');
      b.tabIndex = -1;

      var label = document.createElement('span');
      label.className = 'key__label';
      label.textContent = isBlack ? '' : NOTE_NAMES[midi % 12];
      b.appendChild(label);

      b.addEventListener('click', function () { onPick(midi); });
      frag.appendChild(b);
      buttons[midi] = b;
    }

    for (i = 0; i < WHITE_MIDI.length; i++) {
      addKey(WHITE_MIDI[i], false, i * step, step);
    }
    for (i = 0; i < WHITE_MIDI.length - 1; i++) {
      if (WHITE_MIDI[i + 1] - WHITE_MIDI[i] === 2) {
        addKey(WHITE_MIDI[i] + 1, true, (i + 1) * step - step * 0.31, step * 0.62);
      }
    }

    container.appendChild(frag);
    return buttons;
  }

  /* --- interaksi --------------------------------------------------------- */
  function build() {
    var scope = document.getElementById('scope');
    var env = document.getElementById('envelope');
    var stage = document.getElementById('stage');
    var waveEl = document.getElementById('scopeWave');
    var lineEl = document.getElementById('envLine');
    var playhead = document.getElementById('playhead');
    var harmVal = document.getElementById('harmVal');
    var freqVal = document.getElementById('freqVal');
    var playBtn = document.getElementById('playBtn');

    sweepEl = document.getElementById('envSweep');
    if (harmVal) harmVal.classList.add('is-live');

    if (scope) drawGrid(document.getElementById('scopeGrid'), WAVE_W, WAVE_H, 12, 6);
    if (env) drawGrid(document.getElementById('envGrid'), ENV_W, ENV_H, 12, 2);
    if (waveEl) drawWave(waveEl, harmonics);
    if (lineEl) drawEnvelope(lineEl);

    /* Gerak masuk. Dihilangkan kalau pemakainya minta gerak dikurangi. */
    if (!reduced) {
      if (waveEl) {
        waveEl.classList.add('is-drawing');
        waveEl.addEventListener('animationend', function () {
          waveEl.classList.remove('is-drawing');
        }, { once: true });
      }
      if (lineEl) lineEl.classList.add('is-drawing');
    }

    /* Menerapkan jumlah harmonik ke gambar, ke panel pembacaan, dan ke bunyi.
       Semua dari satu nilai, jadi mustahil ketiganya tidak sinkron. */
    function apply(n) {
      harmonics = Math.max(1, Math.min(MAX_HARMONICS, n));

      if (waveEl) {
        waveEl.classList.remove('is-drawing');
        drawWave(waveEl, harmonics);
      }
      if (harmVal) harmVal.textContent = String(harmonics);
      if (stage) stage.setAttribute('aria-valuenow', String(harmonics));
      setTimbre(harmonics);
    }

    if (stage && waveEl) {
      var dragging = false;

      function countFromX(clientX) {
        var r = stage.getBoundingClientRect();
        var t = r.width ? (clientX - r.left) / r.width : 0;
        t = Math.max(0, Math.min(1, t));
        return 1 + Math.round(t * (MAX_HARMONICS - 1));
      }

      function showPlayhead(clientX) {
        if (!playhead) return;
        var r = stage.getBoundingClientRect();
        var x = Math.max(0, Math.min(r.width, clientX - r.left));
        playhead.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
      }

      stage.addEventListener('pointerdown', function (e) {
        dragging = true;
        stage.classList.add('is-active');
        /* Penangkapan penunjuk bisa gagal untuk penunjuk yang tidak dikenali.
           Kalau gagal, jangan sampai seluruh interaksinya ikut mati. */
        try {
          if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
        } catch (err) {
          /* dibiarkan: menggeser tetap jalan tanpa penangkapan */
        }
        showPlayhead(e.clientX);
        apply(countFromX(e.clientX));
        startTone();
        e.preventDefault();
      });

      stage.addEventListener('pointermove', function (e) {
        showPlayhead(e.clientX);
        if (dragging) apply(countFromX(e.clientX));
      });

      function release() {
        if (!dragging) return;
        dragging = false;
        stage.classList.remove('is-active');
        stopTone();
      }

      stage.addEventListener('pointerup', release);
      stage.addEventListener('pointercancel', release);
      stage.addEventListener('pointerleave', release);

      /* Di layar berpenunjuk, penanda muncul begitu kursor masuk. Itu isyarat
         bahwa gelombang ini memang bisa disentuh. */
      stage.addEventListener('pointerenter', function () {
        stage.classList.add('is-hover');
      });
      stage.addEventListener('pointerleave', function () {
        stage.classList.remove('is-hover');
      });

      /* Jalur papan tombol. Panah mengubah nilainya, dan tiap perubahan
         langsung diperdengarkan supaya bedanya bisa dibandingkan tanpa mouse. */
      stage.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = harmonics + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = harmonics - 1;
        else if (e.key === 'Home') next = 1;
        else if (e.key === 'End') next = MAX_HARMONICS;
        if (next === null) return;

        e.preventDefault();
        apply(next);
        playNote();
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', function () {
        apply(harmonics);     // pastikan timbre-nya sudah sesuai gambar
        playNote();
      });
    }

    /* Papan nada. Memilih tuts berarti mengganti nada yang digambar dan
       dibunyikan. Jadi bagian ini masukan bagi gelombang di atasnya, bukan
       mainan yang berdiri sendiri. */
    var keysEl = document.getElementById('keys');
    var keyButtons = buildKeys(keysEl, setNote);
    var midiOrder = keyButtons
      ? Object.keys(keyButtons).map(Number).sort(function (a, b) { return a - b; })
      : [];

    /* Satu tuts saja yang masuk urutan Tab, jadi papan tombol tidak memaksa
       belasan kali penekanan Tab untuk melewatinya. */
    function markSelected() {
      if (!keyButtons) return;
      for (var m in keyButtons) {
        var on = Number(m) === selectedMidi;
        keyButtons[m].setAttribute('aria-pressed', on ? 'true' : 'false');
        keyButtons[m].tabIndex = on ? 0 : -1;
      }
    }

    /* Satu tempat yang mengubah nada. Gambar, panel pembacaan, dan bunyi
       semuanya ikut dari sini, jadi ketiganya tidak mungkin tidak sinkron. */
    function setNote(midi) {
      selectedMidi = midi;
      freq = 440 * Math.pow(2, (midi - 69) / 12);

      if (waveEl) {
        waveEl.classList.remove('is-drawing');
        drawWave(waveEl, harmonics);
      }
      if (freqVal) freqVal.textContent = freq.toFixed(2).replace('.', ',') + ' Hz';
      if (audio) {
        audio.osc.frequency.setTargetAtTime(freq, audio.ctx.currentTime, 0.008);
      }
      markSelected();
      playNote();
    }

    if (keysEl) {
      keysEl.addEventListener('keydown', function (e) {
        var at = midiOrder.indexOf(selectedMidi);
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = midiOrder[at + 1];
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = midiOrder[at - 1];
        if (next === undefined || next === null) return;

        e.preventDefault();
        setNote(next);
        if (keyButtons[next]) keyButtons[next].focus();
      });

      /* Seret melintasi tuts. Memakai elementFromPoint supaya jalan juga di
         layar sentuh, yang tidak memicu pointerenter untuk tiap tuts. */
      var pressing = false;
      var lastHit = null;

      function hitTest(x, y) {
        var el = document.elementFromPoint(x, y);
        var key = el && el.closest ? el.closest('.key') : null;
        if (!key) { lastHit = null; return; }

        var m = Number(key.dataset.midi);
        if (m === lastHit) return;
        lastHit = m;
        setNote(m);
      }

      keysEl.addEventListener('pointerdown', function () {
        pressing = true;
        lastHit = null;
      });
      keysEl.addEventListener('pointermove', function (e) {
        if (pressing) hitTest(e.clientX, e.clientY);
      });
      window.addEventListener('pointerup', function () {
        pressing = false;
        lastHit = null;
      });
    }

    markSelected();

    revealOnScroll();
  }

  function revealOnScroll() {
    var items = document.querySelectorAll('.record, .note');

    if (reduced || !('IntersectionObserver' in window)) {
      for (var j = 0; j < items.length; j++) items[j].classList.add('is-in');
      return;
    }

    for (var i = 0; i < items.length; i++) {
      items[i].classList.add('reveal');
      items[i].style.setProperty('--d', (i % 3) * 60 + 'ms');
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    for (var k = 0; k < items.length; k++) io.observe(items[k]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build, { once: true });
  } else {
    build();
  }
})();
