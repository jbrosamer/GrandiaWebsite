/* Second Level Test 1 (USEF 2023) — movement-by-movement illustrator.
   Geometry is expressed in arena metres: x = 0..20 across, y = 0..60 along,
   with A at y = 0 and C at y = 60. Screen y is flipped at draw time. */
(function () {
  'use strict';

  /* ── Arena letters ─────────────────────────────────────────────── */
  var PT = {
    A: [10, 0],  K: [0, 6],   V: [0, 18],  E: [0, 30],  S: [0, 42],  H: [0, 54],
    C: [10, 60], M: [20, 54], R: [20, 42], B: [20, 30], P: [20, 18], F: [20, 6],
    D: [10, 6],  L: [10, 18], X: [10, 30], I: [10, 42], G: [10, 54]
  };
  var RAIL_LETTERS = ['A', 'K', 'V', 'E', 'S', 'H', 'C', 'M', 'R', 'B', 'P', 'F'];
  var CENTRE_LETTERS = ['D', 'L', 'X', 'I', 'G'];

  /* ── The track: a 20 x 60 rectangle with 5 m rounded corners.
        Arc-length increases in the LEFT-rein direction:
        A → F → P → B → R → M → C → H → S → E → V → K → A               */
  var RAIL = buildRail();

  function buildRail() {
    var pts = [], step = 0.2;

    function lin(a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var n = Math.max(1, Math.round(Math.hypot(dx, dy) / step));
      for (var i = 0; i < n; i++) pts.push([a[0] + dx * i / n, a[1] + dy * i / n]);
    }
    function arc(cx, cy, r, d0, d1) {
      var a0 = d0 * Math.PI / 180, da = (d1 - d0) * Math.PI / 180;
      var n = Math.max(1, Math.round(Math.abs(da) * r / step));
      for (var i = 0; i < n; i++) {
        var a = a0 + da * i / n;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }

    lin([10, 0], [15, 0]);
    arc(15, 5, 5, -90, 0);
    lin([20, 5], [20, 55]);
    arc(15, 55, 5, 0, 90);
    lin([15, 60], [5, 60]);
    arc(5, 55, 5, 90, 180);
    lin([0, 55], [0, 5]);
    arc(5, 5, 5, 180, 270);
    lin([5, 0], [10, 0]);

    var cum = [0], total = 0, i;
    for (i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      cum.push(total);
    }
    total += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);

    var rail = { pts: pts, cum: cum, total: total, T: {} };
    RAIL_LETTERS.forEach(function (L) {
      var p = PT[L], best = 0, bd = Infinity;
      for (var j = 0; j < pts.length; j++) {
        var d = (pts[j][0] - p[0]) * (pts[j][0] - p[0]) + (pts[j][1] - p[1]) * (pts[j][1] - p[1]);
        if (d < bd) { bd = d; best = j; }
      }
      rail.T[L] = cum[best];
    });
    rail.T.A = 0;
    return rail;
  }

  function railAt(t) {
    var L = RAIL.total, cum = RAIL.cum, n = cum.length;
    t = ((t % L) + L) % L;
    var lo = 0, hi = n - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (cum[mid] <= t) lo = mid; else hi = mid - 1; }
    var a = RAIL.pts[lo], b = RAIL.pts[(lo + 1) % n];
    var end = lo + 1 < n ? cum[lo + 1] : L;
    var f = (end - cum[lo]) > 1e-9 ? (t - cum[lo]) / (end - cum[lo]) : 0;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  /* Points along the track from one letter to another.
     dir = +1 travels the left rein, dir = -1 the right rein. */
  function railSlice(from, to, dir) {
    var L = RAIL.total, t0 = RAIL.T[from], t1 = RAIL.T[to];
    if (dir > 0) { while (t1 <= t0 + 1e-6) t1 += L; }
    else { while (t1 >= t0 - 1e-6) t1 -= L; }
    var n = Math.max(2, Math.round(Math.abs(t1 - t0) / 0.35));
    var out = [];
    for (var i = 0; i <= n; i++) out.push(railAt(t0 + (t1 - t0) * i / n));
    out[0] = PT[from].slice();
    out[n] = PT[to].slice();
    return out;
  }

  /* Nudge a line toward the middle of the arena — used to show shoulder-in
     travelling just inside the track. */
  function inward(pts, d) {
    return pts.map(function (p, i) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
      var nx = -ty / m, ny = tx / m;
      if ((10 - p[0]) * nx + (30 - p[1]) * ny < 0) { nx = -nx; ny = -ny; }
      return [p[0] + nx * d, p[1] + ny * d];
    });
  }

  /* ── Segment builders ──────────────────────────────────────────── */
  function seg(pts, gait, o) {
    o = o || {};
    return { pts: pts, gait: gait, medium: !!o.medium, free: !!o.free };
  }
  function Rl(from, to, dir, gait, o) {
    var pts = railSlice(from, to, dir);
    if (o && o.lateral) pts = inward(pts, 1.1);
    return seg(pts, gait, o);
  }
  function Ln(from, to, gait, o) {
    return seg([PT[from].slice(), PT[to].slice()], gait, o);
  }
  function Circ(cx, cy, r, from, sweep, gait, o) {
    var n = Math.max(32, Math.round(Math.abs(sweep) / 4)), out = [];
    for (var i = 0; i <= n; i++) {
      var a = (from + sweep * i / n) * Math.PI / 180;
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return seg(out, gait, o);
  }

  /* ── The test ──────────────────────────────────────────────────────
     USEF Second Level Test 1 (2023). 21 scored movements; coefficient 2
     on 4, 5, 6, 7, 8, 12 and 17. All trot work is sitting.            */
  var MOVES = [
    { n: 1, rows: [['A', 'Enter collected trot'], ['X', 'Halt, salute'], ['', 'Proceed collected trot']],
      path: [Ln('A', 'X', 'trot')], halt: ['X'] },

    { n: 2, rows: [['C', 'Track left'], ['H–P', 'Change rein, medium trot'], ['P', 'Collected trot']],
      path: [Ln('X', 'C', 'trot'), Rl('C', 'H', 1, 'trot'), Ln('H', 'P', 'trot', { medium: true })] },

    { n: 3, rows: [['P–F–A–K', 'Collected trot']], note: 'Transitions at H and P.',
      path: [Rl('P', 'K', -1, 'trot')] },

    { n: 4, coef: 2, rows: [['K–E', 'Shoulder-in right'], ['E', 'Turn right']],
      path: [Rl('K', 'E', -1, 'trot', { lateral: true }), Ln('E', 'X', 'trot')] },

    { n: 5, coef: 2, rows: [['B', 'Turn left'], ['B–M', 'Shoulder-in left']],
      path: [Ln('X', 'B', 'trot'), Rl('B', 'M', 1, 'trot', { lateral: true })] },

    { n: 6, coef: 2, rows: [['C', 'Halt, rein back 3 to 4 steps'], ['', 'Proceed medium walk']],
      path: [Rl('M', 'C', 1, 'trot')], halt: ['C'], reinback: 'C' },

    { n: 7, coef: 2, rows: [['C–S', 'Medium walk']],
      path: [Rl('C', 'S', 1, 'walk')] },

    { n: 8, coef: 2, rows: [['S–F', 'Change rein, free walk'], ['F', 'Medium walk']],
      path: [Ln('S', 'F', 'walk', { free: true })] },

    { n: 9, rows: [['A', 'Collected canter, right lead']],
      path: [Rl('F', 'A', -1, 'walk'), Rl('A', 'K', -1, 'canter')], mark: [['A', 'canter']] },

    { n: 10, rows: [['K–S', 'Medium canter'], ['S', 'Collected canter']],
      path: [Rl('K', 'S', -1, 'canter', { medium: true })] },

    { n: 11, rows: [['C', 'Circle right 10 m']],
      path: [Rl('S', 'C', -1, 'canter'), Circ(10, 55, 5, 90, -360, 'canter')] },

    { n: 12, coef: 2, rows: [['M–E', 'Change rein'], ['E–V', 'Counter canter']],
      path: [Rl('C', 'M', -1, 'canter'), Ln('M', 'E', 'canter'), Rl('E', 'V', 1, 'canter')] },

    { n: 13, rows: [['V', 'Collected trot'], ['K', 'Medium walk']],
      path: [Rl('V', 'K', 1, 'trot'), Rl('K', 'A', 1, 'walk')], mark: [['V', 'trot'], ['K', 'walk']] },

    { n: 14, rows: [['A', 'Collected canter, left lead']],
      path: [Rl('A', 'F', 1, 'canter')], mark: [['A', 'canter']] },

    { n: 15, rows: [['F–R', 'Medium canter'], ['R', 'Collected canter']],
      path: [Rl('F', 'R', 1, 'canter', { medium: true })] },

    { n: 16, rows: [['C', 'Circle left 10 m']],
      path: [Rl('R', 'C', 1, 'canter'), Circ(10, 55, 5, 90, 360, 'canter')] },

    { n: 17, coef: 2, rows: [['H–B', 'Change rein'], ['B–P', 'Counter canter']],
      path: [Rl('C', 'H', 1, 'canter'), Ln('H', 'B', 'canter'), Rl('B', 'P', -1, 'canter')] },

    { n: 18, rows: [['P', 'Collected trot']],
      path: [Rl('P', 'K', -1, 'trot')], mark: [['P', 'trot']] },

    { n: 19, rows: [['K–R', 'Medium trot'], ['R', 'Collected trot']],
      path: [Ln('K', 'R', 'trot', { medium: true })] },

    { n: 20, rows: [['R–M–C–H–S', 'Collected trot']], note: 'Transitions at K and R.',
      path: [Rl('R', 'S', 1, 'trot')] },

    { n: 21, rows: [['S', 'Turn left'], ['I', 'Turn left'], ['G', 'Halt, salute']],
      path: [Ln('S', 'I', 'trot'), Ln('I', 'G', 'trot')], halt: ['G'] },

    { n: 0, label: 'Exit', rows: [['A', 'Leave arena at A in free walk on a long rein']],
      path: [Ln('G', 'C', 'walk', { free: true }), Rl('C', 'A', 1, 'walk', { free: true })] }
  ];

  var SCORED = MOVES.filter(function (m) { return m.n > 0; }).length;

  /* ── Drawing ───────────────────────────────────────────────────── */
  var PAD = 5.5;
  var svg = document.getElementById('court');
  var f = function (v) { return Math.round(v * 100) / 100; };
  var sx = function (x) { return f(x + PAD); };
  var sy = function (y) { return f(60 - y + PAD); };

  function d(pts) {
    var s = 'M' + sx(pts[0][0]) + ' ' + sy(pts[0][1]);
    for (var i = 1; i < pts.length; i++) s += 'L' + sx(pts[i][0]) + ' ' + sy(pts[i][1]);
    return s;
  }
  function len(pts) {
    var t = 0;
    for (var i = 1; i < pts.length; i++) t += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return t;
  }
  /* point + unit tangent at a fraction of the way along a polyline */
  function along(pts, frac) {
    var total = len(pts), want = total * frac, run = 0;
    for (var i = 1; i < pts.length; i++) {
      var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (run + l >= want || i === pts.length - 1) {
        var k = l > 1e-9 ? (want - run) / l : 1;
        k = Math.min(1, Math.max(0, k));
        return {
          p: [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k,
              pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k],
          t: [(pts[i][0] - pts[i - 1][0]) / (l || 1), (pts[i][1] - pts[i - 1][1]) / (l || 1)]
        };
      }
      run += l;
    }
    return { p: pts[pts.length - 1], t: [0, 1] };
  }

  function arena() {
    var s = '';
    s += '<rect class="arena-fill" x="' + sx(0) + '" y="' + sy(60) + '" width="20" height="60" rx="0.4"/>';
    s += '<path class="guide" d="M' + sx(10) + ' ' + sy(0) + 'L' + sx(10) + ' ' + sy(60) + '"/>';
    s += '<path class="guide" d="M' + sx(0) + ' ' + sy(30) + 'L' + sx(20) + ' ' + sy(30) + '"/>';
    s += '<rect class="arena-edge" x="' + sx(0) + '" y="' + sy(60) + '" width="20" height="60" rx="0.4"/>';
    CENTRE_LETTERS.forEach(function (L) {
      s += '<text class="ctext" x="' + sx(PT[L][0] - 1.6) + '" y="' + sy(PT[L][1]) + '">' + L + '</text>';
    });
    return s;
  }

  function letters() {
    var s = '', bw = 4.2, bh = 4.2, off = 2.9;
    RAIL_LETTERS.forEach(function (L) {
      var p = PT[L], cx, cy;
      if (p[0] === 0) { cx = p[0] - off; cy = p[1]; }
      else if (p[0] === 20) { cx = p[0] + off; cy = p[1]; }
      else if (p[1] === 0) { cx = p[0]; cy = p[1] - off; }
      else { cx = p[0]; cy = p[1] + off; }
      s += '<rect class="lbox" x="' + sx(cx - bw / 2) + '" y="' + sy(cy + bh / 2) +
           '" width="' + bw + '" height="' + bh + '" rx="1"/>';
      s += '<text class="ltext" x="' + sx(cx) + '" y="' + sy(cy) + '">' + L + '</text>';
    });
    return s;
  }

  function haltMark(letter) {
    var p = PT[letter], w = 2.2, h = w / 2;
    /* keep the marker inside the arena when the halt sits on the boundary */
    var cx = Math.min(20 - h, Math.max(h, p[0]));
    var cy = Math.min(60 - h, Math.max(h, p[1]));
    return '<rect class="halt-mark" x="' + sx(cx - h) + '" y="' + sy(cy + h) +
           '" width="' + w + '" height="' + w + '" rx="0.55"/>';
  }

  /* short backwards arrow, drawn opposite to the direction of travel */
  function reinBack(letter, pts) {
    var p = PT[letter];
    var tail = pts[Math.max(0, pts.length - 6)];
    var tx = p[0] - tail[0], ty = p[1] - tail[1], m = Math.hypot(tx, ty) || 1;
    tx /= m; ty /= m;
    var a = [p[0] - tx * 0.6, p[1] - ty * 0.6];
    var b = [p[0] - tx * 4.2, p[1] - ty * 4.2];
    var nx = -ty, ny = tx;
    var h1 = [b[0] + tx * 1.2 + nx * 0.85, b[1] + ty * 1.2 + ny * 0.85];
    var h2 = [b[0] + tx * 1.2 - nx * 0.85, b[1] + ty * 1.2 - ny * 0.85];
    return '<path class="rb-arrow" d="M' + sx(a[0]) + ' ' + sy(a[1]) + 'L' + sx(b[0]) + ' ' + sy(b[1]) +
           'M' + sx(h1[0]) + ' ' + sy(h1[1]) + 'L' + sx(b[0]) + ' ' + sy(b[1]) +
           'L' + sx(h2[0]) + ' ' + sy(h2[1]) + '"/>';
  }

  function chevron(pt, tan, cls) {
    var tx = tan[0], ty = tan[1], nx = -ty, ny = tx, s = 0.95;
    var a = [pt[0] - tx * s + nx * s * 0.8, pt[1] - ty * s + ny * s * 0.8];
    var b = [pt[0] + tx * s * 0.55, pt[1] + ty * s * 0.55];
    var c = [pt[0] - tx * s - nx * s * 0.8, pt[1] - ty * s - ny * s * 0.8];
    return '<path class="' + cls + '" d="M' + sx(a[0]) + ' ' + sy(a[1]) +
           'L' + sx(b[0]) + ' ' + sy(b[1]) + 'L' + sx(c[0]) + ' ' + sy(c[1]) + '"/>';
  }

  function arrowHead(pt, tan, colour) {
    var tx = tan[0], ty = tan[1], nx = -ty, ny = tx, s = 1.5;
    var tip = [pt[0] + tx * s * 0.5, pt[1] + ty * s * 0.5];
    var a = [tip[0] - tx * s * 1.5 + nx * s * 0.72, tip[1] - ty * s * 1.5 + ny * s * 0.72];
    var b = [tip[0] - tx * s * 1.5 - nx * s * 0.72, tip[1] - ty * s * 1.5 - ny * s * 0.72];
    return '<path class="head" fill="' + colour + '" d="M' + sx(tip[0]) + ' ' + sy(tip[1]) +
           'L' + sx(a[0]) + ' ' + sy(a[1]) + 'L' + sx(b[0]) + ' ' + sy(b[1]) + 'Z"/>';
  }

  function gaitColour(g) {
    return getComputedStyle(document.documentElement).getPropertyValue('--' + g).trim() || '#2F6F73';
  }

  function render(idx, animate) {
    var mv = MOVES[idx];
    var s = arena();

    /* everything ridden up to here, in grey — the movement just gone is
       a shade stronger so it is clear where this one picks up */
    for (var i = 0; i < idx; i++) {
      var cls = i === idx - 1 ? 'trail recent' : 'trail';
      MOVES[i].path.forEach(function (sg) { s += '<path class="' + cls + '" d="' + d(sg.pts) + '"/>'; });
    }

    /* this movement */
    var delay = 0;
    mv.path.forEach(function (sg) {
      var cls = 'seg' + (sg.medium ? ' medium' : '') + (sg.free ? ' free' : '');
      var style = '';
      if (animate && !sg.free) {
        var L = len(sg.pts) + 0.5;
        cls += ' draw';
        style = ' style="stroke-dasharray:' + f(L) + ';stroke-dashoffset:' + f(L) +
                ';animation-delay:' + f(delay) + 's"';
        delay += 0.16;
      }
      s += '<path class="' + cls + '" data-g="' + sg.gait + '" d="' + d(sg.pts) + '"' + style + '/>';
    });

    /* direction chevrons spread over the whole movement, then an arrow head
       at the finish (unless the movement finishes in a halt) */
    var last = mv.path[mv.path.length - 1];
    var first = mv.path[0];
    var whole = [];
    mv.path.forEach(function (sg) {
      sg.pts.forEach(function (p, i) { if (i || !whole.length) whole.push(p); });
    });
    var total = len(whole);
    if (total > 16) {
      var count = total < 30 ? 1 : (total < 55 ? 2 : 3);
      for (var c = 0; c < count; c++) {
        var at = (6.5 + (total - 13) * (count === 1 ? 0.5 : c / (count - 1))) / total;
        var a = along(whole, Math.min(0.94, Math.max(0.06, at)));
        s += chevron(a.p, a.t, 'chev');
      }
    }
    var endsHalted = (mv.halt || []).some(function (L) {
      var e = last.pts[last.pts.length - 1];
      return Math.hypot(PT[L][0] - e[0], PT[L][1] - e[1]) < 1.5;
    });
    if (!endsHalted) {
      var endA = along(last.pts, 1);
      s += arrowHead(endA.p, endA.t, gaitColour(last.gait));
    }

    /* start of the movement */
    var st = first.pts[0];
    s += '<circle class="dot-start" cx="' + sx(st[0]) + '" cy="' + sy(st[1]) +
         '" r="0.85" stroke="' + gaitColour(first.gait) + '"/>';

    /* transitions inside the movement */
    (mv.mark || []).forEach(function (m) {
      var p = PT[m[0]];
      s += '<circle cx="' + sx(p[0]) + '" cy="' + sy(p[1]) + '" r="1.05" fill="' + gaitColour(m[1]) +
           '" stroke="var(--surface)" stroke-width="0.35"/>';
    });

    (mv.halt || []).forEach(function (L) { s += haltMark(L); });
    if (mv.reinback) s += reinBack(mv.reinback, mv.path[mv.path.length - 1].pts);

    s += letters();
    svg.innerHTML = '<title id="court-title">' + courtLabel(mv) + '</title>' + s;
  }

  function courtLabel(mv) {
    return (mv.n ? 'Movement ' + mv.n : 'Exit') + ': ' +
      mv.rows.map(function (r) { return (r[0] ? r[0] + ' ' : '') + r[1]; }).join(', ');
  }

  /* ── Card + controls ───────────────────────────────────────────── */
  var elNum = document.getElementById('mv-num');
  var elCoef = document.getElementById('mv-coef');
  var elGaits = document.getElementById('mv-gaits');
  var elRows = document.getElementById('mv-rows');
  var elNote = document.getElementById('mv-note');
  var elCount = document.getElementById('count-text');
  var elFill = document.getElementById('progress-fill');
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');

  var idx = 0;

  function gaitsOf(mv) {
    var seen = [];
    mv.path.forEach(function (sg) { if (seen.indexOf(sg.gait) < 0) seen.push(sg.gait); });
    if ((mv.halt || []).length) seen.push('halt');
    return seen;
  }

  function show(i, animate) {
    idx = Math.min(MOVES.length - 1, Math.max(0, i));
    var mv = MOVES[idx];

    elNum.textContent = mv.n ? mv.n : (mv.label || '—');
    elCoef.hidden = !mv.coef;
    elGaits.innerHTML = gaitsOf(mv).map(function (g) {
      return '<span class="gait-chip" data-g="' + g + '">' + g + '</span>';
    }).join('');
    elRows.innerHTML = mv.rows.map(function (r) {
      return '<dt>' + (r[0] || '&nbsp;') + '</dt><dd>' + r[1] + '</dd>';
    }).join('');
    elNote.hidden = !mv.note;
    if (mv.note) elNote.textContent = mv.note;

    elCount.textContent = mv.n ? mv.n + ' / ' + SCORED : 'Exit';
    elFill.style.width = ((idx + 1) / MOVES.length * 100) + '%';
    btnPrev.disabled = idx === 0;
    btnNext.disabled = idx === MOVES.length - 1;

    render(idx, animate !== false);
    markList();
    try { localStorage.setItem('sl1-idx', String(idx)); } catch (e) {}
    if (history.replaceState) history.replaceState(null, '', '#' + (mv.n || 'exit'));
  }

  function step(delta) { show(idx + delta); }

  btnPrev.addEventListener('click', function () { step(-1); });
  btnNext.addEventListener('click', function () { step(1); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { step(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { step(-1); e.preventDefault(); }
    else if (e.key === 'Home') { show(0); }
    else if (e.key === 'End') { show(MOVES.length - 1); }
    else if (e.key === 'Escape') { closeSheet(); }
  });

  /* swipe */
  var stage = document.getElementById('stage');
  var t0 = null;
  stage.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { t0 = null; return; }
    t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (!t0) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - t0.t < 700) {
      step(dx < 0 ? 1 : -1);
    }
    t0 = null;
  }, { passive: true });

  /* ── Movement list sheet ───────────────────────────────────────── */
  var sheet = document.getElementById('sheet');
  var scrim = document.getElementById('scrim');
  var list = document.getElementById('sheet-list');

  list.innerHTML = MOVES.map(function (mv, i) {
    var lead = mv.rows[0];
    return '<li><button type="button" data-i="' + i + '">' +
      '<span class="s-n">' + (mv.n || '—') + '</span>' +
      '<span class="s-l">' + (lead[0] || '') + '</span>' +
      '<span class="s-t">' + mv.rows.map(function (r) { return r[1]; }).join(' · ') + '</span>' +
      '</button></li>';
  }).join('');

  list.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-i]');
    if (!b) return;
    show(parseInt(b.dataset.i, 10));
    closeSheet();
  });

  function markList() {
    Array.prototype.forEach.call(list.querySelectorAll('button'), function (b, i) {
      if (i === idx) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }
  function openSheet() {
    sheet.hidden = false; scrim.hidden = false;
    var cur = list.querySelector('[aria-current="true"]');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }
  function closeSheet() { sheet.hidden = true; scrim.hidden = true; }

  document.getElementById('btn-list').addEventListener('click', openSheet);
  document.getElementById('btn-count').addEventListener('click', openSheet);
  document.getElementById('btn-close').addEventListener('click', closeSheet);
  scrim.addEventListener('click', closeSheet);

  /* ── Boot ──────────────────────────────────────────────────────── */
  var startAt = 0;
  var hash = (location.hash || '').replace('#', '');
  if (hash === 'exit') startAt = MOVES.length - 1;
  else if (/^\d+$/.test(hash)) {
    MOVES.forEach(function (m, i) { if (m.n === parseInt(hash, 10)) startAt = i; });
  } else {
    try {
      var saved = parseInt(localStorage.getItem('sl1-idx'), 10);
      if (!isNaN(saved)) startAt = saved;
    } catch (e) {}
  }
  show(startAt, false);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/dressage-sw.js').catch(function () {});
    });
  }
})();
