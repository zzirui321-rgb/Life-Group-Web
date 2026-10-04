(() => {
  const filters = [...document.querySelectorAll('[data-filter]')];
  const entries = [...document.querySelectorAll('.news-entry')];
  const counter = document.querySelector('.news-count');
  const english = document.documentElement.lang.startsWith('en');
  for (const button of filters) button.addEventListener('click', () => {
    const kind = button.dataset.filter;
    for (const control of filters) control.setAttribute('aria-pressed', String(control === button));
    for (const entry of entries) entry.hidden = kind !== 'all' && entry.dataset.kind !== kind;
    for (const year of document.querySelectorAll('.news-year')) year.hidden = !year.querySelector('.news-entry:not([hidden])');
    const count = entries.filter(entry => !entry.hidden).length;
    if (counter) counter.textContent = english ? `${count} ${count === 1 ? 'story' : 'stories'}` : `${count} 篇报道`;
  });
})();
