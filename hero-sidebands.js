(() => {
  const image = document.querySelector('.hero img.hero-art');
  if (!image) return;
  const en = document.documentElement.lang.startsWith('en');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // Integer-order Bessel series; the displayed spectrum is Gaussian-broadened J_n(2g)^2.
  function bessel(n, x) {
    let term = 1;
    for (let k = 1; k <= n; k++) term *= x / (2 * k);
    let sum = term;
    for (let k = 1; k < 40; k++) {
      term *= -x * x / (4 * k * (n + k));
      sum += term;
      if (Math.abs(term) < 1e-14) break;
    }
    return sum;
  }
  async function mount() {
    const response = await fetch(image.src);
    if (!response.ok) return;
    const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    if (doc.querySelector('parsererror')) return;
    const svg = document.importNode(doc.documentElement, true);
    const curves = [...svg.querySelectorAll('path')].filter(p => (p.getAttribute('d') || '').length > 1000);
    if (curves.length !== 2) return;
    svg.setAttribute('class', 'hero-art hero-spectrum');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', en ? 'PINEM sidebands: changing light–electron coupling' : 'PINEM 能量边带：光与电子耦合强度随时间变化');
    svg.querySelector('desc').textContent = 'Gaussian-broadened J_n(2g)^2, g = 0.2–1.6; illustrative normalized units.';
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    for (const [key, value] of Object.entries({x: '565', y: '66', fill: '#a2bead', 'text-anchor': 'end', 'font-family': 'Arial,sans-serif', 'font-size': '14'})) label.setAttribute(key, value);
    svg.append(label);
    let paused = motion.matches, visible = false, frame = 0, elapsed = 0, last = 0;
    function draw() {
      const g = .2 + .7 * (1 - Math.cos(elapsed * Math.PI / 6000));
      const weights = Array.from({length: 13}, (_, i) => bessel(Math.abs(i - 6), 2 * g) ** 2);
      const points = [];
      for (let x = 35; x <= 565; x += 2) {
        const e = (x - 300) / 53;
        const density = weights.reduce((sum, w, i) => sum + w * Math.exp(-.5 * ((e - (i - 6)) / .16) ** 2), 0);
        points.push(`${x === 35 ? 'M' : 'L'}${x},${(280 - 200 * density).toFixed(2)}`);
      }
      const line = points.join(' ');
      for (const curve of curves) curve.setAttribute('d', curve.getAttribute('fill') === 'none' ? line : `${line} L565,280 L35,280 Z`);
      label.textContent = `|g| = ${g.toFixed(2)}`;
    }
    function tick(now) {
      if (last && now - last < 32) { frame = requestAnimationFrame(tick); return; }
      if (last) elapsed += Math.min(now - last, 80);
      last = now; draw(); frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      if (!paused && visible && !document.hidden) frame = requestAnimationFrame(tick);
    }
    motion.addEventListener('change', () => { paused = motion.matches; sync(); });
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); last = 0; });
    window.addEventListener('pageshow', sync);
    image.replaceWith(svg);
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(svg);
    draw(); sync();
  }
  mount().catch(() => {});
})();
