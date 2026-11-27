// Until 31.12 the calculator leads the self-employed topic on the "ארביטראז' של ידע" page (/knowledge), with a year-end tag.
(() => {
  if (new Date() >= new Date('2027-01-01T00:00:00+02:00')) return;
  const card = document.querySelector('.kn-row[href^="/self-employed-tax-calculator/"]');
  if (!card) return;
  const item = card.closest('li');
  item.parentElement.prepend(item);
  card.classList.add('is-yearend');
  const k = card.querySelector('.kn-k');
  if (k) k.insertAdjacentHTML('beforeend', ' <span class="ye-tag">סוף שנה</span>');
})();
// Year-end offers (e.g. the Hachshara fee offer) carry data-until and disappear on their own once that moment passes.
(() => {
  const now = new Date();
  document.querySelectorAll('[data-until]').forEach(el => {
    const until = new Date(el.getAttribute('data-until'));
    if (!isNaN(until) && now >= until) el.remove();
  });
})();
