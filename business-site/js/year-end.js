// Until 31.12 the calculator leads the tools on the "ארביטראז' של ידע" page (/knowledge), with a year-end tag.
(() => {
  if (new Date() >= new Date('2027-01-01T00:00:00+02:00')) return;
  const card = document.querySelector('.kn-card[href^="/self-employed-tax-calculator/"]');
  if (!card) return;
  card.parentElement.prepend(card);
  card.classList.add('is-yearend');
  const k = card.querySelector('.kn-k');
  if (k) k.insertAdjacentHTML('beforeend', ' <span class="ye-tag">סוף שנה</span>');
})();
