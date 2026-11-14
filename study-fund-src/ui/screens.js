// One screen at a time: the opening screen, then the questions (address ends with #q), then the result.
// The address hash keeps the phone's back button working: back from the first question returns to the opening screen.
const main = document.querySelector('.sf');

function show() {
  const screen = location.hash === '#q' ? 'quiz' : 'intro';
  if (!main || main.dataset.screen === screen) return;
  main.dataset.screen = screen;
  if (screen === 'intro') document.querySelector('.check-heading')?.removeAttribute('hidden');
  scrollTo(0, 0);
  if (screen === 'quiz') document.querySelector('.step:not([hidden]) input:not([type="radio"]):not([type="checkbox"])')?.focus({ preventScroll: true });
}

addEventListener('hashchange', show);
show();

// A link to a folded section (the gold benefit tile) opens it before scrolling there.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  const target = link && link.getAttribute('href').length > 1 ? document.getElementById(link.getAttribute('href').slice(1)) : null;
  if (target && target.tagName === 'DETAILS') {
    event.preventDefault();
    target.open = true;
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
});
