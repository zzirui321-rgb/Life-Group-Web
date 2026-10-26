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
   - floquet      driven two-band system: quasienergies + Rabi dynamics (interests page)
   - soliton      event / k-gap / Bragg formation from a numerical envelope model
   ========================================================================== */
(() => {
  const EN = document.documentElement.lang.startsWith('en');
  const T = (zh, en) => (EN ? en : zh);
  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const guide = window.LifeFigureGuide;

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

  function showReading(panel, item) {
    if (!item) return;
    panel.replaceChildren(h('h3', {text:item.title}), h('p', {text:item.text}));
    const list = h('ul', {class:'ifig-reading'});
    item.refs.forEach(([label, title, href]) => list.append(h('li', {}, h('a', {href, target:'_blank', rel:'noopener noreferrer'}, h('strong', {text:label}), h('span', {text:title + ' ↗'})))));
    panel.append(h('h4', {text:T('经典论文与延伸阅读','Foundational papers & further reading')}), list);
  }

  function addGuide(fig, card) {
    if (fig.dataset.ifig === 'soliton') return;
    const note = guide?.notes[fig.dataset.ifig];
    if (!note) return;
    const visual = h('div', {class:'ifig-visual'});
    const reading = card.querySelector('.ifig-context');
    [...card.childNodes].forEach(node=>visual.append(node));
    const aside = h('aside', {class:'ifig-guide', 'aria-label':T('图示阅读指南','Figure reading guide')},
      h('span',{class:'ifig-guide-kicker',text:T('读懂这张图','READ THE FIGURE')}), h('h3',{text:note[0]}), h('p',{text:note[1]}),
      h('h4',{text:T('试着操作','TRY IT')}), h('p',{text:note[2]}), h('h4',{text:T('留意什么','LOOK FOR')}), h('p',{text:note[3]}));
    card.classList.add('ifig-with-guide');
    card.append(visual,aside);
    if (reading) {
      card.classList.add('ifig-map-layout');
      card.append(reading);
    }
  }

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
      { n: 5, title: T('光学探测器', 'Optical detector'), text: T('可选的探测扩展：收集电子与结构作用后发出的光子，并与电子信号做符合测量，用于研究电子–光子关联；这不是 PINEM 能谱测量的必需环节。', 'An optional extension collects emitted photons in coincidence with electron signals to study electron–photon correlations; it is not required for a PINEM energy-spectrum measurement.') },
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
    const laserPacket = s('g', {class:'ifig-laser-packet'}, s('path', {d:packet(0,0,76,11,7), class:'ifig-photon'}));
    laserPacket.setAttribute('transform','translate(170 40) rotate(42.5)');
    svg.append(laserPacket);
    // 4: spectrometer
    svg.append(G(4,
      s('rect', { x: 652, y: 160, width: 76, height: 72, rx: 8, class: 'ifig-device' }),
      ...[-2, -1, 0, 1, 2].map((k, i) => s('rect', { x: 666 + i * 10, y: 216 - [10, 22, 30, 22, 10][i], width: 6, height: [10, 22, 30, 22, 10][i], rx: 2, class: 'ifig-device-bar' })),
      s('text', { x: 690, y: 254, class: 'ifig-cap', 'text-anchor': 'middle', text: T('电子能谱仪', 'spectrometer') })));
    // 5: emitted photon + detector
    const emitted = pathOf(linspace(0, 1, 120).map((u) => {
      const x = 340 + u * 190, y = 196 - u * 125, off = 6 * Math.sin(u * 16 * Math.PI) * Math.exp(-((u - 0.5) ** 2) * 6);
      return [x + off * 0.55, y + off * 0.84];
    }));
    svg.append(G(5,
      s('path', { d: emitted, class: 'ifig-emitted' }),
      s('line', { x1: 506, y1: 87, x2: 520, y2: 78, class: 'ifig-emitted-dir', 'marker-end': 'url(#ifg-arrow)' }),
      s('path', { d: 'M530 46 h52 a8 8 0 0 1 8 8 v34 a8 8 0 0 1 -8 8 h-52 a26 26 0 0 1 0 -50z', class: 'ifig-device' }),
      s('text', { x: 600, y: 76, class: 'ifig-cap', text: T('光学探测器', 'optical detector') })));
    const emittedPacket = s('g', {class:'ifig-emitted-packet', opacity:0},
      s('path', {d:packet(0,0,58,9,6),class:'ifig-emitted'}));
    const detectorPulse = s('circle', {cx:550,cy:71,r:9,class:'ifig-detector-pulse',opacity:0});
    svg.append(emittedPacket,detectorPulse);
    // numbered badges (also clickable)
    const badgePos = { 1: [62, 160], 2: [214, 104], 3: [340, 132], 4: [740, 156], 5: [556, 30] };
    const badges = {};
    for (const st of steps) {
      const [bx, by] = badgePos[st.n];
      const b = s('g', { class: 'ifig-badge', tabindex: 0, role: 'button', 'aria-label': `${st.n} ${st.title}` },
        s('circle', { cx: bx, cy: by, r: cx ? 21 : 13 }), s('text', { x: bx, y: by + (cx ? 8 : 5), 'text-anchor': 'middle', text: String(st.n) }));
      b.addEventListener('click', () => { stopAnimation(); select(st.n); });
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stopAnimation(); select(st.n); } });
      badges[st.n] = b; svg.append(b);
    }

    // step buttons + description
    const stepRow = h('div', { class: 'ifig-steps', role: 'group', 'aria-label':T('实验环节','Experiment stages') });
    const stepBtns = steps.map((st) => {
      const b = h('button', { type: 'button', 'aria-pressed': 'false' }, h('span', { class: 'ifig-step-n', text: String(st.n) }), st.title);
      b.addEventListener('click', () => { stopAnimation(); select(st.n); });
      stepRow.append(b);
      return b;
    });
    const play = h('button', { type: 'button', class: 'ifig-play', 'aria-pressed':'false', text: T('▶ 同步发射', '▶ Launch together') });
    stepRow.append(play);
    const desc = h('p', { class: 'ifig-desc' });
    let current = 0;
    function select(n) {
      current = n;
      for (const st of steps) {
        const on = n === 0 ? st.n === 1 || st.n === 2 : st.n === n;
        groups[st.n].classList.toggle('is-dim', !on);
        badges[st.n].classList.toggle('is-active', on);
        stepBtns[st.n - 1].setAttribute('aria-pressed', String(on));
      }
      const st = steps[n - 1];
      if (st) desc.replaceChildren(h('strong', { text: `${st.n} · ${st.title}　` }), st.text);
      else desc.replaceChildren(h('strong',{text:T('光与电子同步出发　','Light and electrons launch together　')}),T('两束脉冲沿不同路径到达纳米结构，在近场处实现时间与空间重叠。','The pulses follow different paths and overlap in space and time at the nanostructure.'));
      spec.wrap.classList.toggle('is-highlight', n === 4 || n === 3);
    }

    // packet animation along the beam
    let raf = 0, running = false;
    const motionPref = matchMedia('(prefers-reduced-motion: reduce)');
    function stopAnimation() {
      cancelAnimationFrame(raf); raf=0; running=false;
      play.textContent=T('▶ 同步发射','▶ Launch together'); play.setAttribute('aria-pressed','false');
    }
    function animate() {
      stopAnimation(); running=true;
      emittedPacket.setAttribute('opacity','0'); detectorPulse.setAttribute('opacity','0');
      groups[5].classList.remove('is-detected');
      play.textContent=T('Ⅱ 暂停','Ⅱ Pause'); play.setAttribute('aria-pressed','true');
      const t0 = performance.now(), dur = 4200;
      const tick = (now) => {
        const u = Math.min(1, (now - t0) / dur);
        const arrival = Math.min(1,u/0.5);
        const x = u<=0.5 ? 120+arrival*220 : 340+Math.min(1,(u-0.5)/0.44)*330;
        pk.setAttribute('transform', `translate(${x} 0)`);
        laserPacket.setAttribute('transform',`translate(${170+170*arrival} ${40+156*arrival}) rotate(42.5)`);
        laserPacket.style.opacity=String(u<=0.5 ? 1 : Math.max(0,1-(u-0.5)*8));
        pk.classList.toggle('is-shaped', x > 340);
        const optical=Math.max(0,Math.min(1,(u-.52)/.30));
        emittedPacket.setAttribute('transform',`translate(${340+190*optical} ${196-125*optical}) rotate(-33.3)`);
        emittedPacket.setAttribute('opacity',String(u>.52&&u<.84?1:0));
        const detected=u>=.82;
        groups[5].classList.toggle('is-detected',detected);
        detectorPulse.setAttribute('opacity',detected?String(Math.max(.25,1-(u-.82)*3)):'0');
        detectorPulse.setAttribute('r',String(8+Math.max(0,u-.82)*50));
        svg.dataset.opticalPhase=detected?'detected':u>.52?'travelling':'waiting';
        const stage = u<0.44 ? 0 : u<0.64 ? 3 : u<.87 ? 5 : 4;
        if (stage !== current) select(stage);
        if (u < 1) raf = requestAnimationFrame(tick);
        else stopAnimation();
      };
      raf = requestAnimationFrame(tick);
    }
    play.addEventListener('click', () => {
      if (running) { stopAnimation(); return; }
      if (motionPref.matches) {
        pk.setAttribute('transform','translate(670 0)');
        laserPacket.style.opacity='0';emittedPacket.setAttribute('opacity','0');
        groups[5].classList.add('is-detected');detectorPulse.setAttribute('opacity','1');
        svg.dataset.opticalPhase='detected';select(5);
      }
      else animate();
    });

    // PINEM spectrum
    const spec = buildPinem(cx);
    const card = h('div', { class: 'ifig-card' }, svg, stepRow, desc, spec.wrap);
    fig.prepend(card);
    const onHidden = () => { if(document.hidden || motionPref.matches) stopAnimation(); };
    document.addEventListener('visibilitychange',onHidden); motionPref.addEventListener('change',onHidden);
    const visible = new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stopAnimation();});visible.observe(fig);
    card.dispose=()=>{stopAnimation();visible.disconnect();document.removeEventListener('visibilitychange',onHidden);motionPref.removeEventListener('change',onHidden);};
    select(0);
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
      { id: 'ah', x: P.ah[0], y: P.ah[1], name: 'Anderson–Higgs', year: '1963/1964', themes: ['left', 'bottom'] },
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
    const info = h('div', { class: 'ifig-context' });
    showReading(info, guide?.anomaly.c);
    function focusOn({ node, theme }) {
      const activeNodes = new Set(), activeThemes = new Set();
      if (node === 'c') { nodes.forEach((n) => activeNodes.add(n.id)); Object.keys(themes).forEach((t) => activeThemes.add(t)); }
      else if (node) { activeNodes.add(node); nodes.find((n) => n.id === node).themes.forEach((t) => activeThemes.add(t)); }
      if (theme) { activeThemes.add(theme); themes[theme].nodes.forEach((n) => activeNodes.add(n)); }
      svg.classList.add('is-focus'); chips.classList.add('is-focus');
      nodes.forEach((n) => { nodeEls[n.id].classList.toggle('is-on', activeNodes.has(n.id)); edgeEls[n.id].classList.toggle('is-on', activeNodes.has(n.id)); });
      nodeEls.c.classList.add('is-on');
      Object.entries(themeEls).forEach(([k, el]) => el.classList.toggle('is-on', activeThemes.has(k)));
      showReading(info, guide?.anomaly[node || theme]);
    }
    for (const [id, el] of Object.entries(nodeEls)) {
      el.addEventListener('pointerenter', () => focusOn({ node: id })); el.addEventListener('focus', () => focusOn({ node: id }));
      el.addEventListener('click', () => focusOn({ node: id }));
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusOn({ node: id }); } });
    }
    for (const [k, el] of Object.entries(themeEls)) {
      el.addEventListener('pointerenter', () => focusOn({ theme: k })); el.addEventListener('focus', () => focusOn({ theme: k }));
      el.addEventListener('click', () => focusOn({ theme: k }));
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusOn({ theme: k }); } });
    }
    for (const [id, el] of Object.entries(edgeEls)) {
      el.addEventListener('pointerenter', () => focusOn({ node: id }));
      el.addEventListener('click', () => focusOn({ node: id }));
    }
    const card = h('div', { class: 'ifig-card' }, svg, cx ? chips : null, info);
    fig.prepend(card);
    return card;
  }

  /* ======================================================================
     4. Weak-to-strong measurement
     ====================================================================== */
  // Conditional Gaussian readout after erasing branch labels. Opposite linear
  // phases give relative phase q*x; eta is residual coherence, not mere overlap.
  function measurementDistribution(x, g, p, eta, coherent=true) {
    const q=5, gaussian=m=>Math.exp(-.5*(x-m)**2)/Math.sqrt(2*Math.PI);
    const a=p*gaussian(g),b=(1-p)*gaussian(-g),c=coherent?eta:0;
    const norm=1+2*c*Math.sqrt(p*(1-p))*Math.exp(-.5*(g*g+q*q));
    const interference=2*c*Math.sqrt(a*b)*Math.cos(q*x)/norm;
    return {a:a/norm,b:b/norm,interference,total:(a+b)/norm+interference};
  }
  function buildMeasurement(fig, cx) {
    let g=.4,p=.5,decoherence=0,coherent=true,raf=0,running=false;
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const W=cx?420:760,H=310,x0=36,y0=22,pw=W-54,ph=225,XR=[-7,7];
    const svg=svgRoot(W,H,T('重叠波包的干涉与退相干','Interference and decoherence of overlapping wave packets'));
    const {sx}=plotArea(svg,{x0,y0,w:pw,hgt:ph,xr:XR,yr:[0,1]});
    [-6,-4,-2,0,2,4,6].forEach(v=>svg.append(s('text',{x:sx(v),y:y0+ph+24,'text-anchor':'middle',class:'ifig-tick',text:String(v)})));
    svg.append(s('text',{x:x0+pw,y:299,'text-anchor':'end',class:'ifig-cap',text:T('读数位置 x / σ','readout position x / σ')}));
    const fill=s('path',{class:'ifig-interference-fill'}),total=s('path',{class:'ifig-total'}),up=s('path',{class:'ifig-comp up'}),down=s('path',{class:'ifig-comp dn'});
    svg.append(fill,up,down,total);
    const screen=h('canvas',{width:760,height:64,class:'ifig-fringe-screen',role:'img','aria-label':T('干涉条纹强度示意','Interference intensity pattern')});
    const screenCtx=screen.getContext('2d');if(!screenCtx)throw new Error('Canvas unavailable');
    const badge=h('span',{class:'ifig-badge-pill'}),desc=h('p',{class:'ifig-desc'}),readout=h('p',{class:'ifig-note'});
    const play=h('button',{type:'button',class:'ifig-play','aria-pressed':'false',text:T('▶ 看条纹消退','▶ Watch fringes fade')});
    const density=x=>measurementDistribution(x,g,p,1-decoherence,coherent);
    const sy=v=>y0+ph-v/.82*(ph-15);
    function draw(){
      const xs=linspace(-7,7,700),values=xs.map(density),points=values.map((d,i)=>[sx(xs[i]),sy(d.total)]);
      total.setAttribute('d',pathOf(points));fill.setAttribute('d',`M${sx(-7)} ${y0+ph}`+pathOf(points).replace(/^M/,'L')+`L${sx(7)} ${y0+ph}Z`);
      up.setAttribute('d',pathOf(values.map((d,i)=>[sx(xs[i]),sy(d.a)])));down.setAttribute('d',pathOf(values.map((d,i)=>[sx(xs[i]),sy(d.b)])));
      const rgb=name=>getComputedStyle(fig).getPropertyValue(name).trim().slice(1).match(/../g).map(v=>parseInt(v,16));
      const bg=rgb('--color-bg'),ink=rgb('--color-ink'),data=screenCtx.createImageData(760,64);
      for(let x=0;x<760;x++){const d=density(-7+14*x/759).total;for(let y=0;y<64;y++){
        const a=Math.min(1,d/.82)*(.55+.45*Math.sin(Math.PI*y/63)),i=4*(y*760+x);
        for(let c=0;c<3;c++)data.data[i+c]=Math.round(bg[c]+(ink[c]-bg[c])*a);data.data[i+3]=255;
      }}screenCtx.putImageData(data,0,0);
      const residual=coherent?1-decoherence:0;
      badge.textContent=coherent?(decoherence<.01?T('相干叠加','Coherent superposition'):decoherence>.99?T('条纹消失','Fringes washed out'):T('退相干中','Losing coherence')):T('统计混合','Statistical mixture');
      desc.textContent=coherent?T('两束波在重叠处相长、相消，形成条纹；退相干越强，条纹越淡。','The overlapping waves reinforce and cancel one another, creating fringes. Decoherence gradually washes them out.'):
        T('直接统计指针、不分选自旋结果时，两种概率相加；即使重叠，也没有干涉项。','Without selecting the spin outcome, pointer probabilities add. Overlap alone produces no interference term.');
      readout.textContent=coherent?T('相干读出：先擦除可区分的分支标记，再选取同一读出通道。','Coherent readout: erase distinguishable branch labels and select a common output channel.'):
        T('直接读数：保留原来两种指针结果的统计分布。','Direct readout: retain the original statistical distribution of the two pointer outcomes.');
      screen.dataset.coherence=String(residual);screen.dataset.separation=String(g);screen.dataset.mode=coherent?'coherent':'direct';
      screen.setAttribute('aria-label',badge.textContent+'. '+desc.textContent);
    }
    function stop(){cancelAnimationFrame(raf);raf=0;running=false;play.setAttribute('aria-pressed','false');play.textContent=T('▶ 看条纹消退','▶ Watch fringes fade');}
    const separation=slider({label:T('波包分离 g/σ','Packet separation g/σ'),min:.1,max:4,step:.05,value:g,format:v=>v.toFixed(2),oninput:v=>{g=v;draw();}});
    const coherence=slider({label:T('退相干','Decoherence'),min:0,max:1,step:.01,value:0,format:v=>Math.round(v*100)+'%',oninput:v=>{decoherence=v;draw();}});
    const population=slider({label:T('分支权重 P(↑)','Branch weight P(↑)'),min:0,max:1,step:.01,value:p,format:v=>v.toFixed(2),oninput:v=>{p=v;draw();}});
    [separation,coherence,population].forEach(control=>control.input.addEventListener('input',stop));
    const tabs=segmented([{value:true,label:T('相干读出 · 看干涉','Coherent readout · interference')},{value:false,label:T('直接读数 · 概率相加','Direct readout · probabilities add')}],value=>{stop();coherent=value;coherence.input.disabled=!value;play.disabled=!value;draw();});
    play.addEventListener('click',()=>{
      if(running){stop();return;}if(motion.matches){coherence.input.value=1;coherence.update();return;}
      running=true;play.textContent=T('Ⅱ 暂停消退','Ⅱ Pause fading');play.setAttribute('aria-pressed','true');
      if(decoherence>=.99){coherence.input.value=0;coherence.update();}
      const initial=decoherence,start=performance.now();
      const tick=now=>{coherence.input.value=Math.min(1,initial+(now-start)/3500);coherence.update();if(decoherence<1&&running)raf=requestAnimationFrame(tick);else stop();};raf=requestAnimationFrame(tick);
    });
    const details=h('details',{class:'ifig-original'},h('summary',{text:T('模型与读出条件','Model and readout conditions')}),population.wrap,
      h('p',{class:'ifig-note',text:T('两个高斯指针分支带有相对空间相位 5x；相干通道中按振幅相加，交叉项乘以剩余相干度 η=1−退相干。完全退相干或直接读数时，交叉项为零。曲线始终归一化，纵轴尺度固定。','The Gaussian branches carry relative spatial phase 5x. In the coherent channel, the interference term is multiplied by residual coherence η=1−decoherence. It vanishes for full decoherence or unconditioned direct readout. Curves remain normalized on a fixed vertical scale.')}),
      h('a',{class:'text-link',href:'https://doi.org/10.1103/PhysRevA.65.033818',target:'_blank',rel:'noopener noreferrer',text:T('量子擦除与干涉的读出条件 ↗','Quantum erasure and interference readout ↗')}));
    const card=h('div',{class:'ifig-card'},tabs,h('div',{class:'ifig-qc'},h('strong',{text:T('从条纹，到平滑的概率','From fringes to smooth probabilities')}),badge),
      h('div',{class:'ifig-controls'},separation.wrap,coherence.wrap,play),h('div',{class:'ifig-plot'},svg),screen,
      h('div',{class:'ifig-legend'},h('span',{},h('i',{class:'k-total'}),T('总读数','Total readout')),h('span',{},h('i',{class:'k-up'}),T('分支 ↑','Branch ↑')),h('span',{},h('i',{class:'k-dn'}),T('分支 ↓','Branch ↓'))),desc,readout,details);
    fig.prepend(card);separation.update();coherence.update();population.update();
    const hidden=()=>{if(document.hidden||motion.matches)stop();};document.addEventListener('visibilitychange',hidden);motion.addEventListener('change',hidden);
    const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop();});observer.observe(fig);
    card.dispose=()=>{stop();observer.disconnect();document.removeEventListener('visibilitychange',hidden);motion.removeEventListener('change',hidden);};
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
    const topo = s('g', {class:'ifig-node',tabindex:0,role:'button','aria-label':T('拓扑光子学','Topological photonics')});
    topo.append(...svg.querySelectorAll('.ifig-core, .ifig-core-text'));svg.append(topo);
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
    const info = h('div', { class: 'ifig-context' });
    showReading(info, guide?.concepts.pinem);
    const focusOn = (kind, id) => {
      const onN = new Set(), onL = new Set();
      if (kind === 'node') { onN.add(id); links.forEach((l) => { if (l.a === id || l.b === id) onL.add(l.id); }); }
      else { const l = links.find((x) => x.id === id); onL.add(id); onN.add(l.a); onN.add(l.b); }
      svg.classList.add('is-focus'); chips.classList.add('is-focus');
      Object.entries(nodeEls).forEach(([k, el]) => el.classList.toggle('is-on', onN.has(k)));
      Object.entries(linkEls).forEach(([k, el]) => el.classList.toggle('is-on', onL.has(k)));
      Object.entries(labelEls).forEach(([k, el]) => el.classList.toggle('is-on', onL.has(k)));
      showReading(info, guide?.concepts[id]);
    };
    const bind = (el, kind, id) => {
      el.addEventListener('pointerenter', () => focusOn(kind, id)); el.addEventListener('focus', () => focusOn(kind, id));
      el.addEventListener('click', () => { el.focus(); focusOn(kind,id); });
      el.addEventListener('keydown', e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focusOn(kind,id);}});
    };
    const selectTopo=()=>{svg.classList.remove('is-focus');showReading(info,guide?.concepts.topo);};
    topo.addEventListener('pointerenter',selectTopo);topo.addEventListener('focus',selectTopo);topo.addEventListener('click',selectTopo);
    topo.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectTopo();}});
    Object.entries(nodeEls).forEach(([k, el]) => bind(el, 'node', k));
    Object.entries(labelEls).forEach(([k, el]) => bind(el, 'link', k));
    Object.entries(linkEls).forEach(([k, el]) => {
      el.addEventListener('pointerenter', () => focusOn('link', k));
      el.addEventListener('click', () => focusOn('link', k));
    });
    const card = h('div', { class: 'ifig-card' }, svg, cx ? chips : null, info);
    fig.prepend(card);
    return card;
  }

  /* ======================================================================
     6. Floquet engineering: driven two-band system
        H(k,t) = E(k) σz + A cos(Ωt) σx,  E(k) = Δ/2 + B(1 − cos k)
        Quasienergies from the truncated Floquet Hamiltonian (exact numerics).
     ====================================================================== */
  // eigen-decomposition of a real symmetric matrix (cyclic Jacobi); returns {values, vectors[col]}
  function jacobiEigen(Ain) {
    const n = Ain.length, A = Ain.map((r) => r.slice()), V = Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r; });
    for (let sweep = 0; sweep < 50; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-20) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        const apq = A[p][q];
        if (Math.abs(apq) < 1e-14) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), sn = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - sn * akq; A[k][q] = sn * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - sn * aqk; A[q][k] = sn * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - sn * vkq; V[k][q] = sn * vkp + c * vkq; }
      }
    }
    return { values: A.map((r, i) => r[i]), vec: (j) => V.map((r) => r[j]) };
  }

  function buildFloquet(fig, cx) {
    const DELTA = 1, B = 0.5; // E(k) runs from Δ/2 = 0.5 to Δ/2 + 2B = 1.5
    let A = 0.3, Om = 2.0, kSel = Math.PI / 2;
    const E = (k) => DELTA / 2 + B * (1 - Math.cos(k));
    const css = getComputedStyle(fig);
    const hex = (name, fb) => { const m = css.getPropertyValue(name).trim().match(/^#?([0-9a-f]{6})$/i); const n = parseInt(m ? m[1] : fb, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const cLow = hex('--color-fig-green', '0d7d5a'), cUp = hex('--color-fig-warm', 'c4532a');
    const mix = (u) => `rgb(${cLow.map((l, i) => Math.round(l + (cUp[i] - l) * u)).join(',')})`;

    // left: quasienergy spectrum
    const W = 420, H = 380, x0 = 48, y0 = 16, pw = 352, ph = 300, YR = [-2, 2];
    const svg = svgRoot(W, H, T('驱动两能带系统的准能谱', 'quasienergy spectrum of a driven two-band system'));
    const { sx, sy } = plotArea(svg, { x0, y0, w: pw, hgt: ph, xr: [-Math.PI, Math.PI], yr: YR });
    const zone = s('rect', { x: x0, width: pw, class: 'ifig-zone' });
    svg.prepend(zone);
    [[-Math.PI, '−π'], [0, '0'], [Math.PI, 'π']].forEach(([v, l]) => svg.append(s('text', { x: sx(v), y: y0 + ph + 20, 'text-anchor': 'middle', class: 'ifig-tick', text: l })));
    [-2, -1, 0, 1, 2].forEach((v) => svg.append(s('text', { x: x0 - 8, y: sy(v) + 4, 'text-anchor': 'end', class: 'ifig-tick', text: String(v) })));
    svg.append(s('text', { x: x0 + pw, y: y0 + ph + 40, 'text-anchor': 'end', class: 'ifig-axis-label', text: 'k' }));
    svg.append(s('text', { x: x0 - 26, y: y0 + ph / 4 + 6, 'text-anchor': 'end', class: 'ifig-axis-label', text: 'ε' }));
    const bare = s('g'), dots = s('g');
    const cross = s('line', { y1: y0, y2: y0 + ph, class: 'ifig-cross' });
    const hit = s('rect', { x: x0, y: y0, width: pw, height: ph, class: 'ifig-hit', tabindex: 0, role: 'slider', 'aria-valuemin': '-3.14', 'aria-valuemax': '3.14', 'aria-label': T('准能谱：用方向键选择 k', 'Quasienergy spectrum: use arrow keys to choose k') });
    const clipId = 'ifq-clip-' + Math.random().toString(36).slice(2, 7);
    const cdefs = s('defs'); cdefs.append(s('clipPath', { id: clipId }, s('rect', { x: x0, y: y0, width: pw, height: ph })));
    bare.setAttribute('clip-path', `url(#${clipId})`); dots.setAttribute('clip-path', `url(#${clipId})`);
    svg.append(cdefs, bare, dots, cross, hit);
    const box = h('div', { class: 'ifig-plot' }, svg);
    const tip = tooltip(box);

    // right: upper-band population over time at the chosen k
    const W2 = 420, H2 = 380, ax0 = 44, ay0 = 44, apw = 356, aph = 272;
    const svg2 = svgRoot(W2, H2, T('上能带布居随时间的变化', 'upper-band population versus time'));
    const pa = plotArea(svg2, { x0: ax0, y0: ay0, w: apw, hgt: aph, xr: [0, 1], yr: [0, 1] });
    [0, 0.5, 1].forEach((v) => { svg2.append(s('line', { x1: ax0, x2: ax0 + apw, y1: pa.sy(v), y2: pa.sy(v), class: 'ifig-grid' })); svg2.append(s('text', { x: ax0 - 8, y: pa.sy(v) + 4, 'text-anchor': 'end', class: 'ifig-tick', text: String(v) })); });
    const popLine = s('path', { class: 'ifig-pop' });
    const popTitle = s('text', { x: ax0, y: 22, class: 'ifig-cap' });
    const popX = s('text', { x: ax0 + apw, y: ay0 + aph + 22, 'text-anchor': 'end', class: 'ifig-axis-label' });
    const timeTicks = [0, 0.5, 1].map(fraction => s('text', { x: ax0 + fraction * apw, y: ay0 + aph + 20, 'text-anchor': fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle', class: 'ifig-tick' }));
    popX.setAttribute('y', ay0 + aph + 45);
    svg2.append(popLine, popTitle, popX, ...timeTicks);
    const readout = h('p', { class: 'ifig-desc' });

    let spectrum = []; // per k: [{e, wUp, wDn}]
    const KS = linspace(0, Math.PI, cx ? 61 : 75); // E(k) is even in k: compute half, mirror
    function computeSpectrum() {
      const M = Math.min(9, Math.ceil(2.2 / Om) + 3), nb = 2 * M + 1, n = 2 * nb;
      spectrum = KS.map((k) => {
        const e = E(k);
        const Hm = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let b = 0; b < nb; b++) {
          const m = b - M;
          Hm[2 * b][2 * b] = e + m * Om; // upper band, photon index m
          Hm[2 * b + 1][2 * b + 1] = -e + m * Om; // lower band
          if (b + 1 < nb) { // A cos(Ωt) σx couples m ↔ m±1 with amplitude A/2
            Hm[2 * b][2 * (b + 1) + 1] = Hm[2 * (b + 1) + 1][2 * b] = A / 2;
            Hm[2 * b + 1][2 * (b + 1)] = Hm[2 * (b + 1)][2 * b + 1] = A / 2;
          }
        }
        const { values, vec } = jacobiEigen(Hm);
        const out = [];
        values.forEach((val, j) => {
          if (val < -Om / 2 || val >= Om / 2) return; // keep the central Floquet zone (best converged)
          const v = vec(j);
          // replica shifted by pΩ has photon-0 weight equal to the original's weight at m = −p
          for (let p = -8; p <= 8; p++) {
            const ev = val + p * Om;
            if (ev < YR[0] - 0.05 || ev > YR[1] + 0.05) continue;
            const b = -p + M;
            if (b < 0 || b >= nb) continue;
            out.push({ e: ev, wUp: v[2 * b] ** 2, wDn: v[2 * b + 1] ** 2 });
          }
        });
        return out;
      });
    }
    function drawSpectrum() {
      zone.setAttribute('y', sy(Math.min(Om / 2, YR[1]))); zone.setAttribute('height', sy(Math.max(-Om / 2, YR[0])) - sy(Math.min(Om / 2, YR[1])));
      // uncoupled ladder ±E(k) + nΩ
      const ks = linspace(-Math.PI, Math.PI, 121), paths = [];
      for (let nn = -8; nn <= 8; nn++) for (const sgn of [1, -1]) {
        const pts = ks.map((k) => [sx(k), sy(sgn * E(k) + nn * Om)]);
        if (pts.some((q) => q[1] > y0 && q[1] < y0 + ph)) paths.push(s('path', { d: pathOf(pts), class: 'ifig-replica' }));
      }
      bare.replaceChildren(...paths);
      const nodes = [];
      KS.forEach((k, i) => {
        for (const kk of k === 0 ? [0] : [k, -k]) for (const q of spectrum[i]) {
          const w = q.wUp + q.wDn;
          nodes.push(s('circle', { cx: sx(kk).toFixed(1), cy: sy(q.e).toFixed(1), r: cx ? 2.6 : 2.2, fill: mix(w > 1e-9 ? q.wUp / w : 0.5), 'fill-opacity': Math.max(0.1, Math.min(1, w * 1.15)).toFixed(2) }));
        }
      });
      dots.replaceChildren(...nodes);
    }
    // time evolution at one k (RK4, starts in the lower band)
    function evolve(k) {
      const e = E(k), Tdrive = 2 * Math.PI / Om;
      const tMax = Math.min(160, 3 * 2 * Math.PI / Math.max(A, 0.12));
      const dt = Math.min(Tdrive, Math.PI / e) / 40, steps = Math.ceil(tMax / dt), every = Math.max(1, Math.floor(steps / 400));
      let ur = 0, ui = 0, dr = 1, di = 0; // ψ = (up, down)
      const f = (t, s) => { // i dψ/dt = Hψ  →  dψ/dt = −i Hψ
        const c = A * Math.cos(Om * t);
        const hu_r = e * s[0] + c * s[2], hu_i = e * s[1] + c * s[3];
        const hd_r = -e * s[2] + c * s[0], hd_i = -e * s[3] + c * s[1];
        return [hu_i, -hu_r, hd_i, -hd_r];
      };
      const pts = [];
      let st = [ur, ui, dr, di];
      for (let i = 0; i <= steps; i++) {
        const t = i * dt;
        if (i % every === 0) pts.push([t, st[0] ** 2 + st[1] ** 2]);
        const k1 = f(t, st), s2 = st.map((v, j) => v + dt / 2 * k1[j]);
        const k2 = f(t + dt / 2, s2), s3 = st.map((v, j) => v + dt / 2 * k2[j]);
        const k3 = f(t + dt / 2, s3), s4 = st.map((v, j) => v + dt * k3[j]);
        const k4 = f(t + dt, s4);
        st = st.map((v, j) => v + dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      }
      return { pts, tMax };
    }
    const resonance = (k) => { // nearest odd-photon resonance 2E = nΩ
      const r = 2 * E(k) / Om, n = Math.max(1, 2 * Math.round((r - 1) / 2) + 1);
      return { n, detune: 2 * E(k) - n * Om };
    };
    function pick(k) {
      kSel = k;
      cross.setAttribute('x1', sx(k)); cross.setAttribute('x2', sx(k));
      const { pts, tMax } = evolve(Math.abs(k));
      timeTicks.forEach((tick, i) => { tick.textContent = fmt(i * tMax / 2, 1); });
      popLine.setAttribute('d', pathOf(pts.map(([t, p]) => [ax0 + t / tMax * apw, pa.sy(p)])));
      const pMax = Math.max(...pts.map((q) => q[1]));
      const { n, detune } = resonance(k);
      popTitle.textContent = T(`k = ${fmt(k)}：上能带布居，最大 ${(pMax * 100).toFixed(0)}%`, `k = ${fmt(k)}: upper-band population, max ${(pMax * 100).toFixed(0)}%`);
      popX.textContent = T('时间 t →', 'time t →');
      hit.setAttribute('aria-valuenow', fmt(k));
      hit.setAttribute('aria-valuetext', `k = ${fmt(k)}, ${(pMax * 100).toFixed(0)}%`);
      const near = Math.abs(detune) < Math.max(0.6 * A, 0.04);
      readout.replaceChildren(h('strong', { text: `k = ${fmt(k)} · ` }),
        A === 0 ? T('驱动为零：两条能带不耦合，电子保持在下能带，上能带布居为零。', 'Zero drive: the bands are uncoupled; the electron stays in the lower band and the upper-band population is zero.')
          : near ? T(`接近${n === 1 ? '单光子' : ` ${n} 光子`}共振（2E = ${n === 1 ? '' : n}ħΩ）：驱动把电子在两条能带之间来回搬运（Rabi 振荡），准能谱在这里打开 Floquet 能隙。`, `near the ${n === 1 ? 'one' : n}-photon resonance (2E = ${n === 1 ? '' : n}ħΩ): the drive moves the electron back and forth between the bands (Rabi oscillation), and a Floquet gap opens here.`)
          : T('远离共振：电子基本留在下能带，只有小幅振荡。', 'off resonance: the electron stays mostly in the lower band, with small oscillations.'));
      return [[`k = ${fmt(k)}`, ''], [`${(pMax * 100).toFixed(0)}%`, T('上能带最大布居', 'max upper-band population')]];
    }
    const summary = h('p', { class: 'ifig-note' });
    function updateSummary() {
      const lo = DELTA, hi = DELTA + 4 * B; // one-photon resonance window for Ω
      let txt;
      if (A === 0) txt = T('驱动强度 A = 0：显示未耦合的能带及其 Floquet 复本，交叉处没有驱动打开的能隙。', 'Drive A = 0: uncoupled bands and their Floquet replicas; no drive-induced gaps open at their crossings.');
      else if (Om > hi) txt = T(`ħΩ = ${fmt(Om)} 大于两能带的最大能量差 ${fmt(hi)}：复本彼此分开，没有共振，能带几乎不受影响。把频率调小试试。`, `ħΩ = ${fmt(Om)} exceeds the largest band separation ${fmt(hi)}: replicas stay apart and nothing resonates. Try lowering the frequency.`);
      else if (Om >= lo) { const kr = Math.acos(1 - (Om / 2 - DELTA / 2) / B); txt = T(`单光子共振出现在 k = ±${fmt(kr)}：上能带的复本与下能带交叉处被驱动耦合打开，能隙约为 A = ${fmt(A)}（旋转波近似）。`, `One-photon resonance at k = ±${fmt(kr)}: where the replica of the upper band crosses the lower band, the drive opens a gap of about A = ${fmt(A)} (rotating-wave approximation).`); }
      else txt = T(`频率较低，复本更密：出现多光子共振，能隙随阶数迅速变小。这个模型里只有奇数光子共振能打开能隙（宇称选择定则）。`, `At low frequency the replicas crowd together: multi-photon resonances appear, with gaps shrinking quickly with order. In this model only odd-photon resonances open gaps (a parity selection rule).`);
      summary.textContent = txt;
    }
    let raf = 0, sweepRaf = 0, sweeping = false, lastSweepFrame = 0;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const redraw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!fig.isConnected) return;
        computeSpectrum(); drawSpectrum(); updateSummary(); pick(kSel);
      });
    };
    hit.addEventListener('pointermove', (e) => {
      const p = svgPoint(svg, e);
      const lines = pick(Math.min(Math.PI, Math.max(-Math.PI, -Math.PI + (p.x - x0) / pw * 2 * Math.PI)));
      const [lx, ly] = localXY(box, e);
      tip.show(lines, lx, ly);
    });
    hit.addEventListener('pointerleave', () => tip.hide());
    hit.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[e.key];
      if (step === undefined) return;
      e.preventDefault(); pick(Math.min(Math.PI, Math.max(-Math.PI, kSel + step)));
    });
    const s1 = slider({ label: T('驱动强度 A', 'drive A'), min: 0, max: 0.8, step: 0.01, value: A, format: (v) => v.toFixed(2), oninput: (v) => { A = v; redraw(); } });
    const s2 = slider({ label: T('驱动频率 ħΩ', 'drive ħΩ'), min: 0.5, max: 3.5, step: 0.01, value: Om, format: (v) => v.toFixed(2), oninput: (v) => { Om = v; redraw(); } });
    const demo = h('button', { type: 'button', class: 'ifig-play', 'aria-pressed': 'false', text: T('▶ 扫描驱动频率', '▶ Sweep the frequency') });
    const stopSweep = () => {
      cancelAnimationFrame(sweepRaf);
      sweepRaf = 0;
      sweeping = false;
      demo.textContent = T('▶ 扫描驱动频率', '▶ Sweep the frequency');
      demo.setAttribute('aria-pressed', 'false');
    };
    demo.addEventListener('click', () => {
      if (sweeping) { stopSweep(); return; }
      if (motionPreference.matches) { s2.input.value = 2; s2.update(); return; }
      sweeping = true;
      demo.textContent = T('Ⅱ 暂停扫描', 'Ⅱ Pause sweep');
      demo.setAttribute('aria-pressed', 'true');
      const t0 = performance.now(), dur = 6000, from = 3.4, to = 0.6;
      lastSweepFrame = 0;
      const tick = (now) => {
        if (!sweeping || document.hidden || !fig.isConnected) { stopSweep(); return; }
        const u = Math.min(1, (now - t0) / dur);
        // The spectrum requires diagonalization; cap updates at 12.5 Hz.
        if (now - lastSweepFrame >= 80 || u === 1) {
          lastSweepFrame = now;
          s2.input.value = (from + (to - from) * u).toFixed(2);
          s2.update();
        }
        if (u < 1) sweepRaf = requestAnimationFrame(tick); else stopSweep();
      };
      sweepRaf = requestAnimationFrame(tick);
    });
    [s1.input, s2.input].forEach(input => input.addEventListener('input', stopSweep));
    const onVisibility = () => { if (document.hidden) stopSweep(); };
    const onMotion = () => { if (motionPreference.matches) stopSweep(); };
    document.addEventListener('visibilitychange', onVisibility);
    motionPreference.addEventListener('change', onMotion);
    const visibility = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) stopSweep();
    });
    visibility.observe(fig);
    const header = h('div', { class: 'ifig-qc' },
      h('span', { class: 'ifig-chip is-static', text: T('经典波 · ε(r,t)', 'classical waves · ε(r,t)') }),
      h('span', { class: 'ifig-chip is-static', text: T('量子波 · A(r,t)·p̂', 'quantum waves · A(r,t)·p̂') }),
      h('span', { class: 'ifig-note', text: T('同一套周期驱动的数学适用于两者；这里以两条能带之间的周期驱动为例：驱动频率降低时，能带的 Floquet 复本相互交叉并发生耦合。', 'The same periodic-drive mathematics applies to both; here, a periodic drive between two bands: as the frequency decreases, Floquet replicas of the bands cross and couple.') }));
    const legend = h('div', { class: 'ifig-legend' },
      h('span', {}, h('i', { class: 'k-lower' }), T('下能带特征', 'lower-band character')),
      h('span', {}, h('i', { class: 'k-upper' }), T('上能带特征', 'upper-band character')),
      h('span', {}, h('i', { class: 'k-replica' }), T('未耦合的复本 ±E(k) + nħΩ', 'uncoupled replicas ±E(k) + nħΩ')),
      h('span', {}, h('i', { class: 'k-zone' }), T('Floquet 布里渊区', 'Floquet zone')));
    const card = h('div', { class: 'ifig-card' }, header, h('div', { class: 'ifig-controls' }, s1.wrap, s2.wrap, demo),
      h('div', { class: 'ifig-two' }, box, h('div', { class: 'ifig-plot' }, svg2)), legend, summary, readout,
      h('p', { class: 'ifig-note', text: T('模型：H(k,t) = E(k)σz + A cos(Ωt)σx，E(k) = Δ/2 + B(1 − cos k)，Δ = 1，B = 0.5。准能谱由截断的 Floquet 哈密顿量数值对角化得到；点的颜色表示上 / 下能带成分，深浅表示与未驱动能带的重叠。右图从下能带出发数值求解薛定谔方程。在左图上移动鼠标或用方向键选择 k。', 'Model: H(k,t) = E(k)σz + A cos(Ωt)σx with E(k) = Δ/2 + B(1 − cos k), Δ = 1, B = 0.5. Quasienergies come from numerically diagonalizing the truncated Floquet Hamiltonian; dot colour shows upper / lower-band character and opacity the overlap with the undriven bands. The right panel integrates the Schrödinger equation starting in the lower band. Move over the left plot, or use the arrow keys, to choose k.') }));
    fig.prepend(card);
    card.dispose = () => {
      stopSweep(); cancelAnimationFrame(raf); visibility.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionPreference.removeEventListener('change', onMotion);
    };
    s1.update(); s2.update();
    return card;
  }

  /* Soliton localization: analytic envelopes, not a material-specific solver. */
  function buildSoliton(fig) {
    const model=window.LifeSolitonModel;if(!model)throw new Error('Soliton model unavailable');
    let mode='space',frames=[],frame=0,raf=0,job=0,timer=0,playing=false,last=0,visibleNow=false,userPaused=false,disposed=false;
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const canvas=h('canvas',{width:960,height:480,class:'ifig-soliton-stage',role:'img','aria-label':T('空间孤子的时空波面','Spacetime surface of a spatial soliton')});
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
    const heading=h('h3',{class:'ifig-soliton-headline'}),caption=h('p',{class:'ifig-soliton-caption'});
    const phase=h('span',{class:'ifig-soliton-tag'});
    const play=h('button',{type:'button',class:'ifig-play',text:T('载入波面…','Loading…'),disabled:''});
    const css=getComputedStyle(fig),color=name=>css.getPropertyValue(name).trim();
    const ink=color('--color-ink'),grid=color('--color-line'),green=color('--color-fig-green'),rose=color('--color-rose');
    const project=(x,t,intensity)=>[95+(x+8)/16*650+t/16*170,410-t/16*205-intensity*155];
    function draw(){
      if(!frames.length)return;
      const current=frames[frame],maximum=.5;
      ctx.clearRect(0,0,960,480);ctx.lineJoin='round';ctx.lineCap='round';
      const stroke=(pts,c,w,alpha=1)=>{ctx.globalAlpha=alpha;ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
      for(let x=-8;x<=8;x+=2)stroke([project(x,0,0),project(x,16,0)],grid,1,.5);
      for(let t=0;t<=16;t+=2)stroke([project(-8,t,0),project(8,t,0)],grid,1,.5);
      const tone=mode==='space'?green:rose;
      // All slices come from the numerical envelope solution. The bright slice
      // marks physical time; faint future slices provide a readable overview.
      for(let index=frames.length-1;index>=0;index-=7){
        const sample=frames[index],past=index<=frame;
        const pts=sample.positions.map((x,i)=>project(x,sample.time,sample.values[i]/maximum));
        if(past){ctx.globalAlpha=.045;ctx.fillStyle=tone;ctx.beginPath();const first=project(-8,sample.time,0);ctx.moveTo(...first);pts.forEach(p=>ctx.lineTo(...p));ctx.lineTo(...project(8,sample.time,0));ctx.closePath();ctx.fill();}
        stroke(pts,tone,past?1.8:1,past?.5:.14);
      }
      // Longitudinal lines expose the temporal pulse's curved profile, rather
      // than leaving a stack of horizontal slices that looks like a flat wall.
      for(let x=-8;x<=8;x+=2){
        const index=Math.round((x+8)/16*(current.values.length-1));
        stroke(frames.filter((_,i)=>i%2===0).map(sample=>project(x,sample.time,sample.values[index]/maximum)),tone,1.5,.34);
      }
      const pts=current.positions.map((x,i)=>project(x,current.time,current.values[i]/maximum));
      stroke(pts,color('--color-white'),7,.9);stroke(pts,tone,3.2);
      stroke([project(-8,current.time,0),project(8,current.time,0)],ink,1.5,.35);
      ctx.globalAlpha=1;
      phase.textContent=mode==='space'?T('形状保持 · 空间局域','Shape preserved · localized in space'):
        current.time<7?T('微弱种子正在放大','A weak seed is growing'):current.time<10.5?T('光集中成一个时间脉冲','Light forms a pulse in time'):T('脉冲经过，光场消退','The pulse passes and fades');
      canvas.dataset.mode=mode;canvas.dataset.time=fmt(current.time);canvas.dataset.peak=String(current.peak);
      canvas.setAttribute('aria-label',(mode==='space'?T('空间孤子：窄峰在演化中保持形状','Spatial soliton: a narrow peak keeps its shape'):T('时间孤子：场在一个时间窗口内集中出现','Temporal soliton: the field concentrates within a time window'))+' · t='+fmt(current.time));
    }
    const progress=slider({label:T('时间','Time'),min:0,max:16,step:.05,value:0,format:v=>v.toFixed(1),oninput:v=>{frame=Math.min(frames.length-1,Math.max(0,Math.round(v/.05)));draw();}});
    function stop(){cancelAnimationFrame(raf);raf=0;playing=false;last=0;play.textContent=T('▶ 播放','▶ Play');play.setAttribute('aria-pressed','false');}
    function start(){
      if(play.disabled||motion.matches)return;
      playing=true;play.textContent=T('Ⅱ 暂停','Ⅱ Pause');play.setAttribute('aria-pressed','true');let elapsed=frames[frame].time;
      const tick=now=>{if(!playing)return;if(last)elapsed=(elapsed+Math.min(.1,(now-last)/1000)*2.0)%16;last=now;progress.input.value=elapsed;progress.update();raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
    }
    function calculate(){
      stop();clearTimeout(timer);const id=++job;frames=[];frame=0;play.disabled=true;progress.input.disabled=true;canvas.dataset.ready='false';
      heading.textContent=mode==='space'?T('把光，留在一个位置。','Light, held in one place.'):T('让光，集中在一个瞬间。','Light, gathered into a moment.');
      caption.textContent=mode==='space'?T('一座窄峰沿着时间延伸，波包始终保持局域。','A narrow ridge extends through time: the packet stays localized.'):
        T('光场在空间铺开，却只在一段时间内汇成明亮脉冲。','The field extends across space, yet gathers into a bright pulse within a brief time window.');
      const sim=model.create({profile:mode==='space'?'localized':'uniform',amplitude:mode==='space'?1/Math.sqrt(2):.0001});frames.push(sim.sample());
      const batch=()=>{if(disposed||id!==job)return;for(let j=0;j<16&&frames.length<=320;j++)frames.push(sim.step(10));
        if(frames.length<=320){timer=setTimeout(batch,0);return;}
        frame=mode==='space'?95:195;progress.input.value=frames[frame].time;progress.update();play.disabled=false;progress.input.disabled=false;canvas.dataset.ready='true';
        if(visibleNow&&!userPaused&&!motion.matches)start();
      };timer=setTimeout(batch,0);
    }
    const tabs=segmented([{value:'space',label:T('空间孤子','Spatial soliton')},{value:'time',label:T('时间孤子','Temporal soliton')}],v=>{mode=v;calculate();});
    play.addEventListener('click',()=>{if(playing){userPaused=true;stop();}else{userPaused=false;if(motion.matches){progress.input.value=(+progress.input.value+2)%16;progress.update();}else start();}});
    progress.input.addEventListener('input',()=>{userPaused=true;stop();});
    const detail=h('details',{class:'ifig-original'},h('summary',{text:T('这张图背后的物理','The physics behind the picture')}),
      h('p',{class:'ifig-note',text:T('空间孤子选用保持形状的 Bragg 平衡态；时间孤子展示弱种子形成 k-gap 脉冲。波面高度表示强度，亮线标出当前时刻。底层沿用归一化包络方程的数值结果，图形只突出两种局域方式。','The spatial view uses a stationary Bragg state; the temporal view shows a weak seed forming a k-gap pulse. Height indicates intensity and the bright line marks the selected time. Both use numerical solutions of the normalized envelope equation.')}),
      h('a',{class:'text-link',href:'https://doi.org/10.1103/q226-dkk4',target:'_blank',rel:'noopener noreferrer',text:T('张亮等 · 孤子形成与时空局域 ↗','Zhang et al. · Soliton formation and spacetime localization ↗')}));
    const card=h('div',{class:'ifig-card ifig-soliton-simple'},tabs,heading,caption,canvas,
      h('div',{class:'ifig-soliton-key'},h('span',{text:T('横向：位置','Across: position')}),h('span',{text:T('纵深：时间','Depth: time')}),phase),
      h('div',{class:'ifig-controls ifig-soliton-transport'},play,progress.wrap),detail);
    fig.prepend(card);calculate();
    const hidden=()=>{if(document.hidden||motion.matches)stop();};document.addEventListener('visibilitychange',hidden);motion.addEventListener('change',hidden);
    const observer=new IntersectionObserver(entries=>{visibleNow=entries[0].isIntersecting;if(!visibleNow)stop();else if(!userPaused&&!motion.matches&&!playing&&!play.disabled)start();},{threshold:.15});observer.observe(card);
    card.dispose=()=>{disposed=true;job++;clearTimeout(timer);stop();observer.disconnect();document.removeEventListener('visibilitychange',hidden);motion.removeEventListener('change',hidden);};
    return card;
  }


  const BUILDERS = { setup: buildSetup, kgap: buildKgap, anomaly: buildAnomaly, measurement: buildMeasurement, concepts: buildConcepts, floquet: buildFloquet, soliton:buildSoliton };
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
        const clearCards = () => fig.querySelectorAll(':scope > .ifig-card').forEach((c) => { c.dispose?.(); c.remove(); });
        try {
          clearCards();
          card = null;
          card = build(fig, cx);
          if (!card) throw new Error('builder returned nothing');
          addGuide(fig, card);
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
