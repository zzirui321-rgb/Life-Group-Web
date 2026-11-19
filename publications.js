(() => {
  const form = document.querySelector('.publication-filters');
  if (!form) return;
  const { keyword, kind, member } = form.elements;
  const english = document.documentElement.lang === 'en';
  const names = new Map();
  const rows = Array.from(document.querySelectorAll('main article'), article => {
    const links = Array.from(article.querySelectorAll('.contribution a'));
    const members = links.map(link => {
      const slug = new URL(link.href).pathname.split('/').pop().replace(/\.html$/, '');
      names.set(slug, link.textContent.trim());
      return slug;
    });
    const section = article.closest('section');
    const year = article.closest('details')?.querySelector('summary')?.textContent;
    const identifiers = Array.from(article.querySelectorAll('a'), a => a.getAttribute('href'));
    return {
      row: article.closest('li') || article, section, members,
      kind: section.id === 'preprints' ? 'preprint' : 'journal',
      text: [article.textContent, year, ...identifiers].join(' ').toLowerCase()
    };
  });
  for (const [slug, name] of [...names].sort((a, b) => a[1].localeCompare(b[1], document.documentElement.lang))) {
    member.add(new Option(name, slug));
  }
  const sections = new Set(rows.map(row => row.section));
  const years = Array.from(document.querySelectorAll('.archive-year'));
  let savedOpen;
  function update() {
    const words = keyword.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const active = Boolean(words.length || kind.value || member.value);
    if (active && !savedOpen) savedOpen = years.map(year => year.open);
    const visibleSections = new Set();
    const visibleYears = new Set();
    let count = 0;
    for (const entry of rows) {
      const memberMatches = member.value === '*' ? entry.members.length > 0 :
        !member.value || entry.members.includes(member.value);
      const visible = memberMatches && (!kind.value || kind.value === entry.kind) &&
        words.every(word => entry.text.includes(word));
      entry.row.hidden = !visible;
      if (visible) {
        count++;
        visibleSections.add(entry.section);
        visibleYears.add(entry.row.closest('details'));
      }
    }
    for (const section of sections) section.hidden = !visibleSections.has(section);
    years.forEach((year, i) => {
      year.hidden = !visibleYears.has(year);
      if (active) year.open = !year.hidden;
      else if (savedOpen) year.open = savedOpen[i];
    });
    if (!active) savedOpen = undefined;
    for (const link of form.parentElement.querySelectorAll('.link-row a[href^="#"]')) {
      link.hidden = Boolean(document.querySelector(link.hash)?.hidden);
    }
    form.querySelector('output').textContent = english
      ? (count ? count + (count === 1 ? ' publication' : ' publications') : 'No matching publications')
      : (count ? '共 ' + count + ' 篇' : '没有符合条件的论文');
  }
  form.addEventListener('input', update);
  form.addEventListener('reset', () => requestAnimationFrame(update));
  form.addEventListener('submit', event => event.preventDefault());
  form.hidden = false;
  update();
})();
