/* ==========================================================================
   nuryasin36.github.io — script.js

   Nol dependensi, nol permintaan jaringan. Dua hal yang dikerjakan berkas ini:

     1. Menggambar gelombang satu nada. Angkanya bukan hiasan: memakai
        matematika yang sama seperti mesin suara di aplikasi piano —
        delapan harmonik, ketidaksempurnaan nada senar kaku, dan dua
        senar maya yang dibedakan sedikit.

     2. Menampilkan baris kerja satu per satu saat masuk layar.

   Kalau JavaScript mati, halaman tetap terbaca: hanya gambar gelombang dan
   animasinya yang hilang.
   ========================================================================== */

(function () {
  'use strict';

  /* --- angka dari mesin suara ------------------------------------------- */
  var F0 = 261.6256;                 // C4
  var HARMONICS = [1, 0.48, 0.30, 0.20, 0.13, 0.09, 0.06, 0.04];
  var INHARMONICITY = 0.0004;        // senar piano itu kaku
  var DETUNE_CENTS = 1.7;            // dua senar yang tidak persis sama
  var ATTACK = 0.004;                // detik
  var DECAY = 0.62;                  // detik
  var DURATION = 1.7;                // detik
  var RELEASE = 0.12;                // detik

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  /* Nilai sesaat sebuah nada pada waktu t. Semakin banyak harmonik yang
     ditumpuk, semakin jauh bentuknya dari gelombang sinus biasa. */
  function tone(t) {
    var v = 0;
    var detune = Math.pow(2, DETUNE_CENTS / 1200);
    var voices = [1, detune];

    for (var vi = 0; vi < voices.length; vi++) {
      var voiceGain = vi === 0 ? 1 : 0.8;
      for (var h = 1; h <= HARMONICS.length; h++) {
        var stretch = Math.sqrt(1 + INHARMONICITY * h * h);
        var f = F0 * h * stretch * voices[vi];
        v += HARMONICS[h - 1] * voiceGain * Math.sin(2 * Math.PI * f * t);
      }
    }
    return v;
  }

  function drawWave(path, width, height, cycles, samples) {
    if (!path) return;

    var span = cycles / F0;                 // rentang waktu yang digambar
    var peak = 0, i, t, v;
    var values = new Array(samples + 1);

    for (i = 0; i <= samples; i++) {
      t = (i / samples) * span;
      v = tone(t);
      values[i] = v;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }

    var mid = height / 2;
    var amp = (height / 2) * 0.92;
    var d = '';
    for (i = 0; i <= samples; i++) {
      var x = (i / samples) * width;
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

  function drawEnvelope(path, width, height, samples) {
    if (!path) return;
    var pad = 6;
    var d = '';
    for (var i = 0; i <= samples; i++) {
      var t = (i / samples) * DURATION;
      var x = (i / samples) * width;
      var y = (height - pad) - envelope(t) * (height - pad * 2);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    path.setAttribute('d', d);
  }

  /* --- jalankan ---------------------------------------------------------- */
  function build() {
    var scope = document.getElementById('scope');
    var env = document.getElementById('envelope');

    if (scope) {
      drawGrid(document.getElementById('scopeGrid'), 1200, 240, 12, 6);
      drawWave(document.getElementById('scopeWave'), 1200, 240, 7, 1400);
    }
    if (env) {
      drawGrid(document.getElementById('envGrid'), 1200, 90, 12, 2);
      drawEnvelope(document.getElementById('envLine'), 1200, 90, 420);
    }

    /* Strip masuk pertama, lalu baris kerja menyusul saat di-scroll. */
    var wave = document.getElementById('scopeWave');
    var line = document.getElementById('envLine');

    if (!reduced) {
      if (wave) {
        wave.classList.add('is-drawing');
        wave.addEventListener('animationend', function () {
          wave.classList.remove('is-drawing');
        }, { once: true });
      }
      if (line) line.classList.add('is-drawing');
    }

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
