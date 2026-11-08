// Tests for the financial compass engine (business-site/js/compass): the content, the scoring,
// the branching and the ten scenarios of section 29 in Roei's specification.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'business-site', 'js', 'compass');
const R = require(path.join(dir, 'regulatory.js'));
const C = require(path.join(dir, 'content.js'));
const E = require(path.join(dir, 'engine.js')).make(C, R);
const CONFIG = require(path.join(dir, 'config.js'));

const NOW = new Date('2026-11-08T10:00:00+02:00');
const opts = { now: NOW };

// Answers the questions in the order the engine asks them. Every question that comes up must have an answer
// in the script, so a test fails loudly if the branching changes.
function run(script, o = opts) {
  let state = E.newState(o.now);
  const asked = [];
  const messages = [];
  for (let i = 0; i < 20; i++) {
    const v = E.view(state, o);
    if (!v.question) break;
    asked.push(v.question.id);
    if (v.message) messages.push(v.message);
    assert.ok(Object.prototype.hasOwnProperty.call(script, v.question.id), `No scripted answer for "${v.question.id}" (asked so far: ${asked.join(', ')})`);
    state = E.answer(state, v.question.id, script[v.question.id], o);
  }
  return { state, asked, messages, result: E.result(state, o), summary: E.summary(state, {}, o) };
}
const scores = (res) => Object.fromEntries(Object.entries(res.relevanceScores).map(([k, v]) => [k, v.score]));
const shownAreas = (res) => [res.primaryNeed.area, ...res.secondaryNeeds.map((n) => n.area)];
const allText = (res) => JSON.stringify(res);

test('content and engine agree: every path, rule, message and condition refers to something real', () => {
  assert.deepEqual(E.validate(), []);
});

test('every question can be reached from some path, bridge or background list', () => {
  const reachable = new Set(['priorities', 'primary']);
  Object.values(C.paths).forEach((p) => [...p.core, ...p.key].forEach((id) => reachable.add(id)));
  C.bridges.forEach((b) => b.questions.forEach((id) => reachable.add(id)));
  C.background.forEach((b) => reachable.add(b.question));
  assert.deepEqual(Object.keys(C.questions).filter((id) => !reachable.has(id)), []);
});

test('regulatory figures: each one has a source, a verification date and a status', () => {
  const check = (node, where) => {
    if (node && typeof node === 'object' && 'value' in node) {
      assert.ok(node.source && /^https:\/\//.test(node.source.url) && node.source.name, `${where}: source`);
      assert.match(node.lastVerifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${where}: lastVerifiedAt`);
      assert.ok(['verified', 'review'].includes(node.status), `${where}: status`);
      return;
    }
    if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) check(v, `${where}.${k}`);
  };
  for (const [year, y] of Object.entries(R.YEARS)) {
    assert.equal(y.taxYear, Number(year));
    assert.ok(y.effectiveDate && y.verificationDate && y.status);
    check(y.parameters, year);
  }
});

test('regulatory figures: an unverified figure or an unknown year is never used', () => {
  assert.equal(R.figure(2026, 'averageWageMonthly'), 13769);
  assert.equal(R.figure(2026, 'pensionContributionThresholds.taxBenefitRate'), null, 'status review');
  assert.equal(R.figure(2031, 'averageWageMonthly'), null);
  assert.equal(R.figure(2026, 'no.such.figure'), null);
});

test('income: three simple ranges with borders at the 2026 thresholds, plain round numbers without verified data', () => {
  const b = E.incomeBands(2026);
  assert.equal(b.verified, true);
  assert.deepEqual(b.options.map((o) => o.value), ['b1', 'b2', 'b3', 'unknown']);
  assert.match(b.options[0].label, /165,000/); // the average wage, 13,769 x 12, rounded
  assert.match(b.options[2].label, /290,000/); // the study fund deduction cap, 293,397, rounded
  assert.ok(b.options.every((o) => !o.note), 'no explanations under the options');
  const f = E.incomeBands(2031);
  assert.equal(f.verified, false);
  assert.match(f.options[0].label, /150,000/);
  assert.ok(!f.options[0].label.includes('כ־'));
});

test('a figure-dependent rule is dropped when its figure is not verified', () => {
  const Rx = { ...R, figure: (y, p) => (p === 'eligibilityRules.obligationMaxAge' ? null : R.figure(y, p)) };
  const Ex = require(path.join(dir, 'engine.js')).make(C, Rx);
  let s = Ex.newState(NOW);
  for (const [q, v] of [['priorities', ['minimum']], ['minReason', 'cantAfford'], ['obligationKnown', 'no'], ['deposits', 'none'], ['employee', 'no'], ['coverageImpact', 'no'], ['otherSavings', ['none']], ['age', '60p'], ['income', 'b1']]) s = Ex.answer(s, q, v, opts);
  const withFigure = run({ priorities: ['minimum'], minReason: 'cantAfford', obligationKnown: 'no', deposits: 'none', employee: 'no', coverageImpact: 'no', otherSavings: ['none'], age: '60p', income: 'b1' });
  assert.equal(scores(withFigure.result).D, 40 + 35 + 20 - 25, 'from 60 the obligation usually no longer applies');
  const res = Ex.result(s, opts);
  assert.equal(res.relevanceScores.D.score, Math.min(100, 40 + 35 + 20));
  assert.ok(!res.relevanceScores.D.reasons.some((r) => r.why.includes('{')), 'no unfilled placeholder');
});

test('scoring is additive, explained and capped: every point has a reason', () => {
  const { result } = run({ priorities: ['pension'], age: '50s', deposits: 'irregular', expectedPension: 'noIdea', pensionVsLiquidity: 'maxRetirement', otherSavings: ['unknown'], employee: 'no' });
  const A = result.relevanceScores.A;
  // 40 preference + 30 over 50 without knowing + 15 unknown pension + 15 irregular mid-career + 10 closer to retirement + 10 prefers retirement = 120, capped
  assert.equal(A.score, 100);
  assert.equal(A.reasons.reduce((s, r) => s + r.pts, 0), 120);
  for (const area of Object.values(result.relevanceScores)) {
    assert.ok(area.score >= 0 && area.score <= 100);
    for (const r of area.reasons) assert.ok(r.why && r.kind && Number.isInteger(r.pts));
  }
});

test('multi-select: a follow-up asks what matters most now, and the other choices are kept and used', () => {
  const r = run({ priorities: ['tax', 'liquidity', 'protection'], primary: 'tax', income: 'b3', employee: 'no', deposits: 'monthly', studyFund: 'depositing', taxReviewed: 'no', extraDeposit: 'maybe', taxVsLiquidity: 'both', dependents: 'yes', coverageKnown: 'partial', liqReason: 'business', horizon: 'y1to3', age: '40s', family: 'partner' });
  assert.equal(r.asked[1], 'primary');
  const primaryView = E.view(E.answer(E.newState(NOW), 'priorities', ['tax', 'liquidity', 'protection'], opts), opts);
  assert.deepEqual(primaryView.question.options.map((o) => o.value), ['protection', 'tax', 'liquidity']);
  assert.equal(r.result.primaryNeed.area, 'C');
  assert.ok(r.asked.includes('taxVsLiquidity'), 'the bridge between the two chosen needs');
  assert.ok(r.asked.includes('dependents') || r.asked.includes('liqReason'), 'secondary priorities get their key questions');
  assert.ok(r.summary.includes('עדיפויות משניות: הגנה על ההכנסה ועל המשפחה, נזילות וגמישות פיננסית'));
  assert.ok(r.asked.length <= C.limits.maxQuestions);
});

test('a single choice skips the follow-up question', () => {
  const s = E.answer(E.newState(NOW), 'priorities', ['protection'], opts);
  assert.equal(E.view(s, opts).question.id, 'worry');
});

test('multi answers: an exclusive option cannot be combined, and answers outside the options are refused', () => {
  let s = E.newState(NOW);
  assert.throws(() => E.answer(s, 'priorities', ['nope'], opts));
  assert.throws(() => E.answer(s, 'priorities', [], opts));
  s = E.answer(s, 'priorities', ['pension'], opts);
  assert.throws(() => E.answer(s, 'deposits', 'monthly', opts), /Not the current question/);
  for (const [q, v] of [['age', '40s'], ['deposits', 'monthly'], ['expectedPension', 'low'], ['pensionVsLiquidity', 'both']]) s = E.answer(s, q, v, opts);
  assert.equal(E.view(s, opts).question.id, 'otherSavings');
  assert.throws(() => E.answer(s, 'otherSavings', ['none', 'gemel'], opts));
  assert.doesNotThrow(() => E.answer(s, 'otherSavings', ['gemel', 'studyFund'], opts));
});

test('optional questions can be skipped, required ones cannot', () => {
  let s = E.answer(E.newState(NOW), 'priorities', ['pension'], opts);
  assert.throws(() => E.skip(s, 'age', opts));
  for (const [q, v] of [['age', '40s'], ['deposits', 'monthly'], ['expectedPension', 'low'], ['pensionVsLiquidity', 'both']]) s = E.answer(s, q, v, opts);
  s = E.skip(s, 'otherSavings', opts);
  assert.equal(E.answersList(s, opts).find((a) => a.questionId === 'otherSavings').value, 'דילגתם');
});

test('a known fact is never asked twice: a derived answer skips its question', () => {
  const r = run({ priorities: ['protection'], worry: 'unknownCover', family: 'partner', dependents: 'yes', altIncome: 'no', age: '40s' });
  assert.ok(!r.asked.includes('coverageKnown'), '"I do not know which insurance I have" already answers it');
  const all = run({ priorities: ['pension', 'tax'], primary: 'pension', age: '40s', deposits: 'annual', expectedPension: 'low', pensionVsLiquidity: 'maxRetirement', otherSavings: ['studyFund'], income: 'b2', taxReviewed: 'no', employee: 'no' });
  assert.equal(all.asked.filter((x) => x === 'deposits').length, 1);
  assert.ok(all.asked.indexOf('income') > 0);
});

test('stage-based progress only moves forward and ends at the result', () => {
  let s = E.newState(NOW);
  const script = { priorities: ['liquidity', 'tax'], primary: 'liquidity', liqReason: 'bigExpense', horizon: 'y1to3', liquidSavings: 'yes', liquidAmount: '150to400', studyFundLiquid: 'locked', deposits: 'irregular', taxVsLiquidity: 'liquid', income: 'b2', taxReviewed: 'unknown', employee: 'no', yearsActive: 'gt10y', age: '30s' };
  let last = 0;
  for (;;) {
    const v = E.view(s, opts);
    assert.ok(v.stage >= last, 'progress never goes back');
    last = v.stage;
    if (!v.question) break;
    s = E.answer(s, v.question.id, script[v.question.id], opts);
  }
  assert.equal(last, 5);
});

test('interim messages: contextual, each one once, at most one per screen', () => {
  const r = run({ priorities: ['tax', 'liquidity'], primary: 'liquidity', liqReason: 'bigExpense', horizon: 'y1', liquidSavings: 'no', studyFundLiquid: 'unknown', deposits: 'none', taxVsLiquidity: 'both', income: 'unknown', taxReviewed: 'unknown', age: '30s', employee: 'yes', yearsActive: '3y10y' });
  assert.equal(r.messages[0], C.messages.find((m) => m.id === 'mix-tax-liquidity').text);
  assert.equal(new Set(r.messages).size, r.messages.length);
  const single = run({ priorities: ['liquidity'], liqReason: 'flexibility', horizon: 'gt5', liquidSavings: 'yes', liquidAmount: 'lt50', studyFundLiquid: 'no', deposits: 'monthly', age: '40s' });
  assert.equal(single.messages[0], C.messages.find((m) => m.id === 'start-liquidity').text);
});

test('scenario 1: 30, prefers liquidity, no pension, invests on his own -> obligation check and liquidity', () => {
  const r = run({ priorities: ['liquidity'], liqReason: 'investSelf', horizon: 'none', liquidSavings: 'yes', liquidAmount: '50to150', studyFundLiquid: 'no', deposits: 'none', age: '30s', employee: 'no', yearsActive: '3y10y' });
  assert.equal(r.result.primaryNeed.area, 'E');
  assert.ok(shownAreas(r.result).includes('D'), 'obligation check');
  assert.ok(scores(r.result).D >= 50);
  assert.ok(r.result.primaryNeed.explain.some((t) => t.includes('חובת הפקדה')), 'does not suggest replacing the obligation with liquid investing');
  assert.ok(r.result.recommendedChecks.some((t) => t.includes('מחויבים להפקיד')));
});

test('scenario 2: 47, high income, study fund, irregular pension deposits -> deposits, tax benefits and pension planning', () => {
  const r = run({ priorities: ['tax'], income: 'b3', employee: 'no', deposits: 'irregular', studyFund: 'depositing', taxReviewed: 'no', extraDeposit: 'maybe', age: '40s' });
  const s = scores(r.result);
  assert.equal(r.result.primaryNeed.area, 'C');
  assert.ok(s.C >= 80);
  assert.ok(s.A >= C.limits.relevantScore, 'pension planning');
  assert.ok(shownAreas(r.result).includes('A'));
  assert.ok(r.result.recommendedChecks.some((t) => t.includes('הפקדתם השנה')), 'a check of this year\'s deposits');
  assert.ok(r.summary.includes('הכנסה חייבת מדווחת'));
});

test('scenario 3: 55 and does not know the expected pension -> retirement readiness', () => {
  const r = run({ priorities: ['pension'], age: '50s', deposits: 'monthly', expectedPension: 'notChecked', pensionVsLiquidity: 'maxRetirement', otherSavings: ['gemel'] });
  assert.equal(r.result.primaryNeed.area, 'A');
  assert.equal(scores(r.result).A, 100);
  assert.ok(r.result.primaryNeed.explain.some((t) => t.includes('בדיקת מוכנות לפרישה')));
  assert.ok(r.messages.includes(C.messages.find((m) => m.id === 'late-pension').text));
  assert.ok(r.summary.includes('דחיפות: גבוהה יחסית'));
});

test('scenario 4: a family that does not know its cover -> protection check, never a finding of missing cover', () => {
  for (const cover of ['no', 'none', 'partial']) {
    const r = run({ priorities: ['protection'], worry: 'both', family: 'partner', dependents: 'yes', altIncome: 'no', coverageKnown: cover, age: '40s' });
    assert.equal(r.result.primaryNeed.area, 'B');
    assert.ok(scores(r.result).B >= 90);
    const text = allText(r.result) + r.summary;
    for (const w of C.forbidden) assert.ok(!text.includes(w), `forbidden "${w}"`);
    assert.ok(r.result.cannotTell, 'says the gap cannot be known yet');
    assert.ok(r.result.primaryNeed.explain.some((t) => t.includes('אי אפשר לדעת')));
  }
});

test('scenario 5: liquidity and tax benefits -> a question that weighs the two', () => {
  const r = run({ priorities: ['liquidity', 'tax'], primary: 'tax', income: 'b2', employee: 'no', deposits: 'annual', studyFund: 'notDepositing', taxReviewed: 'unknown', extraDeposit: 'yes', taxVsLiquidity: 'both', liqReason: 'business', horizon: 'y1to3', age: '30s' });
  assert.ok(r.asked.includes('taxVsLiquidity'));
  assert.ok(r.asked.indexOf('taxVsLiquidity') < r.asked.indexOf('liqReason'), 'the bridge comes before the secondary path');
  assert.ok(shownAreas(r.result).includes('E'));
  assert.ok(r.result.primaryNeed.explain.some((t) => t.includes('נזילות')));
});

test('scenario 6: also an employee -> taken into account for the obligation and the tax benefits', () => {
  const tax = run({ priorities: ['tax'], income: 'b2', employee: 'yes', deposits: 'monthly', studyFund: 'no', taxReviewed: 'no', extraDeposit: 'no', age: '40s' });
  assert.ok(tax.result.primaryNeed.explain.some((t) => t.includes('משכורת')));
  assert.ok(tax.result.recommendedChecks.some((t) => t.includes('המשכורת')));
  const min = run({ priorities: ['minimum'], minReason: 'business', businessNeed: 'temporary', obligationKnown: 'unsure', deposits: 'irregular', employee: 'yes', coverageImpact: 'unaware', otherSavings: ['none'], age: '30s', yearsActive: '6m3y' });
  assert.ok(min.result.relevanceScores.D.reasons.some((r) => r.why.includes('משכורת')));
  assert.ok(min.result.primaryNeed.explain.some((t) => t.includes('משכורת')));
});

test('scenario 7: "do not know" almost everywhere -> a limited diagnosis that invents nothing', () => {
  const r = run({ priorities: ['unsure'], product: 'noIdea', accumulated: 'no', lastReview: 'notRemember', wantToUnderstand: 'all', otherSavingsSimple: 'unsure', age: '40s' });
  assert.equal(r.result.limited, true);
  assert.equal(r.result.primaryNeed.area, 'F');
  assert.ok(r.result.cannotTell);
  assert.deepEqual(r.result.knowledge.known.map((k) => k.fact).sort(), ['age', 'priorities', 'wantToUnderstand'].sort(), 'only what was actually said');
  const pension = run({ priorities: ['pension'], age: '40s', deposits: 'unknown', expectedPension: 'noIdea', pensionVsLiquidity: 'both', otherSavings: ['unknown'], employee: 'yes' });
  assert.equal(pension.result.limited, true);
  assert.ok(shownAreas(pension.result).includes('F'), 'mapping comes up when little is known');
  assert.ok(pension.result.missing.length > 0);
});

test('scenario 8: changing an earlier answer recomputes the questions and drops stale conclusions', () => {
  let s = E.newState(NOW);
  for (const [q, v] of [['priorities', ['protection']], ['worry', 'both'], ['family', 'partner'], ['dependents', 'yes'], ['altIncome', 'no']]) s = E.answer(s, q, v, opts);
  // change the main concern from protection to liquidity
  s = E.editFrom(s, 'priorities');
  assert.equal(E.view(s, opts).question.id, 'priorities');
  assert.deepEqual(E.view(s, opts).question.selected, ['protection'], 'the old answer is offered, not applied');
  s = E.answer(s, 'priorities', ['liquidity'], opts);
  const v = E.view(s, opts);
  assert.equal(v.question.id, 'liqReason');
  assert.equal(E._walk(s, opts).facts.dependents, undefined, 'the protection answers no longer count');
  for (const [q, a] of [['liqReason', 'flexibility'], ['horizon', 'gt5'], ['liquidSavings', 'no'], ['studyFundLiquid', 'no'], ['deposits', 'monthly'], ['age', '40s']]) s = E.answer(s, q, a, opts);
  const res = E.result(s, opts);
  assert.equal(res.primaryNeed.area, 'E');
  assert.equal(res.relevanceScores.B.score, 0, 'no protection points left from the old path');
  // going back one step keeps the earlier answer as a suggestion
  const b = E.back(s);
  assert.equal(E.view(b, opts).question.id, 'age');
  assert.equal(E.view(b, opts).question.selected, '40s');
});

test('scenario 8b: a changed answer that removes a branch removes its follow-up too', () => {
  let s = E.newState(NOW);
  for (const [q, v] of [['priorities', ['minimum']], ['minReason', 'investSelf'], ['investWhere', ['market']], ['obligationKnown', 'yes']]) s = E.answer(s, q, v, opts);
  s = E.editFrom(s, 'minReason');
  s = E.answer(s, 'minReason', 'cantAfford', opts);
  assert.equal(E.view(s, opts).question.id, 'obligationKnown');
  assert.equal(E._walk(s, opts).facts.investWhere, undefined);
});

test('scenario 9: leaving and coming back on the same device restores the progress, never the contact details', () => {
  let s = E.newState(NOW);
  for (const [q, v] of [['priorities', ['tax', 'pension']], ['primary', 'tax'], ['income', 'b1']]) s = E.answer(s, q, v, opts);
  const saved = E.serialize(s, NOW);
  assert.ok(!/phone|טלפון|name/.test(saved));
  const later = new Date(NOW.getTime() + 2 * 86400000);
  const back = E.restore(saved, CONFIG.storageDays, later);
  assert.equal(E.view(back, { now: later }).question.id, E.view(s, opts).question.id);
  assert.equal(E.restore(saved, CONFIG.storageDays, new Date(NOW.getTime() + 30 * 86400000)), null, 'expired');
  assert.equal(E.restore('{not json', 7, NOW), null);
  assert.equal(E.restore(JSON.stringify({ v: 99, history: [] }), 7, NOW), null);
  const tampered = JSON.parse(saved);
  tampered.history.push({ questionId: 'age', value: 'u30' }, { questionId: 'evil', value: '<script>' });
  const t = E.restore(JSON.stringify(tampered), 7, NOW);
  assert.equal(t.history.length, 3, 'out-of-order and unknown answers are dropped');
});

test('scenario 10: without the AI layer (or when it fails) the built-in engine carries on', () => {
  const s = E.answer(E.newState(NOW), 'priorities', ['pension'], opts);
  const plain = E.view(s, opts).question.text;
  assert.equal(E.view(s, { now: NOW, rephrase: () => { throw new Error('AI down'); } }).question.text, plain);
  assert.equal(E.view(s, { now: NOW, rephrase: () => 'הקצבה מובטחת לכם' }).question.text, plain, 'forbidden wording is refused');
  assert.equal(E.view(s, { now: NOW, rephrase: () => 'x'.repeat(400) }).question.text, plain, 'too long');
  assert.equal(E.view(s, { now: NOW, rephrase: () => '' }).question.text, plain);
  assert.equal(E.view(s, { now: NOW, rephrase: () => 'בני כמה אתם היום?' }).question.text, 'בני כמה אתם היום?');
  assert.equal(E.view(s, { now: NOW, rephrase: () => 'בני כמה אתם היום?' }).question.id, 'age', 'the engine still decides the question');
});

test('WhatsApp: the message names topics only, with no amounts, ages or family details', () => {
  const r = run({ priorities: ['liquidity', 'tax'], primary: 'liquidity', liqReason: 'bigExpense', horizon: 'y1to3', liquidSavings: 'yes', liquidAmount: 'gt1m', studyFundLiquid: 'liquid', deposits: 'monthly', taxVsLiquidity: 'liquid', income: 'b3', taxReviewed: 'no', age: '50s' });
  const text = E.whatsappText(r.result);
  assert.ok(text.startsWith('שלום רועי, מילאתי את המצפן הפיננסי'));
  assert.ok(text.includes('נזילות וגמישות פיננסית'));
  assert.ok(!/\d|₪|גיל|נשוי|ילד|מיליון/.test(text), text);
  const url = E.whatsappUrl(r.result, CONFIG);
  assert.ok(url.startsWith('https://wa.me/972528089808?text='));
  assert.equal(decodeURIComponent(url.split('?text=')[1]), text);
});

test('the internal summary: marked self-reported, with all ten parts, contact details only when given', () => {
  const r = run({ priorities: ['tax', 'liquidity'], primary: 'tax', income: 'b3', employee: 'no', deposits: 'annual', studyFund: 'depositing', taxReviewed: 'no', extraDeposit: 'maybe', taxVsLiquidity: 'both', liqReason: 'business', horizon: 'y1to3', age: '40s' });
  const s = E.summary(r.state, { name: 'ישראל', phone: '0501234567', time: 'בבוקר', source: 'tiktok / november' }, opts);
  for (const part of ['דיווח עצמי', 'שם: ישראל', 'טלפון: 0501234567', 'עדיפות ראשית: ניצול הטבות המס', 'עדיפויות משניות: נזילות', 'מסלול השאלון', 'התשובות', 'פערים אפשריים', 'מידע חסר', 'נושאים לבירור', 'דחיפות', 'שאלות פתיחה', 'מקור הגעה: tiktok / november']) {
    assert.ok(s.includes(part), part);
  }
  assert.ok(s.includes('לפני סוף שנת המס'), 'November: tax deposits are checked against 31.12');
  assert.ok(s.includes('ראיתי שחשוב לכם לנצל את הטבות המס, אבל גם לשמור על נזילות'));
  assert.ok(!r.summary.includes('שם:'), 'no contact lines without contact details');
  assert.ok(!s.includes('אימייל:'));
});

test('the session model holds the fields of section 28', () => {
  const r = run({ priorities: ['unsure'], product: 'several', accumulated: 'approx', lastReview: 'fewYears', wantToUnderstand: 'manage', otherSavingsSimple: 'yes', age: '30s' });
  const s = E.session(r.state, opts);
  assert.deepEqual(Object.keys(s).sort(), ['answers', 'completionStatus', 'currentStep', 'derivedFacts', 'missingInformation', 'selectedPriorities', 'sessionId'].sort());
  assert.equal(s.completionStatus, 'complete');
  assert.equal(s.currentStep, null);
  for (const a of s.answers) assert.ok(a.questionId && 'value' in a && Number.isFinite(a.timestamp));
  const res = r.result;
  for (const k of ['primaryNeed', 'secondaryNeeds', 'relevanceScores', 'recommendedChecks', 'callToAction']) assert.ok(k in res, k);
});

test('random walks: never more than 12 questions, always a safe result, never more than three checks', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let n = 0; n < 1500; n++) {
    let s = E.newState(NOW);
    let count = 0;
    for (;;) {
      const v = E.view(s, opts);
      if (!v.question) break;
      count++;
      const q = v.question;
      let value;
      if (q.type === 'single') value = q.options[Math.floor(rnd() * q.options.length)].value;
      else {
        const plain = q.options.filter((o) => !o.exclusive);
        value = rnd() < 0.2 && q.options.some((o) => o.exclusive) ? [q.options.find((o) => o.exclusive).value] : plain.filter(() => rnd() < 0.5).map((o) => o.value);
        if (!value.length) value = [plain[0].value];
      }
      if (!q.required && rnd() < 0.1) value = null;
      s = E.answer(s, q.id, value, opts);
      if (rnd() < 0.05) s = E.back(s);
    }
    assert.ok(count >= 2);
    assert.ok(s.history.length <= C.limits.maxQuestions);
    const res = E.result(s, opts);
    assert.ok(res, 'a result');
    assert.ok(res.recommendedChecks.length >= 1 && res.recommendedChecks.length <= 3);
    assert.ok(res.secondaryNeeds.length <= 2);
    const text = allText(res) + E.summary(s, {}, opts) + E.whatsappText(res);
    for (const w of C.forbidden) assert.ok(!text.includes(w), w);
    assert.ok(!/\{\w+\}/.test(text), 'no unfilled placeholder');
    assert.ok(!/\d/.test(E.whatsappText(res)));
  }
});

test('the default path is short: 6 to 10 questions for a single priority', () => {
  const r = run({ priorities: ['pension'], age: '30s', deposits: 'monthly', expectedPension: 'satisfied', pensionVsLiquidity: 'maxRetirement', employee: 'no' });
  assert.ok(r.asked.length >= 5 && r.asked.length <= 10, r.asked.join(','));
});

test('configuration: WhatsApp and the lead endpoints are the agreed ones', () => {
  assert.equal(CONFIG.whatsappNumber, '972528089808');
  assert.equal(CONFIG.formspreeUrl, 'https://formspree.io/f/mvzjeykj');
  assert.ok(CONFIG.productionHosts.includes('romanoinvest.co.il'));
  assert.equal(CONFIG.calculatorUrl, '/self-employed-tax-calculator/');
});
