const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../analytics.js'), 'utf8');
const KEY = 'pension-calculator-analytics-consent-v1';
const ID = 'G-9GFDYS61G9';
function setup({ saved, blocked = false, url = 'https://romanoroei.github.io/self-employed-tax-calculator/?utm_source=accountant&utm_medium=referral&income=987654&email=private%40example.com#secret', referrer = 'https://example.org/private?email=secret@example.org' } = {}) {
  const elements = new Map(), scripts = [], cookieWrites = [], storage = new Map();
  if (saved !== undefined) storage.set(KEY, JSON.stringify(saved));
  function node(id) {
    const listeners = new Map();
    return { id, hidden: true, textContent: '', open: false, focused: false,
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
      emit(name, extra = {}) { for (const fn of listeners.get(name) || []) fn({ target: this, ...extra }); },
      focus() { this.focused = true; },
      closest(selector) { if (selector === 'a,button') return this; return selector === this.location ? this : null; },
      matches(selector) { return this.selector === selector; }
    };
  }
  const get = id => { if (!elements.has(id)) elements.set(id, node(id)); return elements.get(id); };
  const mainDetails = get('advisor-service-details'); mainDetails.location = '#contact-card';
  const footerDetails = get('closing-service-details'); footerDetails.location = '#closing-cta';
  const document = Object.assign(node('document'), {
    referrer, getElementById: get, head: { append(script) { scripts.push(script); } },
    querySelectorAll: () => [mainDetails, footerDetails], createElement: () => ({}),
    cookie: 'pensioncalc_ga=abc; pensioncalc_ga_9GFDYS61G9=def; _ga_otherproject=keep'
  });
  let cookieJar = document.cookie;
  Object.defineProperty(document, 'cookie', { get: () => cookieJar, set: value => { cookieWrites.push(value); cookieJar = cookieJar.split(';').filter(part => part.trim().split('=')[0] !== value.split('=')[0]).join(';'); } });
  const window = Object.assign(node('window'), { location: new URL(url) });
  const localStorage = {
    getItem: key => { if (blocked) throw Error('blocked'); return storage.get(key) || null; },
    setItem: (key, value) => { if (blocked) throw Error('blocked'); storage.set(key, value); }
  };
  vm.runInNewContext(source, { window, document, localStorage, URL, Date, Set });
  const queue = () => (window.dataLayer || []).map(args => JSON.parse(JSON.stringify([...args])));
  const events = () => queue().filter(command => command[0] === 'event');
  return { window, document, get, scripts, cookieWrites, storage, queue, events,
    calculate: () => document.emit('pension:calculated'),
    click: (selector, location = '#contact-card') => { const target = node('link'); target.selector = selector; target.location = location; document.emit('click', { target }); },
    allow: () => get('analytics-allow').emit('click'), deny: () => get('analytics-deny').emit('click')
  };
}
test('no Google tag or events before consent or after refusal', () => {
  const env = setup(); env.calculate(); env.click('.advisor-primary');
  assert.equal(env.scripts.length, 0); assert.equal(env.events().length, 0);
  assert.equal(env.get('analytics-consent').hidden, false);
  env.deny(); env.calculate();
  assert.equal(env.scripts.length, 0); assert.equal(env.get('analytics-consent').hidden, true);
  assert.equal(JSON.parse(env.storage.get(KEY)).allowed, false);
});
test('acceptance loads one isolated analytics tag with ads disabled and sanitized metadata', () => {
  const env = setup(); env.allow(); env.allow();
  assert.equal(env.scripts.length, 1); assert.equal(env.scripts[0].referrerPolicy, 'origin');
  const config = env.queue().find(args => args[0] === 'config')[2];
  assert.equal(config.cookie_prefix, 'pensioncalc'); assert.equal(config.cookie_path, '/self-employed-tax-calculator/');
  assert.equal(config.cookie_domain, 'none'); assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false); assert.equal(config.cookie_expires, 15552000);
  assert.equal(config.page_location, 'https://romanoroei.github.io/self-employed-tax-calculator/?utm_source=accountant&utm_medium=referral');
  assert.equal(config.page_referrer, 'https://example.org/');
  assert.equal(env.events().filter(e => e[1] === 'page_view').length, 1);
  assert(!JSON.stringify(env.queue()).includes('987654')); assert(!JSON.stringify(env.queue()).includes('secret'));
});
test('explicit events report intent and placement without financial or contact fields', () => {
  const env = setup(); env.allow(); env.calculate(); env.click('.advisor-primary', '#closing-cta');
  env.get('email-open-footer').location = '#closing-cta'; env.document.emit('click', { target: env.get('email-open-footer') });
  env.document.emit('pension:email-compose', { detail: { email: 'private@example.com', income: 987654 } });
  const names = env.events().map(e => e[1]);
  assert(names.includes('calculation_complete')); assert(names.includes('contact_email_compose')); assert(!names.includes('generate_lead'));
  const contact = env.events().find(e => e[1] === 'contact_click')[2];
  assert.deepEqual(contact, { send_to: ID, cta_location: 'page_end', contact_channel: 'whatsapp' });
  assert(env.events().every(e => Object.keys(e[2]).every(key => ['send_to', 'cta_location', 'contact_channel'].includes(key))));
  assert(!JSON.stringify(env.queue()).includes('private@example.com'));
});
test('withdrawal immediately blocks events and clears only calculator cookies', () => {
  const env = setup(); env.allow(); env.calculate(); const before = env.events().length; env.deny();
  env.calculate(); env.click('.advisor-primary'); assert.equal(env.events().length, before);
  assert.equal(env.window['ga-disable-' + ID], true);
  assert(env.cookieWrites.some(cookie => cookie.startsWith('pensioncalc_ga=')));
  assert(env.cookieWrites.every(cookie => !cookie.startsWith('_ga_otherproject')));
  assert(env.document.cookie.includes('_ga_otherproject=keep'));
  env.get('cookie-settings').emit('click'); assert.equal(env.get('analytics-consent').hidden, false);
});
test('saved refusal, expired consent, malformed data and blocked storage fail closed', () => {
  for (const saved of [{allowed:false,at:Date.now()}, {allowed:true,at:Date.now()-181*86400000}, {allowed:true,at:'invalid'}, {allowed:true,at:Date.now()+100000}]) {
    const env = setup({saved}); assert.equal(env.scripts.length,0); env.calculate(); assert.equal(env.events().length,0);
  }
  const env = setup({blocked:true}); env.deny(); assert.equal(env.scripts.length,0);
});
test('saved opt-in loads once; cross-tab revocation stops future measurements', () => {
  const env = setup({saved:{allowed:true,at:Date.now()}}); assert.equal(env.scripts.length,1);
  env.storage.set(KEY,JSON.stringify({allowed:false,at:Date.now()})); env.window.emit('storage',{key:KEY});
  const count=env.events().length;env.calculate();assert.equal(env.events().length,count);
});
test('local previews never load Google Analytics', () => {
  const env=setup({url:'http://localhost:8100/self-employed-tax-calculator/'});env.allow();env.calculate();assert.equal(env.scripts.length,0);assert.equal(env.events().length,0);
});
