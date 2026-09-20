(() => {
  const header = document.querySelector('.header');
  if (!header) return;
  const motion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

  // 1. Inject Mobile Nav Toggle Button if not already in markup
  let navToggle = header.querySelector('.nav-toggle');
  const nav = header.querySelector('nav');
  if (!navToggle && nav) {
    navToggle = document.createElement('button');
    navToggle.className = 'nav-toggle';
    navToggle.setAttribute('aria-label', '切换主导航');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.innerHTML = '<span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>';
    header.appendChild(navToggle);
  }

  if (navToggle && nav) {
    header.classList.add('nav-ready');
    nav.id = nav.id || 'main-navigation';
    navToggle.type = 'button';
    navToggle.setAttribute('aria-controls', nav.id);
    const toggleNav = (open) => {
      const isOpen = open !== undefined ? open : !header.classList.contains('nav-open');
      header.classList.toggle('nav-open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) nav.querySelector('a')?.focus({ preventScroll: true });
    };

    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNav();
    });

    // Close when clicking any nav link
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) toggleNav(false);
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (header.classList.contains('nav-open') && !header.contains(e.target)) {
        toggleNav(false);
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) {
        toggleNav(false);
        navToggle.focus();
      }
    });
    header.addEventListener('focusout', (e) => {
      if (!header.contains(e.relatedTarget)) toggleNav(false);
    });
    window.matchMedia('(max-width: 768px)').addEventListener('change', () => {
      toggleNav(false);
      if (document.activeElement === navToggle && window.innerWidth > 768) nav.querySelector('a')?.focus();
    });
  }

  // 2. Inject Back to Top Button
  let backToTop = document.querySelector('.back-to-top');
  if (!backToTop) {
    backToTop = document.createElement('button');
    backToTop.className = 'back-to-top';
    backToTop.setAttribute('aria-label', '回到顶部');
    backToTop.setAttribute('title', '回到顶部');
    backToTop.innerHTML = '↑';
    document.body.appendChild(backToTop);
  }

  backToTop.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: motion() });
  });

  // Intercept all回到顶部/href="#" links to smooth scroll rather than jumping
  document.querySelectorAll('a[href="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: motion() });
    });
  });

  // 3. Scroll spy & Header Compactness
  let pending = false;
  const indexLinks = [...document.querySelectorAll('.page-index a[href^="#"]')];
  const pageIndexNav = document.querySelector('.page-index nav');

  const update = () => {
    const scrollY = window.scrollY;

    // Header transparency & compact shrink
    const progress = Math.min(1, Math.max(0, scrollY / 180));
    header.style.setProperty('--header-alpha', String(0.98 - progress * 0.24));
    const compact = scrollY > (header.classList.contains('is-scrolled') ? 8 : 80);
    header.classList.toggle('is-scrolled', compact);

    // Back to top visibility
    if (backToTop) {
      backToTop.classList.toggle('is-visible', scrollY > 380);
    }

    // TOC Active state
    let active = null;
    for (const link of indexLinks) {
      const section = document.getElementById(link.hash.slice(1));
      if (section && section.getBoundingClientRect().top <= header.offsetHeight + 100) {
        active = link;
      }
    }

    for (const link of indexLinks) {
      if (link === active) {
        if (link.getAttribute('aria-current') !== 'location') {
          link.setAttribute('aria-current', 'location');
          // Auto-scroll pill horizontally inside its container ONLY - NEVER scroll window/document!
          if (pageIndexNav && window.innerWidth <= 1050) {
            const linkLeft = link.getBoundingClientRect().left - pageIndexNav.getBoundingClientRect().left + pageIndexNav.scrollLeft;
            const linkWidth = link.offsetWidth;
            const navWidth = pageIndexNav.clientWidth;
            const targetScrollLeft = linkLeft - (navWidth - linkWidth) / 2;
            pageIndexNav.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: motion() });
          }
        }
      } else {
        link.removeAttribute('aria-current');
      }
    }

    pending = false;
  };

  const onScroll = () => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(update);
    }
  };

  const measure = () => {
    document.documentElement.style.setProperty('--site-header-height', `${header.offsetHeight}px`);
  };

  new ResizeObserver(measure).observe(header);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pageshow', update);
  measure();
  update();
})();
