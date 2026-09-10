(() => {
  const header = document.querySelector('.header');
  if (!header) return;
  let pending = false;
  const indexLinks = [...document.querySelectorAll('.page-index a[href^="#"]')];
  const update = () => {
    const progress = Math.min(1, Math.max(0, window.scrollY / 180));
    header.style.setProperty('--header-alpha', String(0.98 - progress * 0.24));
    const compact = window.scrollY > (header.classList.contains('is-scrolled') ? 8 : 80);
    header.classList.toggle('is-scrolled', compact);
    let active = null;
    for (const link of indexLinks) {
      const section = document.getElementById(link.hash.slice(1));
      if (section && section.getBoundingClientRect().top <= header.offsetHeight + 100) active = link;
    }
    for (const link of indexLinks) {
      if (link === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    pending = false;
  };
  const onScroll = () => {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  };
  const measure = () => document.documentElement.style.setProperty('--site-header-height', `${header.offsetHeight}px`);
  new ResizeObserver(measure).observe(header);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pageshow', update);
  measure();
  update();
})();
