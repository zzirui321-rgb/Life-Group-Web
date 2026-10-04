(() => {
  const link = document.querySelector('.language-switch');
  if (!link) return;
  // Keep the current section when moving between matching language pages.
  const base = link.getAttribute('href');
  const update = () => { link.setAttribute('href', base + window.location.hash); };
  update();
  window.addEventListener('hashchange', update);
})();
