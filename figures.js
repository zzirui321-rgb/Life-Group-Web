/* ==========================================================================
   Pan’s LiFE · figures.js
   Interactive research figures. Each <figure data-ifig="..."> keeps its
   original <img> as a fallback; this script replaces it with an interactive
   version when JavaScript is available.

   Figures
   - setup        experiment chain (research page) + PINEM sideband spectrum
   - kgap         k-gap vs ω-gap dispersion (research page)
   - anomaly      anomaly concept map (interests page)
   - measurement  weak-to-strong measurement (interests page)
   - concepts     three electron–light processes (research page)
   - floquet      driven lattice: quasienergy + discrete diffraction (interests page)
   ========================================================================== */
(() => {
  const EN = document.documentElement.lang.startsWith('en');
  const T = (zh, en) => (EN ? en : zh);
  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- small DOM helpers ----------
  const h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) e.append(k);
    return e;
  };
  const s = (tag, attrs = {}, ...kids) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) e.append(k);
    return e;
  };
  // role="group" (not "img"): several figures contain focusable controls that must stay
  // exposed to screen readers.
  const svgRoot = (w, hgt, label) => s('svg', { viewBox: `0 0 ${w} ${hgt}`, role: 'group', 'aria-label': label, class: 'ifig-svg' });
  const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
  const pathOf = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const fmt = (v, d = 2) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(d));

  function slider({ label, min, max, step, value, format, oninput }) {
    const id = 'ifig-' + Math.random().toString(36).slice(2, 8);
    const out = h('output', { for: id, class: 'ifig-value' });
    const input = h('input', { type: 'range', id, min, max, step, value });
    const update = () => { out.textContent = format(+input.value); oninput(+input.value); };
    input.addEventListener('input', update);
    const wrap = h('label', { class: 'ifig-slider', for: id }, h('span', { class: 'ifig-label', text: label }), input, out);
    return { wrap, input, update };
  }
  function segmented(options, onchange) {
    const wrap = h('div', { class: 'ifig-seg', role: 'group' });
    const buttons = options.map((o, i) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(i === 0), text: o.label });
      b.addEventListener('click', () => {
        buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        onchange(o.value);
      });
      wrap.append(b);
      return b;
    });
    return wrap;
  }
  function tooltip(container) {
    const tip = h('div', { class: 'ifig-tip', role: 'status', 'aria-live': 'polite' });
    tip.hidden = true;
    container.append(tip);
    return {
      show(lines, x, y) {
        tip.replaceChildren(...lines.map(([strong, rest]) => h('div', {}, h('strong', { text: strong }), rest ? ' ' + rest : '')));
        tip.hidden = false;
        const cw = container.clientWidth;
        tip.style.left = Math.min(Math.max(x + 12, 4), cw - tip.offsetWidth - 4) + 'px';
        tip.style.top = Math.max(y - tip.offsetHeight - 10, 4) + 'px';
      },
      hide() { tip.hidden = true; },
    };
  }
  // pointer position in SVG user units
  const svgPoint = (svg, evt) => {
    const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const localXY = (el, evt) => { const r = el.getBoundingClientRect(); return [evt.clientX - r.left, evt.clientY - r.top]; };

  // Bessel function of the first kind, integer order (series; fine for x ≤ 10)
  function besselJ(n, x) {
    const m0 = Math.abs(n);
    let sum = 0, term = Math.pow(x / 2, m0);
    for (let k = 1; k <= m0; k++) term /= k;
    for (let m = 0; m < 60; m++) {
      sum += term;
      term *= -(x * x / 4) / ((m + 1) * (m + 1 + m0));
      if (Math.abs(term) < 1e-16 && m > 5) break;
    }
    return n < 0 && m0 % 2 ? -sum : sum;
  }

  // simple axis helper: returns scale functions and draws a light frame
  function plotArea(svg, { x0, y0, w, hgt, xr, yr }) {
    const sx = (v) => x0 + (v - xr[0]) / (xr[1] - xr[0]) * w;
    const sy = (v) => y0 + hgt - (v - yr[0]) / (yr[1] - yr[0]) * hgt;
    svg.append(s('line', { x1: x0, y1: y0 + hgt, x2: x0 + w, y2: y0 + hgt, class: 'ifig-axis' }));
    svg.append(s('line', { x1: x0, y1: y0, x2: x0, y2: y0 + hgt, class: 'ifig-axis' }));
    return { sx, sy };
  }

  /* ======================================================================
     1. Experiment chain + PINEM spectrum
     ====================================================================== */
  function buildSetup(fig, cx) {
    const steps = [
      { n: 1, title: T('量子电子波包', 'Quantum electron wave packet'), text: T('超快电子脉冲以量子波包的形式飞向纳米结构。', 'An ultrafast electron pulse travels towards the nanostructure as a quantum wave packet.') },
      { n: 2, title: T('入射光子', 'Incoming photon'), text: T('激光脉冲照射纳米结构，在其表面激发出局域近场。', 'A laser pulse illuminates the nanostructure and excites a localized near field.') },
      { n: 3, title: T('光与电子相互作用', 'Light–electron interaction'), text: T('电子穿过近场时吸收或放出整数个光子能量 ħω——这就是光子诱导近场电子显微（PINEM）。', 'Crossing the near field, the electron absorbs or emits integer numbers of photon energies ħω — photon-induced near-field electron microscopy (PINEM).') },
      { n: 4, title: T('电子能谱仪', 'Electron spectrometer'), text: T('能谱上出现间隔为 ħω 的离散边带，边带分布由耦合强度 |g| 决定（见下方能谱）。', 'The spectrum shows discrete sidebands spaced by ħω; their distribution is set by the coupling strength |g| (see the spectrum below).') },
      { n: 5, title: T('光学探测器', 'Optical detector'), text: T('收集电子与结构作用后发出的光子；与电子能谱做时间关联符合测量，可用于研究电子与光子的量子纠缠。', 'Collects photons emitted after the interaction; time-correlated coincidence with the electron spectrum probes electron–photon entanglement.') },
    ];
    const W = 760, H = 300, axisY = 196;
    const svg = svgRoot(W, H, T('自由电子与光相互作用的实验链路示意图', 'Schematic of the free-electron–light experiment chain'));
    svg.classList.add('ifig-setup');
    const defs = s('defs');
    defs.innerHTML = `
      <radialGradient id="ifg-near" cx="50%" cy="100%" r="70%">
        <stop offset="0" stop-color="var(--color-fig-warm)" stop-opacity=".55"/>
        <stop offset=".6" stop-color="var(--color-lime)" stop-opacity=".35"/>
        <stop offset="1" stop-color="var(--color-lime)" stop-opacity="0"/>
      </radialGradient>
      <marker id="ifg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="context-stroke"/>
      </marker>`;
    svg.append(defs);
    // wave packet path generator (gaussian envelope × carrier)
    const packet = (cx, cy, len, amp, cycles) => pathOf(linspace(-1, 1, 160).map((u) => [cx + u * len / 2, cy - amp * Math.exp(-u * u * 5) * Math.sin(u * cycles * Math.PI)]));
    const groups = {};
    const G = (n, ...kids) => { const g = s('g', { class: 'ifig-stage', 'data-step': n }, ...kids); groups[n] = g; return g; };

    svg.append(s('line', { x1: 30, y1: axisY, x2: 640, y2: axisY, class: 'ifig-beam', 'marker-end': 'url(#ifg-arrow)' }));
    // 3: nanostructure + near field
    svg.append(G(3,
      s('path', { d: 'M265 214 Q340 108 415 214 Z', fill: 'url(#ifg-near)' }),
      s('rect', { x: 255, y: 214, width: 170, height: 14, rx: 3, class: 'ifig-substrate' }),
      s('path', { d: 'M262 214 l18 -12 l12 12 l18 -12 l12 12 l18 -12 l12 12 l18 -12 l12 12 l18 -12 l12 12', class: 'ifig-grating' }),
      s('text', { x: 340, y: 254, class: 'ifig-cap', 'text-anchor': 'middle', text: T('纳米结构 · 近场', 'nanostructure · near field') }),
    ));
    // 1: incoming packet
    const pk = s('g', { class: 'ifig-packet' },
      s('ellipse', { cx: 0, cy: axisY, rx: 52, ry: 22, class: 'ifig-packet-env' }),
      s('path', { d: packet(0, axisY, 110, 18, 9), class: 'ifig-packet-wave' }));
    pk.setAttribute('transform', 'translate(120 0)');
    svg.append(G(1, s('text', { x: 120, y: 244, class: 'ifig-cap', 'text-anchor': 'middle', text: T('电子波包', 'electron packet') })));
    svg.append(pk);
    // 2: laser pulse
    const pulse = pathOf(linspace(0, 1, 140).map((u) => {
      const x = 170 + u * 140, y = 40 + u * 110, env = Math.exp(-((u - 0.45) ** 2) * 14);
      const off = 9 * env * Math.sin(u * 22 * Math.PI);
      return [x + off * 0.62, y - off * 0.78];
    }));
    svg.append(G(2,
      s('path', { d: pulse, class: 'ifig-photon' }),
      s('line', { x1: 300, y1: 140, x2: 318, y2: 162, class: 'ifig-photon-dir', 'marker-end': 'url(#ifg-arrow)' }),
      s('text', { x: 150, y: 34, class: 'ifig-cap', text: T('激光脉冲', 'laser pulse') })));
    // 4: spectrometer
    svg.append(G(4,
      s('rect', { x: 652, y: 160, width: 76, height: 72, rx: 8, class: 'ifig-device' }),
      ...[-2, -1, 0, 1, 2].map((k, i) => s('rect', { x: 666 + i * 10, y: 216 - [10, 22, 30, 22, 10][i], width: 6, height: [10, 22, 30, 22, 10][i], rx: 2, class: 'ifig-device-bar' })),
      s('text', { x: 690, y: 254, class: 'ifig-cap', 'text-anchor': 'middle', text: T('电子能谱仪', 'spectrometer') })));
    // 5: emitted photon + detector
    const emitted = pathOf(linspace(0, 1, 120).map((u) => {
      const x = 360 + u * 150, y = 150 - u * 78, off = 6 * Math.sin(u * 16 * Math.PI) * Math.exp(-((u - 0.5) ** 2) * 6);
      return [x + off * 0.46, y + off * 0.89];
    }));
    svg.append(G(5,
      s('path', { d: emitted, class: 'ifig-emitted' }),
      s('line', { x1: 506, y1: 76, x2: 520, y2: 69, class: 'ifig-emitted-dir', 'marker-end': 'url(#ifg-arrow)' }),
      s('path', { d: 'M530 46 h52 a8 8 0 0 1 8 8 v34 a8 8 0 0 1 -8 8 h-52 a26 26 0 0 1 0 -50z', class: 'ifig-device' }),
      s('text', { x: 600, y: 76, class: 'ifig-cap', text: T('光学探测器', 'optical detector') })));
    // numbered badges (also clickable)
    const badgePos = { 1: [62, 160], 2: [214, 104], 3: [340, 132], 4: [740, 156], 5: [556, 30] };
    const badges = {};
    for (const st of steps) {
      const [bx, by] = badgePos[st.n];
      const b = s('g', { class: 'ifig-badge', tabindex: 0, role: 'button', 'aria-label': `${st.n} ${st.title}` },
        s('circle', { cx: bx, cy: by, r: cx ? 21 : 13 }), s('text', { x: bx, y: by + (cx ? 8 : 5), 'text-anchor': 'middle', text: String(st.n) }));
      b.addEventListener('click', () => select(st.n));
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(st.n); } });
      badges[st.n] = b; svg.append(b);
    }

    // step buttons + description
    const stepRow = h('div', { class: 'ifig-steps', role: 'tablist' });
    const stepBtns = steps.map((st) => {
      const b = h('button', { type: 'button', role: 'tab', 'aria-selected': 'false' }, h('span', { class: 'ifig-step-n', text: String(st.n) }), st.title);
      b.addEventListener('click', () => select(st.n));
      stepRow.append(b);
      return b;
    });
    const play = h('button', { type: 'button', class: 'ifig-play', text: T('▶ 播放全过程', '▶ Play') });
    stepRow.append(play);
    const desc = h('p', { class: 'ifig-desc' });
    let current = 0;
    function select(n) {
      current = n;
      for (const st of steps) {
        const on = st.n === n;
        groups[st.n].classList.toggle('is-dim', n !== 0 && !on);
        badges[st.n].classList.toggle('is-active', on);
        stepBtns[st.n - 1].setAttribute('aria-selected', String(on));
      }
      const st = steps[n - 1];
      desc.replaceChildren(h('strong', { text: `${st.n} · ${st.title}　` }), st.text);
      spec.wrap.classList.toggle('is-highlight', n === 4 || n === 3);
    }

    // packet animation along the beam
    let raf = 0;
    function animate() {
      cancelAnimationFrame(raf);
      const t0 = performance.now(), dur = 4200;
      const tick = (now) => {
        const u = Math.min(1, (now - t0) / dur);
        const x = 120 + u * (600 - 120);
        pk.setAttribute('transform', `translate(${x} 0)`);
        pk.classList.toggle('is-shaped', x > 340);
        const stage = x < 200 ? 1 : x < 280 ? 2 : x < 420 ? 3 : u < 0.88 ? 4 : 5;
        if (stage !== current) select(stage);
        if (u < 1) raf = requestAnimationFrame(tick);
        else setTimeout(() => { pk.setAttribute('transform', 'translate(120 0)'); pk.classList.remove('is-shaped'); }, 900);
      };
      raf = requestAnimationFrame(tick);
    }
    play.addEventListener('click', () => {
      if (reduceMotion) { let n = 1; select(n); const iv = setInterval(() => { n += 1; if (n > 5) return clearInterval(iv); select(n); }, 1200); }
      else animate();
    });

    // PINEM spectrum
    const spec = buildPinem(cx);
    const card = h('div', { class: 'ifig-card' }, svg, stepRow, desc, spec.wrap);
    fig.prepend(card);
    select(1);
    return card;
  }

  function buildPinem(cx) {
    const W = cx ? 420 : 760, H = cx ? 270 : 250, x0 = cx ? 50 : 56, y0 = 18, pw = W - x0 - 20, ph = cx ? 196 : 180, N = cx ? 8 : 12;
    const svg = svgRoot(W, H, T('PINEM 电子能谱边带', 'PINEM electron energy sidebands'));
    const { sx, sy } = plotArea(svg, { x0, y0, w: pw, hgt: ph, xr: [-N - 0.6, N + 0.6], yr: [0, 1] });
    for (const v of [0.25, 0.5, 0.75, 1]) {
      svg.append(s('line', { x1: x0, x2: x0 + pw, y1: sy(v), y2: sy(v), class: 'ifig-grid' }));
      svg.append(s('text', { x: x0 - 8, y: sy(v) + 4, 'text-anchor': 'end', class: 'ifig-tick', text: Math.round(v * 100) + '%' }));
    }
    for (let n = -N; n <= N; n += 2) svg.append(s('text', { x: sx(n), y: y0 + ph + 20, 'text-anchor': 'middle', class: 'ifig-tick', text: (n > 0 ? '+' : '') + n }));
    svg.append(s('text', { x: x0 + pw, y: y0 + ph + 42, 'text-anchor': 'end', class: 'ifig-cap', text: T('电子能量变化 ΔE / ħω（吸收为正）', 'energy change ΔE / ħω (gain > 0)') }));
    const bw = pw / (2 * N + 1.2) - 4;
    const bars = [];
    for (let n = -N; n <= N; n++) {
      const r = s('rect', { x: sx(n) - bw / 2, width: bw, rx: 2, class: 'ifig-bar' + (n === 0 ? ' is-zero' : ''), tabindex: 0, role: 'img' });
      const hit = s('rect', { x: sx(n) - (bw + 4) / 2, y: y0, width: bw + 4, height: ph, class: 'ifig-hit' });
      svg.append(r, hit);
      bars.push({ n, r, hit });
    }
    const wrap = h('div', { class: 'ifig-sub' });
    const head = h('div', { class: 'ifig-subhead' },
      h('strong', { text: T('电子能谱：边带分布', 'Electron spectrum: sideband populations') }),
      h('span', { class: 'ifig-formula', text: 'Pₙ = Jₙ²(2|g|)' }));
    const plotBox = h('div', { class: 'ifig-plot' }, svg);
    const tip = tooltip(plotBox);
    let probs = [];
    const sl = slider({
      label: T('耦合强度 |g|', 'coupling |g|'), min: 0, max: 4, step: 0.05, value: 1.2, format: (v) => v.toFixed(2),
      oninput: (g) => {
        probs = bars.map(({ n }) => besselJ(n, 2 * g) ** 2);
        bars.forEach(({ r, n }, i) => {
          const p = probs[i]; r.setAttribute('y', sy(p)); r.setAttribute('height', Math.max(0, sy(0) - sy(p)));
          r.setAttribute('aria-label', `n = ${n > 0 ? '+' : ''}${n}: ${(p * 100).toFixed(1)}%`);
        });
      },
    });
    const show = (i, evt) => {
      const { n } = bars[i];
      const [x, y] = evt && evt.clientX ? localXY(plotBox, evt) : [plotBox.clientWidth * (sx(n) / W), 30];
      tip.show([[(probs[i] * 100).toFixed(1) + '%', T('概率', 'probability')], [`n = ${n > 0 ? '+' : ''}${n}`, T(`能量 E₀ ${n >= 0 ? '+' : '−'} ${Math.abs(n)}ħω`, `energy E₀ ${n >= 0 ? '+' : '−'} ${Math.abs(n)}ħω`)]], x, y);
    };
    bars.forEach(({ r, hit }, i) => {
      hit.addEventListener('pointermove', (e) => show(i, e));
      hit.addEventListener('pointerleave', () => tip.hide());
      r.addEventListener('focus', () => show(i));
      r.addEventListener('blur', () => tip.hide());
    });
    wrap.append(head, h('div', { class: 'ifig-controls' }, sl.wrap), plotBox,
      h('p', { class: 'ifig-note', text: T('|g| 越大，电子与近场交换的光子越多，能谱展宽成一串以 ħω 为间隔的边带。示意计算，忽略能谱仪分辨率。', 'Larger |g| means more photons exchanged with the near field, spreading the spectrum into sidebands spaced by ħω. Idealized calculation; spectrometer resolution ignored.') }));
    sl.update();
    return { wrap };
  }

  /* ======================================================================
     2. k-gap vs ω-gap dispersion
     ====================================================================== */
  function buildKgap(fig, cx) {
    let mode = 'time', kappa = 0.18, kSel = 1;
    const W = 420, H = 380, x0 = 52, y0 = 20, pw = 350, ph = 300;
    const svg = svgRoot(W, H, T('色散关系', 'dispersion relation'));
    const { sx, sy } = plotArea(svg, { x0, y0, w: pw, hgt: ph, xr: [0.3, 1.7], yr: [0.3, 1.7] });
    svg.append(s('text', { x: x0 - 10, y: y0 + 8, 'text-anchor': 'end', class: 'ifig-axis-label', text: 'ω' }));
    svg.append(s('text', { x: x0 + pw, y: y0 + ph + 24, 'text-anchor': 'end', class: 'ifig-axis-label', text: 'k' }));
    svg.append(s('line', { x1: sx(1), x2: sx(1), y1: y0 + ph, y2: y0 + ph + 6, class: 'ifig-axis' }));
    const kTick = s('text', { x: sx(1), y: y0 + ph + 22, 'text-anchor': 'middle', class: 'ifig-tick' });
    const wTick = s('text', { x: x0 - 8, y: sy(1) + 4, 'text-anchor': 'end', class: 'ifig-tick' });
    svg.append(kTick, wTick, s('line', { x1: x0 - 6, x2: x0, y1: sy(1), y2: sy(1), class: 'ifig-axis' }));
    // light lines (unperturbed, folded)
    svg.append(s('path', { d: pathOf([[sx(0.3), sy(0.3)], [sx(1.7), sy(1.7)]]), class: 'ifig-light' }));
    svg.append(s('path', { d: pathOf([[sx(0.3), sy(1.7)], [sx(1.7), sy(0.3)]]), class: 'ifig-light' }));
    const gapFill = s('path', { class: 'ifig-gapfill' });
    const upper = s('path', { class: 'ifig-band' });
    const lower = s('path', { class: 'ifig-band' });
    const gapLabel = s('text', { class: 'ifig-gaplabel', 'text-anchor': 'middle' });
    const cross = s('line', { y1: y0, y2: y0 + ph, class: 'ifig-cross' });
    const dotU = s('circle', { r: 5, class: 'ifig-dot' }), dotL = s('circle', { r: 5, class: 'ifig-dot' });
    const hit = s('rect', { x: x0, y: y0, width: pw, height: ph, class: 'ifig-hit', tabindex: 0, role: 'slider', 'aria-valuemin': '0.3', 'aria-valuemax': '1.7' });
    svg.append(gapFill, upper, lower, gapLabel, cross, dotU, dotL, hit);

    // amplitude panel
    const W2 = 420, H2 = 380, ax0 = 40, ay0 = 20, apw = 360, aph = 300;
    const svg2 = svgRoot(W2, H2, T('模式振幅随时间或空间的演化', 'mode amplitude evolution'));
    plotArea(svg2, { x0: ax0, y0: ay0, w: apw, hgt: aph, xr: [0, 1], yr: [-1, 1] });
    svg2.append(s('line', { x1: ax0, x2: ax0 + apw, y1: ay0 + aph / 2, y2: ay0 + aph / 2, class: 'ifig-grid' }));
    const ampEnv1 = s('path', { class: 'ifig-env' }), ampEnv2 = s('path', { class: 'ifig-env' }), ampWave = s('path', { class: 'ifig-wave' });
    const ampX = s('text', { x: ax0 + apw, y: ay0 + aph + 22, 'text-anchor': 'end', class: 'ifig-axis-label' });
    const ampTitle = s('text', { x: ax0 + 6, y: ay0 + 14, class: 'ifig-cap' });
    svg2.append(ampEnv1, ampEnv2, ampWave, ampX, ampTitle);

    const tipBox = h('div', { class: 'ifig-plot' }, svg);
    const tip = tooltip(tipBox);
    const readout = h('p', { class: 'ifig-desc' });

    const setSub = (el, main, sub) => { el.replaceChildren(main); if (sub) el.append(s('tspan', { 'baseline-shift': 'sub', 'font-size': '75%', text: sub })); };
    function draw() {
      const ks = linspace(0.3, 1.7, 281);
      const up = [], lo = [];
      if (mode === 'time') {
        // ω = 1 ± sqrt((k−1)² − κ²); flat Re ω = 1 inside the k-gap
        for (const k of ks) {
          const r = (k - 1) ** 2 - kappa ** 2, re = r > 0 ? Math.sqrt(r) : 0;
          up.push([sx(k), sy(1 + re)]); lo.push([sx(k), sy(1 - re)]);
        }
        const g = linspace(1 - kappa, 1 + kappa, 81);
        const top = g.map((k) => [sx(k), sy(1 + Math.sqrt(Math.max(0, kappa ** 2 - (k - 1) ** 2)))]);
        const bot = g.map((k) => [sx(k), sy(1 - Math.sqrt(Math.max(0, kappa ** 2 - (k - 1) ** 2)))]).reverse();
        gapFill.setAttribute('d', kappa > 0 ? pathOf(top.concat(bot)) + 'Z' : '');
        gapLabel.setAttribute('x', sx(1)); gapLabel.setAttribute('y', sy(1 - kappa) + 26);
        gapLabel.textContent = kappa > 0.02 ? T('k-gap：±Im ω', 'k-gap: ±Im ω') : '';
        setSub(kTick, 'k', '0'); setSub(wTick, 'Ω/2', '');
      } else {
        // ω = 1 ± sqrt((k−1)² + κ²); forbidden frequency band 1−κ < ω < 1+κ
        for (const k of ks) {
          const re = Math.sqrt((k - 1) ** 2 + kappa ** 2);
          up.push([sx(k), sy(1 + re)]); lo.push([sx(k), sy(1 - re)]);
        }
        gapFill.setAttribute('d', kappa > 0 ? `M${x0} ${sy(1 + kappa)}H${x0 + pw}V${sy(1 - kappa)}H${x0}Z` : '');
        gapLabel.setAttribute('x', sx(1.42)); gapLabel.setAttribute('y', sy(1) + 5);
        gapLabel.textContent = kappa > 0.02 ? T('ω-gap', 'ω-gap') : '';
        setSub(kTick, 'k', 'B'); setSub(wTick, 'ω', 'B');
      }
      // split each band into the two visible branches (avoid joining across the plot)
      upper.setAttribute('d', pathOf(up.filter((p) => p[1] >= y0 - 1)));
      lower.setAttribute('d', pathOf(lo.filter((p) => p[1] <= y0 + ph + 1)));
      setHitLabel();
      pick();
    }
    // Time-periodic medium: k is conserved, so the reader picks k.
    // Space-periodic medium: ω is conserved, so the reader picks ω.
    let wSel = 1;
    const N = 300;
    const drawAmp = (env, xLabel, title, carrier) => {
      const xMax = 40, pts = linspace(0, xMax, N), norm = Math.max(...pts.map(env));
      const Y = (v) => ay0 + aph / 2 - (aph / 2 - 30) * v / norm; // leave room for the title
      ampWave.setAttribute('d', pathOf(pts.map((x) => [ax0 + x / xMax * apw, Y(Math.cos(carrier * x) * env(x))])));
      ampEnv1.setAttribute('d', pathOf(pts.map((x) => [ax0 + x / xMax * apw, Y(env(x))])));
      ampEnv2.setAttribute('d', pathOf(pts.map((x) => [ax0 + x / xMax * apw, Y(-env(x))])));
      ampX.textContent = xLabel; ampTitle.textContent = title;
    };
    function pickK(k) {
      kSel = k;
      const d = k - 1, r = d * d - kappa * kappa;
      let reU, reL, im = 0;
      if (r >= 0) { reU = 1 + Math.sqrt(r); reL = 1 - Math.sqrt(r); } else { reU = reL = 1; im = Math.sqrt(-r); }
      cross.setAttribute('x1', sx(k)); cross.setAttribute('x2', sx(k)); cross.setAttribute('y1', y0); cross.setAttribute('y2', y0 + ph);
      dotU.style.display = dotL.style.display = '';
      dotU.setAttribute('cx', sx(k)); dotU.setAttribute('cy', sy(Math.min(1.7, reU)));
      dotL.setAttribute('cx', sx(k)); dotL.setAttribute('cy', sy(Math.max(0.3, reL)));
      drawAmp((t) => Math.exp(im * t), T('时间 t →', 'time t →'),
        im > 0 ? T('带隙内：振幅按 e^(Im ω·t) 指数增长', 'inside the gap: amplitude grows as e^(Im ω·t)') : T('带隙外：振幅保持不变，只振荡', 'outside the gap: constant amplitude, pure oscillation'), 2.2);
      readout.replaceChildren(h('strong', { text: `k = ${fmt(k)} · ` }),
        im > 0 ? T(`处在 k-gap 中：频率实部锁定在 Ω/2，虚部 Im ω = ${fmt(im, 3)}。增益最大的模式（k₀ 处）会主导整个系统——“赢者通吃”。`, `inside the k-gap: Re ω is locked to Ω/2 and Im ω = ${fmt(im, 3)}. The mode with the largest gain (at k₀) dominates — “winner takes all”.`)
          : T(`在带隙外：ω = ${fmt(reU)} 或 ${fmt(reL)}，模式稳定传播。`, `outside the gap: ω = ${fmt(reU)} or ${fmt(reL)}; the mode propagates steadily.`));
      hit.setAttribute('aria-valuenow', fmt(k)); hit.setAttribute('aria-valuetext', `k = ${fmt(k)}${im > 0 ? `, Im ω = ${fmt(im, 3)}` : `, ω = ${fmt(reU)} / ${fmt(reL)}`}`);
      return [[`k = ${fmt(k)}`, ''], ...(im > 0 ? [[`Im ω = ±${fmt(im, 3)}`, T('增长 / 衰减', 'gain / loss')], ['Re ω = Ω/2', '']] : [[`ω = ${fmt(reU)}, ${fmt(reL)}`, T('两支能带', 'two branches')]])];
    }
    function pickW(w) {
      wSel = w;
      const d = w - 1, r = d * d - kappa * kappa;
      cross.setAttribute('x1', x0); cross.setAttribute('x2', x0 + pw); cross.setAttribute('y1', sy(w)); cross.setAttribute('y2', sy(w));
      if (r >= 0) {
        // propagating: the band reaches this frequency at k = k_B ± sqrt((ω−ω_B)² − κ²)
        const q = Math.sqrt(r);
        dotU.style.display = dotL.style.display = '';
        dotU.setAttribute('cx', sx(Math.min(1.7, 1 + q))); dotU.setAttribute('cy', sy(w));
        dotL.setAttribute('cx', sx(Math.max(0.3, 1 - q))); dotL.setAttribute('cy', sy(w));
        drawAmp(() => 1, T('空间位置 x →', 'position x →'), T('带隙外：光在空间中传播，振幅不变', 'outside the gap: light propagates, constant amplitude'), 2.2);
        readout.replaceChildren(h('strong', { text: `ω = ${fmt(w)} · ` }),
          T(`在带隙外：对应的波矢 k = ${fmt(1 - q)} 或 ${fmt(1 + q)}，光在空间周期结构中正常传播。`, `outside the gap: the matching wavevectors are k = ${fmt(1 - q)} or ${fmt(1 + q)}; light propagates through the spatially periodic medium.`));
        hit.setAttribute('aria-valuenow', fmt(w)); hit.setAttribute('aria-valuetext', `ω = ${fmt(w)}, k = ${fmt(1 - q)} / ${fmt(1 + q)}`);
        return [[`ω = ${fmt(w)}`, ''], [`k = ${fmt(1 - q)}, ${fmt(1 + q)}`, T('传播', 'propagating')]];
      }
      const imk = Math.sqrt(-r);
      dotU.style.display = dotL.style.display = 'none';
      drawAmp((x) => Math.exp(-imk * x), T('空间位置 x →', 'position x →'), T('频率落在 ω-gap 中：光在空间中指数衰减', 'frequency inside the ω-gap: light decays in space'), 2.2);
      readout.replaceChildren(h('strong', { text: `ω = ${fmt(w)} · ` }),
        T(`处在 ω-gap 中：没有实数波矢，Im k = ${fmt(imk, 3)}，光只能在空间中衰减（Bragg 反射）。带隙中心衰减最快。`, `inside the ω-gap: no real wavevector; Im k = ${fmt(imk, 3)}, so light decays in space (Bragg reflection). Decay is fastest at the gap centre.`));
      hit.setAttribute('aria-valuenow', fmt(w)); hit.setAttribute('aria-valuetext', `ω = ${fmt(w)}, Im k = ${fmt(imk, 3)}`);
      return [[`ω = ${fmt(w)}`, ''], [`Im k = ${fmt(imk, 3)}`, T('空间衰减', 'spatial decay')]];
    }
    const pick = () => (mode === 'time' ? pickK(kSel) : pickW(wSel));
    hit.addEventListener('pointermove', (e) => {
      const p = svgPoint(svg, e);
      const lines = mode === 'time'
        ? pickK(Math.min(1.7, Math.max(0.3, 0.3 + (p.x - x0) / pw * 1.4)))
        : pickW(Math.min(1.7, Math.max(0.3, 1.7 - (p.y - y0) / ph * 1.4)));
      const [x, y] = localXY(tipBox, e);
      tip.show(lines, x, y);
    });
    hit.addEventListener('pointerleave', () => tip.hide());
    hit.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 0.02, ArrowUp: 0.02, ArrowLeft: -0.02, ArrowDown: -0.02 }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      if (mode === 'time') pickK(Math.min(1.7, Math.max(0.3, kSel + step)));
      else pickW(Math.min(1.7, Math.max(0.3, wSel + step)));
    });
    const setHitLabel = () => hit.setAttribute('aria-label', mode === 'time' ? T('色散图：用方向键选择 k', 'Dispersion plot: use arrow keys to choose k') : T('色散图：用方向键选择频率 ω', 'Dispersion plot: use arrow keys to choose the frequency ω'));

    const seg = segmented([
      { label: T('时间周期 ε(t) · k-gap', 'Time-periodic ε(t) · k-gap'), value: 'time' },
      { label: T('空间周期 ε(x) · ω-gap', 'Space-periodic ε(x) · ω-gap'), value: 'space' },
    ], (v) => { mode = v; kSel = 1; wSel = 1; draw(); });
    const sl = slider({ label: T('调制强度', 'modulation'), min: 0, max: 0.3, step: 0.01, value: kappa, format: (v) => v.toFixed(2), oninput: (v) => { kappa = v; draw(); } });
    const legend = h('div', { class: 'ifig-legend' },
      h('span', {}, h('i', { class: 'k-band' }), T('能带 Re ω', 'band Re ω')),
      h('span', {}, h('i', { class: 'k-gap' }), T('带隙', 'gap')),
      h('span', {}, h('i', { class: 'k-light' }), T('未调制光锥', 'unmodulated light cone')));
    const card = h('div', { class: 'ifig-card' },
      h('div', { class: 'ifig-controls' }, seg, sl.wrap),
      h('div', { class: 'ifig-two' }, tipBox, h('div', { class: 'ifig-plot' }, svg2)),
      legend, readout,
      h('p', { class: 'ifig-note', text: T('耦合模近似下的示意计算（归一化单位，c = 1）。时间周期介质中波矢 k 守恒，所以选 k；空间周期介质中频率 ω 守恒，所以选 ω。在左图上移动鼠标，或聚焦后用方向键选择。', 'Coupled-mode sketch in normalized units (c = 1). In a time-periodic medium the wavevector k is conserved, so you choose k; in a space-periodic medium the frequency ω is conserved, so you choose ω. Move over the left plot, or focus it and use the arrow keys.') }));
    fig.prepend(card);
    sl.update();
    return card;
  }

  /* ======================================================================
     3. Anomaly concept map
     ====================================================================== */
  function buildAnomaly(fig, cx) {
    const W = cx ? 420 : 760, H = cx ? 470 : 400;
    const svg = svgRoot(W, H, T('量子反常与相关理论的概念图', 'Concept map: the quantum anomaly and related ideas'));
    const C = cx ? { id: 'c', x: 210, y: 235, rx: 116, ry: 54, name: 'anomaly', year: '1969' } : { id: 'c', x: 380, y: 200, rx: 112, ry: 54, name: 'anomaly', year: '1969' };
    const P = cx ? { ch: [104, 60], as: [316, 60], ah: [104, 410], cs: [316, 410] } : { ch: [140, 62], as: [620, 62], ah: [140, 338], cs: [620, 338] };
    const nodes = [
      { id: 'ch', x: P.ch[0], y: P.ch[1], name: 'Callan–Harvey', year: '1985', themes: ['top', 'left'] },
      { id: 'as', x: P.as[0], y: P.as[1], name: 'Atiyah–Singer', year: '1963', themes: ['top', 'right'] },
      { id: 'ah', x: P.ah[0], y: P.ah[1], name: 'Anderson–Higgs', year: '1950/1972', themes: ['left', 'bottom'] },
      { id: 'cs', x: P.cs[0], y: P.cs[1], name: 'Chern–Simons', year: '1974', themes: ['right', 'bottom'] },
    ];
    const themes = {
      top: { x: 380, y: 58, lines: ['Index theorem,', 'instantons'], nodes: ['ch', 'as'] },
      left: { x: 140, y: 192, lines: ['anomaly inflow,', 'topological defects'], nodes: ['ch', 'ah'] },
      right: { x: 620, y: 192, lines: ['quantum Hall effect,', 'chiral transport'], nodes: ['as', 'cs'] },
      bottom: { x: 380, y: 338, lines: ['symmetry breaking,', 'phase transition'], nodes: ['ah', 'cs'] },
    };
    const edgeEls = {}, nodeEls = {}, themeEls = {};
    for (const n of nodes) {
      const dx = C.x - n.x, dy = C.y - n.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const e = s('line', { x1: n.x + ux * 92, y1: n.y + uy * 48, x2: C.x - ux * 120, y2: C.y - uy * 58, class: 'ifig-edge', 'marker-start': 'url(#ifa)', 'marker-end': 'url(#ifa)' });
      edgeEls[n.id] = e; svg.append(e);
    }
    const defs = s('defs'); defs.innerHTML = '<marker id="ifa" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker>';
    svg.prepend(defs);
    const chips = h('div', { class: 'ifig-chips' });
    for (const [k, t] of Object.entries(themes)) {
      if (cx) {
        const c = h('button', { type: 'button', class: 'ifig-chip', text: t.lines.join(' ') });
        themeEls[k] = c; chips.append(c);
        continue;
      }
      const g = s('g', { class: 'ifig-theme', tabindex: 0, role: 'button' });
      t.lines.forEach((ln, i) => g.append(s('text', { x: t.x, y: t.y + i * 22, 'text-anchor': 'middle', text: ln })));
      g.setAttribute('aria-label', t.lines.join(' '));
      themeEls[k] = g; svg.append(g);
    }
    const mkNode = (n, center) => {
      const g = s('g', { class: 'ifig-node' + (center ? ' is-center' : ''), tabindex: 0, role: 'button', 'aria-label': `${n.name} (${n.year})` },
        s('ellipse', { cx: n.x, cy: n.y, rx: center ? n.rx : 96, ry: center ? n.ry : 44 }),
        s('text', { x: n.x, y: n.y - 4, 'text-anchor': 'middle', class: 'ifig-node-name', text: n.name }),
        s('text', { x: n.x, y: n.y + 20, 'text-anchor': 'middle', class: 'ifig-node-year', text: `(${n.year})` }));
      nodeEls[n.id] = g; svg.append(g); return g;
    };
    mkNode(C, true); nodes.forEach((n) => mkNode(n));
    const info = h('p', { class: 'ifig-desc' });
    const defaultInfo = T('将鼠标移到某个理论或主题上，查看它与“反常”之间的联系。', 'Hover or focus a theory or theme to see how it links to the anomaly.');
    info.textContent = defaultInfo;
    function focusOn({ node, theme }) {
      const activeNodes = new Set(), activeThemes = new Set();
      if (node === 'c') { nodes.forEach((n) => activeNodes.add(n.id)); Object.keys(themes).forEach((t) => activeThemes.add(t)); }
      else if (node) { activeNodes.add(node); nodes.find((n) => n.id === node).themes.forEach((t) => activeThemes.add(t)); }
      if (theme) { activeThemes.add(theme); themes[theme].nodes.forEach((n) => activeNodes.add(n)); }
      svg.classList.add('is-focus'); chips.classList.add('is-focus');
      nodes.forEach((n) => { nodeEls[n.id].classList.toggle('is-on', activeNodes.has(n.id)); edgeEls[n.id].classList.toggle('is-on', activeNodes.has(n.id)); });
      nodeEls.c.classList.add('is-on');
      Object.entries(themeEls).forEach(([k, el]) => el.classList.toggle('is-on', activeThemes.has(k)));
      if (node === 'c') info.replaceChildren(h('strong', { text: 'anomaly (1969)　' }), T('经典对称性在量子化后被破坏的现象。四周的理论都与它相连。', 'A classical symmetry broken by quantization. Each theory around it connects back to it.'));
      else if (node) { const n = nodes.find((x) => x.id === node); info.replaceChildren(h('strong', { text: `${n.name} (${n.year})　` }), T('相关主题：', 'related themes: ') + n.themes.map((t) => themes[t].lines.join(' ')).join('；')); }
      else info.replaceChildren(h('strong', { text: themes[theme].lines.join(' ') + '　' }), T('连接：', 'links ') + themes[theme].nodes.map((id) => nodes.find((n) => n.id === id).name).join(' · '));
    }
    const clear = () => { svg.classList.remove('is-focus'); chips.classList.remove('is-focus'); info.textContent = defaultInfo; };
    for (const [id, el] of Object.entries(nodeEls)) {
      el.addEventListener('pointerenter', () => focusOn({ node: id })); el.addEventListener('focus', () => focusOn({ node: id }));
      el.addEventListener('pointerleave', clear); el.addEventListener('blur', clear);
    }
    for (const [k, el] of Object.entries(themeEls)) {
      el.addEventListener('pointerenter', () => focusOn({ theme: k })); el.addEventListener('focus', () => focusOn({ theme: k }));
      el.addEventListener('pointerleave', clear); el.addEventListener('blur', clear);
    }
    // touch: tap toggles focus
    for (const el of [...Object.values(nodeEls), ...Object.values(themeEls)]) el.addEventListener('click', () => el.focus());
    const card = h('div', { class: 'ifig-card' }, svg, cx ? chips : null, info);
    fig.prepend(card);
    return card;
  }

  /* ======================================================================
     4. Weak-to-strong measurement
     ====================================================================== */
  function buildMeasurement(fig, cx) {
    let g = 0.4, p = 0.7;
    const W = cx ? 420 : 760, H = cx ? 320 : 300, x0 = 30, y0 = 20, pw = W - 50, ph = cx ? 240 : 230, XR = cx ? [-5, 5] : [-7, 7];
    const svg = svgRoot(W, H, T('测量仪表指针的读数分布', 'pointer reading distribution'));
    const { sx } = plotArea(svg, { x0, y0, w: pw, hgt: ph, xr: XR, yr: [0, 1] });
    for (let v = XR[0] + 1; v <= XR[1] - 1; v += 2) svg.append(s('text', { x: sx(v), y: y0 + ph + 20, 'text-anchor': 'middle', class: 'ifig-tick', text: String(v) }));
    svg.append(s('text', { x: x0 + pw, y: y0 + ph + 42, 'text-anchor': 'end', class: 'ifig-cap', text: T('指针读数 x / σ', 'pointer reading x / σ') }));
    const cUp = s('path', { class: 'ifig-comp up' }), cDn = s('path', { class: 'ifig-comp dn' }), total = s('path', { class: 'ifig-total' });
    const mean = s('line', { y1: y0, y2: y0 + ph, class: 'ifig-mean' });
    const meanLbl = s('text', { y: y0 + ph - 10, class: 'ifig-cap', 'text-anchor': 'start' });
    const lblUp = s('text', { class: 'ifig-direct up', 'text-anchor': 'middle', text: '|↑⟩' }), lblDn = s('text', { class: 'ifig-direct dn', 'text-anchor': 'middle', text: '|↓⟩' });
    const cross = s('line', { y1: y0, y2: y0 + ph, class: 'ifig-cross', style: 'opacity:0' });
    const hit = s('rect', { x: x0, y: y0, width: pw, height: ph, class: 'ifig-hit' });
    svg.append(total, cUp, cDn, mean, meanLbl, lblUp, lblDn, cross, hit);
    const box = h('div', { class: 'ifig-plot' }, svg);
    const tip = tooltip(box);
    const badge = h('span', { class: 'ifig-badge-pill' });
    const desc = h('p', { class: 'ifig-desc' });
    const G = (x, m) => Math.exp(-((x - m) ** 2) / 2);
    let scaleMax = 1;
    const ys = (v) => y0 + ph - v / scaleMax * (ph - 24);
    function draw() {
      const xs = linspace(XR[0], XR[1], 400);
      scaleMax = Math.max(...xs.map((x) => p * G(x, g) + (1 - p) * G(x, -g)), 0.5);
      cUp.setAttribute('d', pathOf(xs.map((x) => [sx(x), ys(p * G(x, g))])));
      cDn.setAttribute('d', pathOf(xs.map((x) => [sx(x), ys((1 - p) * G(x, -g))])));
      total.setAttribute('d', pathOf(xs.map((x) => [sx(x), ys(p * G(x, g) + (1 - p) * G(x, -g))])));
      const m = g * (2 * p - 1);
      mean.setAttribute('x1', sx(m)); mean.setAttribute('x2', sx(m));
      meanLbl.setAttribute('x', sx(m) + 8); meanLbl.textContent = `⟨x⟩ = ${fmt(m)}`;
      lblUp.setAttribute('x', sx(Math.min(XR[1] - 0.8, g))); lblUp.setAttribute('y', ys(p * G(g, g)) - 10);
      lblDn.setAttribute('x', sx(Math.max(XR[0] + 0.8, -g))); lblDn.setAttribute('y', ys((1 - p) * G(-g, -g)) - 10);
      const regime = g < 0.6 ? 'weak' : g < 1.8 ? 'mid' : 'strong';
      badge.textContent = { weak: T('弱测量', 'weak measurement'), mid: T('过渡区', 'crossover'), strong: T('投影（强）测量', 'projective (strong) measurement') }[regime];
      badge.dataset.regime = regime;
      desc.replaceChildren(h('strong', { text: `g/σ = ${fmt(g)} · ` }), {
        weak: T('两种结果的读数分布几乎完全重叠：单次读数几乎不扰动量子态，只有大量统计后的平均偏移 ⟨x⟩ = g⟨σz⟩ 才携带信息。', 'The two outcome distributions overlap almost completely: a single reading barely disturbs the state, and only the averaged shift ⟨x⟩ = g⟨σz⟩ carries information.'),
        mid: T('两峰开始分开：测量获取的信息增加，对量子态的扰动也随之增大。', 'The peaks begin to separate: the measurement gains information and disturbs the state more.'),
        strong: T('两峰完全分开：每次读数都明确对应 |↑⟩ 或 |↓⟩，量子态被投影——这就是“量子到经典”的转变。', 'The peaks are fully separated: each reading picks |↑⟩ or |↓⟩ and the state is projected — the quantum-to-classical transition.'),
      }[regime]);
    }
    hit.addEventListener('pointermove', (e) => {
      const pt = svgPoint(svg, e); const x = XR[0] + (pt.x - x0) / pw * (XR[1] - XR[0]);
      cross.setAttribute('x1', sx(x)); cross.setAttribute('x2', sx(x)); cross.style.opacity = 1;
      const [lx, ly] = localXY(box, e);
      tip.show([[fmt(p * G(x, g) + (1 - p) * G(x, -g), 3), T('总概率密度（未归一）', 'total density (unnormalized)')], [`x = ${fmt(x)}`, '']], lx, ly);
    });
    hit.addEventListener('pointerleave', () => { tip.hide(); cross.style.opacity = 0; });
    const s1 = slider({ label: T('测量强度 g/σ', 'strength g/σ'), min: 0.1, max: 4, step: 0.05, value: g, format: (v) => v.toFixed(2), oninput: (v) => { g = v; draw(); } });
    const s2 = slider({ label: T('初态 |α|² = P(↑)', 'initial |α|² = P(↑)'), min: 0, max: 1, step: 0.01, value: p, format: (v) => v.toFixed(2), oninput: (v) => { p = v; draw(); } });
    const header = h('div', { class: 'ifig-qc' },
      h('span', { class: 'ifig-qc-q', text: T('量子', 'Quantum') }),
      h('span', { class: 'ifig-qc-arrows' }, h('span', { class: 'to-c', text: T('测量 / 退相干 →', 'measurement / decoherence →') }), h('span', { class: 'to-q', text: T('← 量子化', '← quantization') })),
      h('span', { class: 'ifig-qc-c', text: T('经典', 'Classical') }), badge);
    const legend = h('div', { class: 'ifig-legend' },
      h('span', {}, h('i', { class: 'k-total' }), T('总读数分布', 'total distribution')),
      h('span', {}, h('i', { class: 'k-up' }), T('来自 |↑⟩', 'from |↑⟩')),
      h('span', {}, h('i', { class: 'k-dn' }), T('来自 |↓⟩', 'from |↓⟩')));
    const card = h('div', { class: 'ifig-card' }, header, h('div', { class: 'ifig-controls' }, s1.wrap, s2.wrap), box, legend, desc,
      h('p', { class: 'ifig-note', text: T('冯·诺依曼测量模型：自旋 ½ 与高斯指针耦合，指针宽度 σ = 1。', 'Von Neumann measurement model: a spin-½ coupled to a Gaussian pointer of width σ = 1.') }));
    fig.prepend(card);
    s1.update(); s2.update();
    return card;
  }

  /* ======================================================================
     5. Research concept triangle (three electron–light processes)
     ====================================================================== */
  function buildConcepts(fig, cx) {
    const W = cx ? 420 : 760, H = cx ? 500 : 470;
    const svg = svgRoot(W, H, T('三类自由电子与光相互作用过程的关系图', 'How three free-electron–light processes connect'));
    const defs = s('defs');
    defs.innerHTML = `<marker id="ifc" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker>
      <radialGradient id="ifc-core"><stop offset="0" stop-color="var(--color-lime)"/><stop offset="1" stop-color="var(--color-surface)"/></radialGradient>`;
    svg.append(defs);
    const P = cx ? { qfel: [210, 60], pinem: [92, 440], dla: [328, 440], topo: [210, 262] } : { qfel: [380, 72], pinem: [150, 392], dla: [610, 392], topo: [380, 262] };
    const NR = cx ? [88, 42] : [118, 46];
    const nodes = {
      qfel: { name: 'Quantum FEL', sub: T('光子辐射', 'photon radiation'), text: T('量子自由电子激光：自由电子把能量交给光场，产生辐射。', 'Quantum free-electron laser: free electrons give energy to the light field and radiate.') },
      pinem: { name: 'PINEM / UTEM', sub: T('平面波电子', 'plane-wave electron'), text: T('光子诱导近场电子显微与超快透射电镜：把电子当作平面波，它与近场交换整数个光子能量。', 'Photon-induced near-field electron microscopy and ultrafast TEM: the electron is treated as a plane wave that exchanges integer numbers of photon energies with the near field.') },
      dla: { name: 'DLA / ACHIP', sub: T('点状电子', 'point-like electron'), text: T('介质激光加速（ACHIP：芯片上的加速器）：把电子当作点粒子，在光场中被加速。', 'Dielectric laser acceleration (ACHIP: accelerator on a chip): the electron is treated as a point particle accelerated by the light field.') },
    };
    const links = [
      { id: 'ent', a: 'qfel', b: 'pinem', label: T('电子–光子纠缠', 'Electron–photon entanglement'), text: T('电子辐射或吸收光子之后，电子与光子的量子态可以纠缠在一起。', 'After an electron emits or absorbs a photon, the electron and photon states can be entangled.') },
      { id: 'acc', a: 'qfel', b: 'dla', label: T('加速–辐射对应', 'Acceleration–radiation correspondence'), text: T('电子被光加速与电子向光场辐射，是同一相互作用的两面（Pan & Gover, NJP 2021）。', 'Accelerating an electron with light and the electron radiating into light are two sides of one interaction (Pan & Gover, NJP 2021).') },
      { id: 'wpd', a: 'pinem', b: 'dla', label: T('波粒二象性', 'Wave–particle duality'), text: T('同一个电子，可以按平面波（PINEM）或点粒子（DLA）的图像来描述。', 'The same electron can be described as a plane wave (PINEM) or as a point particle (DLA).') },
    ];
    const linkEls = {}, labelEls = {}, nodeEls = {};
    const [tx, ty] = P.topo;
    svg.append(s('ellipse', { cx: tx, cy: ty, rx: cx ? 80 : 130, ry: cx ? 44 : 60, fill: 'url(#ifc-core)', class: 'ifig-core' }));
    svg.append(s('text', { x: tx, y: ty + 7, 'text-anchor': 'middle', class: 'ifig-core-text', text: T('拓扑光子学', 'Topological photonics') }));
    const chips = h('div', { class: 'ifig-chips' });
    for (const l of links) {
      const [x1, y1] = P[l.a], [x2, y2] = P[l.b];
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const pad = (ux2, uy2) => Math.hypot(NR[0] * ux2, NR[1] * uy2) * 0.92 + 6;
      const p = pad(ux, uy);
      const line = s('line', { x1: x1 + ux * p, y1: y1 + uy * p, x2: x2 - ux * p, y2: y2 - uy * p, class: 'ifig-edge', 'marker-start': 'url(#ifc)', 'marker-end': 'url(#ifc)' });
      linkEls[l.id] = line; svg.append(line);
      if (cx) { const c = h('button', { type: 'button', class: 'ifig-chip', text: l.label }); labelEls[l.id] = c; chips.append(c); continue; }
      // label along the edge, on the outside of the triangle
      let ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, nx = -uy, ny = ux;
      const side = ((mx + nx) - tx) ** 2 + ((my + ny) - ty) ** 2 > (mx - tx) ** 2 + (my - ty) ** 2 ? 1 : -1;
      const off = 34;
      const g = s('g', { class: 'ifig-theme', tabindex: 0, role: 'button', 'aria-label': l.label },
        s('text', { x: mx + nx * off * side, y: my + ny * off * side + 5, 'text-anchor': 'middle', transform: `rotate(${ang} ${mx + nx * off * side} ${my + ny * off * side})`, text: l.label }));
      labelEls[l.id] = g; svg.append(g);
    }
    for (const [id, n] of Object.entries(nodes)) {
      const [x, y] = P[id];
      const g = s('g', { class: 'ifig-node', tabindex: 0, role: 'button', 'aria-label': `${n.name}, ${n.sub}` },
        s('ellipse', { cx: x, cy: y, rx: NR[0], ry: NR[1] }),
        s('text', { x, y: y - 3, 'text-anchor': 'middle', class: 'ifig-node-name', text: n.name }),
        s('text', { x, y: y + 20, 'text-anchor': 'middle', class: 'ifig-node-year', text: n.sub }));
      nodeEls[id] = g; svg.append(g);
    }
    const info = h('p', { class: 'ifig-desc' });
    const dflt = T('将鼠标移到某个过程或连线上，查看它们之间的关系。', 'Hover or focus a process or a link to see how they relate.');
    info.textContent = dflt;
    const focusOn = (kind, id) => {
      const onN = new Set(), onL = new Set();
      if (kind === 'node') { onN.add(id); links.forEach((l) => { if (l.a === id || l.b === id) onL.add(l.id); }); }
      else { const l = links.find((x) => x.id === id); onL.add(id); onN.add(l.a); onN.add(l.b); }
      svg.classList.add('is-focus'); chips.classList.add('is-focus');
      Object.entries(nodeEls).forEach(([k, el]) => el.classList.toggle('is-on', onN.has(k)));
      Object.entries(linkEls).forEach(([k, el]) => el.classList.toggle('is-on', onL.has(k)));
      Object.entries(labelEls).forEach(([k, el]) => el.classList.toggle('is-on', onL.has(k)));
      if (kind === 'node') info.replaceChildren(h('strong', { text: `${nodes[id].name}　` }), nodes[id].text);
      else { const l = links.find((x) => x.id === id); info.replaceChildren(h('strong', { text: `${l.label}　` }), l.text); }
    };
    const clear = () => { svg.classList.remove('is-focus'); chips.classList.remove('is-focus'); info.textContent = dflt; };
    const bind = (el, kind, id) => {
      el.addEventListener('pointerenter', () => focusOn(kind, id)); el.addEventListener('focus', () => focusOn(kind, id));
      el.addEventListener('pointerleave', clear); el.addEventListener('blur', clear); el.addEventListener('click', () => el.focus());
    };
    Object.entries(nodeEls).forEach(([k, el]) => bind(el, 'node', k));
    Object.entries(labelEls).forEach(([k, el]) => bind(el, 'link', k));
    const card = h('div', { class: 'ifig-card' }, svg, cx ? chips : null, info);
    fig.prepend(card);
    return card;
  }

  /* ======================================================================
     6. Floquet engineering: driven lattice, quasienergy + discrete diffraction
     ====================================================================== */
  function buildFloquet(fig, cx) {
    let A = 1.0, Om = 7;
    const NS_ = 20, ZMAX = 8;
    // left: quasienergy band and Floquet replicas
    const W = 420, H = 360, x0 = 48, y0 = 16, pw = 352, ph = 290, YR = [-6, 6];
    const svg = svgRoot(W, H, T('周期驱动晶格的准能带', 'quasienergy bands of a driven lattice'));
    const { sx, sy } = plotArea(svg, { x0, y0, w: pw, hgt: ph, xr: [-Math.PI, Math.PI], yr: YR });
    const zone = s('rect', { x: x0, width: pw, class: 'ifig-zone' });
    svg.prepend(zone);
    [[-Math.PI, '−π'], [0, '0'], [Math.PI, 'π']].forEach(([v, l]) => svg.append(s('text', { x: sx(v), y: y0 + ph + 20, 'text-anchor': 'middle', class: 'ifig-tick', text: l })));
    svg.append(s('text', { x: x0 + pw, y: y0 + ph + 40, 'text-anchor': 'end', class: 'ifig-axis-label', text: 'k' }));
    svg.append(s('text', { x: x0 - 10, y: y0 + 8, 'text-anchor': 'end', class: 'ifig-axis-label', text: 'ε' }));
    const zoneLbl = s('text', { x: x0 + 6, class: 'ifig-cap' });
    const repl = s('g'), main = s('path', { class: 'ifig-band' }), orig = s('path', { class: 'ifig-light' });
    const omTop = s('text', { x: x0 - 8, 'text-anchor': 'end', class: 'ifig-tick' }), omBot = s('text', { x: x0 - 8, 'text-anchor': 'end', class: 'ifig-tick' });
    svg.append(orig, repl, main, zoneLbl, omTop, omBot);
    // right: discrete diffraction heat map
    const box = h('div', { class: 'ifig-plot ifig-heat' });
    const canvas = h('canvas', { width: 41 * 8, height: 240, 'aria-label': T('光在波导阵列中的离散衍射', 'discrete diffraction in a waveguide array'), role: 'img' });
    const heatAxis = h('div', { class: 'ifig-heat-axis' }, h('span', { text: T('← 波导序号 n →', '← waveguide n →') }), h('span', { text: T('传播距离 z ↓', 'propagation z ↓') }));
    box.append(h('div', { class: 'ifig-heat-title', text: T('从中间一根波导注入光：', 'Light launched into the central waveguide:') }), canvas, heatAxis);
    const tip = tooltip(box);
    const readout = h('p', { class: 'ifig-desc' });
    let Jeff = 1, field = [];
    function draw() {
      Jeff = besselJ(0, A);
      const half = Om / 2;
      zone.setAttribute('y', sy(Math.min(half, YR[1]))); zone.setAttribute('height', sy(Math.max(-half, YR[0])) - sy(Math.min(half, YR[1])));
      zoneLbl.setAttribute('y', sy(half) + 16); zoneLbl.textContent = T('Floquet 布里渊区', 'Floquet zone');
      omTop.setAttribute('y', sy(half) + 4); omTop.textContent = 'ħΩ/2';
      omBot.setAttribute('y', sy(-half) + 4); omBot.textContent = '−ħΩ/2';
      const ks = linspace(-Math.PI, Math.PI, 161);
      const band = (n) => ks.map((k) => [sx(k), sy(-2 * Jeff * Math.cos(k) + n * Om)]);
      main.setAttribute('d', pathOf(band(0)));
      orig.setAttribute('d', pathOf(ks.map((k) => [sx(k), sy(-2 * Math.cos(k))])));
      repl.replaceChildren(...[-2, -1, 1, 2].filter((n) => Math.abs(n * Om) - 2 < YR[1]).map((n) => s('path', { d: pathOf(band(n).filter((p) => p[1] >= y0 && p[1] <= y0 + ph)), class: 'ifig-replica' })));
      // diffraction |ψ_n(z)|² = J_n(2 J_eff z)²
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2D context unavailable');
      const cw = canvas.width / (2 * NS_ + 1), rows = canvas.height;
      const img = ctx.createImageData(canvas.width, rows);
      const css = getComputedStyle(fig);
      const hex = (v) => { const m = v.trim().match(/^#?([0-9a-f]{6})$/i); const n = parseInt(m ? m[1] : '0d7d5a', 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
      const hi = hex(css.getPropertyValue('--color-fig-green')), lo = [255, 255, 255];
      field = [];
      for (let r = 0; r < rows; r++) {
        const z = r / (rows - 1) * ZMAX, row = [];
        for (let n = -NS_; n <= NS_; n++) row.push(besselJ(n, 2 * Jeff * z) ** 2);
        field.push(row);
        for (let c = 0; c < 2 * NS_ + 1; c++) {
          const t = Math.sqrt(Math.min(1, row[c]));
          const col = lo.map((l, i) => Math.round(l + (hi[i] - l) * t));
          for (let px = Math.floor(c * cw); px < Math.floor((c + 1) * cw); px++) {
            const o = (r * canvas.width + px) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      const loc = Math.abs(Jeff) < 0.03;
      readout.replaceChildren(h('strong', {}, 'J', h('sub', { text: 'eff' }), ' / J = J', h('sub', { text: '0' }), `(A) = ${fmt(Jeff, 3)} · `),
        loc ? T('动力学局域化：等效耦合几乎为零，能带变平，光停留在注入的那根波导里，不再扩散。', 'Dynamic localization: the effective coupling vanishes, the band flattens and light stays in the launch waveguide.')
          : Jeff < 0 ? T('等效耦合变号：能带上下翻转，离散衍射仍然发生。', 'The effective coupling changes sign: the band flips, and discrete diffraction continues.')
            : T('驱动削弱了等效耦合：能带变窄，光在阵列中扩散得更慢。', 'The drive weakens the effective coupling: the band narrows and light spreads more slowly.'));
    }
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const c = Math.min(2 * NS_, Math.max(0, Math.floor((e.clientX - r.left) / r.width * (2 * NS_ + 1))));
      const row = Math.min(field.length - 1, Math.max(0, Math.floor((e.clientY - r.top) / r.height * field.length)));
      const [lx, ly] = localXY(box, e);
      tip.show([[(field[row][c] * 100).toFixed(1) + '%', T('光强', 'intensity')], [`n = ${c - NS_}`, `z = ${fmt(row / (field.length - 1) * ZMAX, 1)}`]], lx, ly);
    });
    canvas.addEventListener('pointerleave', () => tip.hide());
    const s1 = slider({ label: T('驱动强度 A', 'drive A'), min: 0, max: 6, step: 0.05, value: A, format: (v) => v.toFixed(2), oninput: (v) => { A = v; draw(); } });
    const s2 = slider({ label: T('驱动频率 ħΩ / J', 'drive ħΩ / J'), min: 5, max: 10, step: 0.1, value: Om, format: (v) => v.toFixed(1), oninput: (v) => { Om = v; draw(); } });
    const loc = h('button', { type: 'button', class: 'ifig-play', text: T('跳到局域化点 A ≈ 2.405', 'Jump to localization A ≈ 2.405') });
    loc.addEventListener('click', () => { s1.input.value = 2.405; s1.update(); });
    const header = h('div', { class: 'ifig-qc' },
      h('span', { class: 'ifig-chip is-static', text: T('经典波 · ε(r,t)', 'classical waves · ε(r,t)') }),
      h('span', { class: 'ifig-chip is-static', text: T('量子波 · A(r,t)·p̂', 'quantum waves · A(r,t)·p̂') }),
      h('span', { class: 'ifig-note', text: T('同一套周期驱动的数学适用于两者；这里以弯曲波导阵列中的光为例。', 'The same periodic-drive mathematics applies to both; here, light in a curved waveguide array.') }));
    const legend = h('div', { class: 'ifig-legend' },
      h('span', {}, h('i', { class: 'k-band' }), T('驱动后的准能带', 'driven quasienergy band')),
      h('span', {}, h('i', { class: 'k-replica' }), T('Floquet 复本（±nħΩ）', 'Floquet replicas (±nħΩ)')),
      h('span', {}, h('i', { class: 'k-light' }), T('未驱动能带', 'undriven band')));
    const card = h('div', { class: 'ifig-card' }, header, h('div', { class: 'ifig-controls' }, s1.wrap, s2.wrap, loc),
      h('div', { class: 'ifig-two' }, h('div', { class: 'ifig-plot' }, svg), box), legend, readout,
      h('p', { class: 'ifig-note' }, T('紧束缚晶格在高频驱动下的有效模型：等效耦合 J', 'Effective high-frequency model of a driven tight-binding lattice: J'), h('sub', { text: 'eff' }), ' = J·J', h('sub', { text: '0' }), T('(A)，第 n 根波导的光强为 J', '(A); intensity in waveguide n is J'), h('sub', { text: 'n' }), '²(2J', h('sub', { text: 'eff' }), T(' z)。示意计算，归一化单位。', ' z). Idealized, normalized units.')));
    fig.prepend(card);
    s2.update(); s1.update();
    return card;
  }

  const BUILDERS = { setup: buildSetup, kgap: buildKgap, anomaly: buildAnomaly, measurement: buildMeasurement, concepts: buildConcepts, floquet: buildFloquet };
  const COMPACT = 560;
  const init = () => {
    document.querySelectorAll('figure[data-ifig]').forEach((fig) => {
      const build = BUILDERS[fig.dataset.ifig];
      if (!build) return;
      const img = fig.querySelector(':scope > img');
      let card = null, compact = null;
      const render = () => {
        const cx = fig.clientWidth < COMPACT;
        if (cx === compact) return;
        compact = cx;
        // remove every card this figure owns, including a half-built one left by a failed build
        const clearCards = () => fig.querySelectorAll(':scope > .ifig-card').forEach((c) => c.remove());
        try {
          clearCards();
          card = null;
          card = build(fig, cx);
          if (!card) throw new Error('builder returned nothing');
          card.classList.toggle('is-compact', cx);
          if (img) { img.hidden = true; img.style.display = 'none'; }
          fig.classList.add('is-interactive');
        } catch (err) {
          console.error('figure failed', fig.dataset.ifig, err);
          clearCards(); // fall back to the original image only
          card = null;
          fig.classList.remove('is-interactive');
          if (img) { img.hidden = false; img.style.display = ''; }
        }
      };
      render();
      let timer = 0;
      new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(render, 150); }).observe(fig);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
