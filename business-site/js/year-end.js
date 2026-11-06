// Until 31.12 the calculator leads the "כלים וידע" menu, with a year-end tag.
(() => {
  if (new Date() >= new Date('2027-01-01T00:00:00+02:00')) return;
  const menu = document.getElementById('tools-menu');
  const calcItem = menu && menu.querySelector('a[href^="/self-employed-tax-calculator/"]');
  if (!calcItem) return;
  menu.prepend(calcItem);
  calcItem.classList.add('is-yearend');
  const k = calcItem.querySelector('.k');
  if (k) k.insertAdjacentHTML('beforeend', ' <span class="ye-tag">סוף שנה</span>');
})();
