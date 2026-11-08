// The financial compass: the deterministic engine. No DOM, no network, no wording of its own.
// It reads the questions, paths and rules from content.js and the figures from regulatory.js.
//
// The whole assessment is a pure function of the answer history: every fact, score and next question is
// recomputed from scratch on each step, so a changed answer can never leave a stale conclusion behind.
(function (root) {
  'use strict';

  /**
   * @typedef {{value:string,label:string,note?:string,gap?:boolean,exclusive?:boolean,withheld?:boolean}} Option
   * @typedef {{id:string,stage:number,category:string,type:'single'|'multi',required:boolean,text:string|Array,
   *   help?:string,options?:Option[],optionsFrom?:string,when?:object,derive?:object[],needs?:string[],summaryLabel:string}} Question
   * @typedef {{questionId:string,value:(string|string[]|null),timestamp:number}} Answer
   * @typedef {{v:number,sessionId:string,startedAt:number,history:Answer[],drafts:Object<string,*>}} State
   * @typedef {{sessionId:string,selectedPriorities:string[],answers:Answer[],derivedFacts:object,
   *   missingInformation:string[],currentStep:(string|null),completionStatus:'in-progress'|'complete'}} AssessmentSession
   * @typedef {{primaryNeed:object,secondaryNeeds:object[],relevanceScores:object,possibleGaps:string[],
   *   recommendedChecks:string[],limitations:string[],summary:string,callToAction:string}} AssessmentResult
   * @typedef {{leadId:string,contactDetails:object,consent:object,assessmentId:string,leadStatus:string,createdAt:string}} Lead
   */

  const STATE_VERSION = 1;
  const AREAS = ['A', 'B', 'C', 'D', 'E', 'F'];
  // placeholder in a text -> figure in regulatory.js
  const FIGURE_TOKENS = {
    obligationMinAge: 'eligibilityRules.obligationMinAge',
    obligationMaxAge: 'eligibilityRules.obligationMaxAge',
    obligationWaitingMonths: 'eligibilityRules.obligationWaitingMonths',
  };

  function make(content, regulatory) {
    const C = content;
    const Q = Object.fromEntries(Object.entries(C.questions).map(([id, q]) => [id, { ...q, id }]));
    const L = C.limits;

    // ---------- small helpers ----------
    const taxYearOf = (now) => (now || new Date()).getFullYear();
    const fmt = (n) => Math.round(n).toLocaleString('en-US');
    const round100 = (n) => Math.round(n / 100) * 100;
    const figureOk = (paths, year) => (paths || []).every((p) => regulatory.figure(year, p) !== null);
    function fill(text, year) {
      return text.replace(/\{(\w+)\}/g, (m, k) => {
        const path = FIGURE_TOKENS[k];
        const v = path ? regulatory.figure(year, path) : null;
        return v === null ? m : String(v);
      });
    }

    // Income ranges follow the legal thresholds of the tax year, so the answer means something.
    // Without verified figures for the year they fall back to plain round ranges.
    function incomeBands(year) {
      const avg = regulatory.figure(year, 'averageWageMonthly');
      const pensionCap = regulatory.figure(year, 'pensionContributionThresholds.taxBenefitIncomeCap');
      const fundCap = regulatory.figure(year, 'studyFundThresholds.deductionIncomeCap');
      const unknown = { value: 'unknown', label: 'לא יודע/ת', gap: true };
      if (avg === null || pensionCap === null || fundCap === null) {
        return { verified: false, options: [
          { value: 'b1', label: 'עד 100,000 ₪' }, { value: 'b2', label: '100,000–200,000 ₪' },
          { value: 'b3', label: '200,000–300,000 ₪' }, { value: 'b4', label: '300,000–500,000 ₪' },
          { value: 'b5', label: 'מעל 500,000 ₪' }, unknown,
        ] };
      }
      const half = round100(avg * 6);
      const full = round100(avg * 12);
      const p = round100(pensionCap);
      const f = round100(fundCap);
      return { verified: true, options: [
        { value: 'b1', label: `עד כ־${fmt(half)} ₪ בשנה`, note: 'עד מחצית השכר הממוצע במשק' },
        { value: 'b2', label: `כ־${fmt(half)} עד ${fmt(full)} ₪`, note: 'עד השכר הממוצע במשק' },
        { value: 'b3', label: `כ־${fmt(full)} עד ${fmt(p)} ₪`, note: 'עד תקרת ההכנסה להטבת המס על פנסיה' },
        { value: 'b4', label: `כ־${fmt(p)} עד ${fmt(f)} ₪`, note: 'עד תקרת ההכנסה לניכוי בקרן השתלמות' },
        { value: 'b5', label: `מעל ${fmt(f)} ₪`, note: 'מעל התקרות' },
        unknown,
      ] };
    }

    const primaryOf = (facts) => facts.primary || ((facts.priorities || []).length === 1 ? facts.priorities[0] : null);

    function optionsFor(q, facts, year) {
      if (q.optionsFrom === 'selectedPriorities') {
        return (facts.priorities || []).map((p) => ({ value: p, label: C.priorities[p].short }));
      }
      if (q.optionsFrom === 'incomeBands') return incomeBands(year).options;
      return q.options;
    }

    function textFor(q, ctx) {
      if (typeof q.text === 'string') return q.text;
      const hit = q.text.find((t) => !t.when || ev(t.when, ctx));
      return hit.text;
    }

    // ---------- conditions ----------
    function evValue(c, v) {
      if ('is' in c) return v === c.is;
      if ('in' in c) return c.in.includes(v);
      if ('has' in c) return Array.isArray(v) && v.includes(c.has);
      if ('hasAny' in c) return Array.isArray(v) && c.hasAny.some((x) => v.includes(x));
      if ('countAtLeast' in c) return Array.isArray(v) && v.length >= c.countAtLeast;
      throw new Error('Unknown value condition: ' + JSON.stringify(c));
    }
    function ev(c, ctx) {
      if (!c) return true;
      const f = ctx.facts;
      if (c.all) return c.all.every((x) => ev(x, ctx));
      if (c.any) return c.any.some((x) => ev(x, ctx));
      if (c.not) return !ev(c.not, ctx);
      if ('priority' in c) return (f.priorities || []).includes(c.priority);
      if ('primary' in c) return primaryOf(f) === c.primary;
      if ('secondary' in c) return (f.priorities || []).includes(c.secondary) && primaryOf(f) !== null && primaryOf(f) !== c.secondary;
      if (c.score) return ctx.scores()[c.score.area].score >= c.score.atLeast;
      if (c.unknownCount) return ctx.unknownCount >= c.unknownCount.atLeast;
      if ('monthAtLeast' in c) return ctx.now.getMonth() + 1 >= c.monthAtLeast;
      if ('fact' in c) {
        const v = f[c.fact];
        if ('known' in c) return isKnown(ctx, c.fact) === c.known;
        if ('asked' in c) return (v !== undefined) === c.asked;
        return v !== undefined && evValue(c, v);
      }
      throw new Error('Unknown condition: ' + JSON.stringify(c));
    }
    function isKnown(ctx, fact) {
      const v = ctx.facts[fact];
      if (v === undefined || v === null) return false;
      const m = ctx.meta[fact];
      return !(m && (m.gap || m.skipped || m.withheld));
    }

    // ---------- scoring ----------
    function scoreAreas(ctx) {
      const out = {};
      for (const a of AREAS) out[a] = { area: a, score: 0, raw: 0, reasons: [] };
      for (const rule of C.scoring) {
        if (rule.needs && !figureOk(rule.needs, ctx.year)) continue;
        if (!ev(rule.when, ctx)) continue;
        out[rule.area].raw += rule.pts;
        out[rule.area].reasons.push({ pts: rule.pts, kind: rule.kind, why: fill(rule.why, ctx.year) });
      }
      for (const a of AREAS) {
        out[a].score = Math.max(0, Math.min(100, out[a].raw));
        // what the score rests on: share of the area's relevant facts that are actually known
        const facts = C.result.missingFacts.filter((m) => m.areas.includes(a)).map((m) => m.fact);
        const asked = facts.filter((x) => ctx.facts[x] !== undefined);
        const known = asked.filter((x) => isKnown(ctx, x));
        out[a].clarity = asked.length === 0 ? 'none' : known.length === asked.length ? 'high' : known.length > 0 ? 'partial' : 'low';
      }
      return out;
    }

    // ---------- the plan of candidate questions ----------
    function plan(facts) {
      const list = [{ id: 'priorities', group: 'core', stage: 1 }, { id: 'primary', group: 'core', stage: 1 }];
      const primary = primaryOf(facts);
      if (!primary) return list;
      const pri = facts.priorities || [];
      for (const id of C.paths[primary].core) list.push({ id, group: 'core', stage: Q[id].stage });
      for (const b of C.bridges) {
        if (b.pair.every((p) => pri.includes(p))) for (const id of b.questions) list.push({ id, group: 'bridge', stage: 3 });
      }
      for (const p of Object.keys(C.priorities)) {
        if (p === primary || !pri.includes(p)) continue;
        for (const id of C.paths[p].key) list.push({ id, group: 'secondary', stage: 3 });
      }
      for (const b of C.background) list.push({ id: b.question, group: 'background', stage: 4, when: b.when });
      return list;
    }

    function pick(ctx, asked) {
      if (asked.length >= L.maxQuestions) return null;
      for (const cand of plan(ctx.facts)) {
        const q = Q[cand.id];
        if (asked.includes(cand.id)) continue;
        if (ctx.facts[cand.id] !== undefined) continue; // already known from another answer
        if (q.when && !ev(q.when, ctx)) continue;
        if (cand.when && !ev(cand.when, ctx)) continue;
        if (cand.group === 'background' && asked.length >= L.softMaxQuestions) continue;
        if (q.optionsFrom && optionsFor(q, ctx.facts, ctx.year).length === 0) continue;
        return cand;
      }
      return null;
    }

    function normalize(q, value, facts, year) {
      if (value === null) return q.required ? undefined : null;
      const opts = optionsFor(q, facts, year);
      const allowed = new Set(opts.map((o) => o.value));
      if (q.type === 'single') return typeof value === 'string' && allowed.has(value) ? value : undefined;
      if (!Array.isArray(value)) return undefined;
      const vals = opts.map((o) => o.value).filter((v) => value.includes(v)); // option order, no duplicates
      if (!vals.length) return undefined;
      const exclusive = vals.find((v) => opts.find((o) => o.value === v).exclusive);
      if (exclusive && vals.length > 1) return undefined;
      return vals;
    }

    function isGapAnswer(q, value, facts, year) {
      if (value === null) return true;
      const opts = optionsFor(q, facts, year);
      const vals = Array.isArray(value) ? value : [value];
      return vals.some((v) => (opts.find((o) => o.value === v) || {}).gap);
    }
    function isWithheld(q, value, facts, year) {
      if (Array.isArray(value) || value === null) return false;
      return !!(optionsFor(q, facts, year).find((o) => o.value === value) || {}).withheld;
    }

    function messageFor(ctx, lastId, shown) {
      for (const m of C.messages) {
        if (shown.includes(m.id)) continue;
        if (m.after !== '*' && !m.after.includes(lastId)) continue;
        if (!ev(m.when, ctx)) continue;
        return m;
      }
      return null;
    }

    // ---------- replay: the answers, re-applied one by one ----------
    function walk(state, opts) {
      const now = (opts && opts.now) || new Date();
      const year = taxYearOf(now);
      const facts = {};
      const meta = {};
      const ctx = { facts, meta, now, year, unknownCount: 0 };
      let cache = null;
      ctx.scores = () => (cache || (cache = scoreAreas(ctx)));
      const asked = [];
      const shown = [];
      const valid = [];
      const stale = [];
      let stage = 1;
      let message = null;
      for (let i = 0; i < state.history.length; i++) {
        const entry = state.history[i];
        const cand = pick(ctx, asked);
        const q = cand && Q[entry.questionId];
        const value = cand && cand.id === entry.questionId ? normalize(q, entry.value, facts, year) : undefined;
        if (value === undefined) { stale.push(...state.history.slice(i)); break; }
        stage = Math.max(stage, cand.stage);
        facts[entry.questionId] = value;
        meta[entry.questionId] = { gap: isGapAnswer(q, value, facts, year), skipped: value === null, withheld: isWithheld(q, value, facts, year) };
        if (meta[entry.questionId].gap) ctx.unknownCount++;
        if (entry.questionId === 'priorities' && value.length === 1) facts.primary = value[0];
        for (const d of q.derive || []) {
          if (value === null || !evValue(d.if, value)) continue;
          for (const [k, v] of Object.entries(d.set)) if (facts[k] === undefined) { facts[k] = v; meta[k] = { derived: true }; }
        }
        asked.push(entry.questionId);
        valid.push(entry);
        cache = null;
        message = messageFor(ctx, entry.questionId, shown);
        if (message) shown.push(message.id);
      }
      const next = pick(ctx, asked);
      if (next) stage = Math.max(stage, next.stage);
      return { ctx, facts, meta, asked, valid, stale, next, stage: next ? stage : 5, message, scores: ctx.scores(), done: !next && asked.length > 0 && valid.length === state.history.length && primaryOf(facts) !== null };
    }

    // ---------- the public state operations (each returns a new state) ----------
    function newState(now) {
      const t = (now || new Date()).getTime();
      const id = 'c' + t.toString(36) + Math.random().toString(36).slice(2, 8);
      return { v: STATE_VERSION, sessionId: id, startedAt: t, history: [], drafts: {} };
    }
    const clone = (s) => ({ ...s, history: s.history.slice(), drafts: { ...s.drafts } });

    function answer(state, questionId, value, opts) {
      const w = walk(state, opts);
      if (!w.next || w.next.id !== questionId) throw new Error('Not the current question: ' + questionId);
      const q = Q[questionId];
      const v = normalize(q, value, w.facts, w.ctx.year);
      if (v === undefined) throw new Error('Invalid answer for ' + questionId);
      const s = clone(state);
      s.history = w.valid.concat({ questionId, value: v, timestamp: ((opts && opts.now) || new Date()).getTime() });
      delete s.drafts[questionId];
      return s;
    }
    function skip(state, questionId, opts) { return answer(state, questionId, null, opts); }
    function back(state) {
      if (!state.history.length) return state;
      const s = clone(state);
      const last = s.history.pop();
      s.drafts[last.questionId] = last.value;
      return s;
    }
    // Change an earlier answer: that question becomes current again; the later answers are kept only as
    // suggestions, shown pre-selected if the same question comes up again, and never used unless confirmed.
    function editFrom(state, questionId) {
      const i = state.history.findIndex((h) => h.questionId === questionId);
      if (i < 0) return state;
      const s = clone(state);
      for (const h of s.history.slice(i)) s.drafts[h.questionId] = h.value;
      s.history = s.history.slice(0, i);
      return s;
    }

    // ---------- what the interface shows ----------
    function view(state, opts) {
      const w = walk(state, opts);
      const base = { stage: w.stage, stages: C.stages, answeredCount: w.asked.length, canBack: state.history.length > 0, done: w.done };
      if (!w.next) return { ...base, question: null };
      const q = Q[w.next.id];
      let text = textFor(q, w.ctx);
      // phase 2 hook: an AI layer may rephrase the question. Anything it returns is checked, and on any problem
      // (error, empty, too long, forbidden wording) the built-in text is used, so the compass never depends on it.
      if (opts && typeof opts.rephrase === 'function') {
        try {
          const alt = opts.rephrase({ questionId: q.id, text, facts: { ...w.facts } });
          if (typeof alt === 'string' && alt.trim() && alt.length <= 300 && safe(alt)) text = alt.trim();
        } catch (e) { /* fall back to the built-in text */ }
      }
      const help = q.help && (!q.needs || figureOk(q.needs, w.ctx.year)) ? fill(q.help, w.ctx.year) : '';
      const draft = state.drafts[q.id];
      const options = optionsFor(q, w.facts, w.ctx.year);
      const pre = draft !== undefined && normalize(q, draft, w.facts, w.ctx.year);
      return {
        ...base,
        message: w.message ? w.message.text : '',
        question: { id: q.id, type: q.type, required: q.required, text, help, options, selected: pre === undefined || pre === false ? null : pre },
      };
    }

    // Answers so far, for the "your answers" list where each can be changed.
    function answersList(state, opts) {
      const w = walk(state, opts);
      return w.valid.map((h) => {
        const q = Q[h.questionId];
        return { questionId: h.questionId, label: q.summaryLabel, question: textFor(q, w.ctx), value: valueLabel(q, h.value, w.facts, w.ctx.year) };
      });
    }
    function valueLabel(q, value, facts, year) {
      if (value === null) return 'דילגתם';
      const opts = q.optionsFrom === 'selectedPriorities'
        ? Object.entries(C.priorities).map(([value, p]) => ({ value, label: p.short }))
        : optionsFor(q, facts, year);
      const lab = (v) => (opts.find((o) => o.value === v) || { label: v }).label.replace(/\.$/, '');
      return Array.isArray(value) ? value.map(lab).join(', ') : lab(value);
    }

    // ---------- the safety layer ----------
    function safe(text) { return !C.forbidden.some((w) => text.includes(w)); }
    function guard(list) { return list.filter((t) => typeof t === 'string' && t && safe(t)); }

    // ---------- the result ----------
    function result(state, opts) {
      const w = walk(state, opts);
      if (!w.done) return null;
      const ctx = w.ctx;
      const scores = w.scores;
      const R = C.result;
      const primaryPriority = primaryOf(w.facts);
      const primaryArea = C.priorities[primaryPriority].area;
      const order = AREAS.slice().sort((a, b) => scores[b].score - scores[a].score || (a === primaryArea ? -1 : b === primaryArea ? 1 : 0) || a.localeCompare(b));
      const complements = order.filter((a) => a !== primaryArea && scores[a].score >= L.relevantScore).slice(0, 2);
      const shown = [primaryArea, ...complements];
      const answered = w.asked.filter((id) => id !== 'priorities' && id !== 'primary').length;
      const limited = ctx.unknownCount >= L.limitedUnknownMin && answered > 0 && ctx.unknownCount / answered >= L.limitedUnknownShare;

      const explainSrc = R.explain[primaryArea];
      const explain = guard([explainSrc.base, ...explainSrc.adds.filter((x) => !x.when || ev(x.when, ctx)).map((x) => x.text).slice(0, 2)]);

      const strongest = (a) => {
        const r = scores[a].reasons.filter((x) => x.kind !== 'preference' && x.pts > 0).sort((x, y) => y.pts - x.pts)[0];
        return r ? r.why : '';
      };
      const secondaryNeeds = complements.map((a) => ({ area: a, title: C.areas[a].title, score: scores[a].score, text: R.complement[a], because: strongest(a) }));

      const checksFor = (a) => R.checks[a].filter((c) => !c.when || ev(c.when, ctx)).map((c) => c.text);
      let checks = complements.length ? checksFor(primaryArea).slice(0, 2).concat(checksFor(complements[0]).slice(0, 1)) : checksFor(primaryArea).slice(0, 3);
      checks = guard(checks).slice(0, 3);

      const missing = R.missingFacts
        .filter((m) => m.areas.some((a) => shown.includes(a)) && !isKnown(ctx, m.fact))
        .map((m) => m.text).slice(0, 3);
      const documents = shown.map((a) => R.documents[a]);
      const contradictions = C.contradictions.filter((c) => ev(c.when, ctx)).map((c) => ({ id: c.id, text: c.text, areas: c.areas }));

      const indications = [];
      for (const a of shown) for (const r of scores[a].reasons) if (r.kind !== 'preference' && r.pts > 0) indications.push({ area: a, kind: r.kind, text: r.why });
      const known = w.asked.filter((id) => isKnown(ctx, id)).map((id) => ({ fact: id, label: Q[id].summaryLabel, value: valueLabel(Q[id], w.facts[id], w.facts, ctx.year) }));
      const missingAll = R.missingFacts.filter((m) => !isKnown(ctx, m.fact)).map((m) => m.fact);

      const numbers = shown.some((a) => ['A', 'C', 'D'].includes(a));
      return {
        taxYear: ctx.year,
        incomeBandsVerified: incomeBands(ctx.year).verified,
        limited,
        primaryPriority,
        primaryNeed: { area: primaryArea, label: C.priorities[primaryPriority].label, title: C.areas[primaryArea].title, score: scores[primaryArea].score, explain },
        secondaryNeeds,
        relevanceScores: Object.fromEntries(AREAS.map((a) => [a, { score: scores[a].score, title: C.areas[a].title, clarity: scores[a].clarity, reasons: scores[a].reasons.filter((r) => r.pts !== 0) }])),
        recommendedChecks: checks,
        missing,
        documents,
        contradictions,
        cannotTell: limited || contradictions.length > 0 || indications.some((x) => x.kind === 'gap' || x.kind === 'unchecked'),
        knowledge: { known, indications, missing: missingAll, contradictions: contradictions.map((c) => c.text), conclusions: shown.map((a) => C.areas[a].title) },
        callToAction: C.areas[primaryArea].cta,
        showNumbersLink: numbers,
        unknownCount: ctx.unknownCount,
      };
    }

    // ---------- WhatsApp: topics only, never answers, amounts or family details ----------
    function whatsappText(res) {
      const W = C.whatsapp;
      const more = res.secondaryNeeds.map((n) => C.areas[n.area].wa);
      const parts = [W.opening, W.primary.replace('{primary}', res.primaryNeed.label)];
      if (more.length) parts.push(W.more.replace('{more}', more.length === 2 ? `${more[0]} ו${more[1]}` : more[0]));
      parts.push(W.closing);
      return parts.join(' ');
    }
    function whatsappUrl(res, config) {
      return `${config.whatsappBase}${config.whatsappNumber}?text=${encodeURIComponent(whatsappText(res))}`;
    }

    // ---------- the internal summary for Roei (section 19), marked as self-reported ----------
    function summary(state, contact, opts) {
      const res = result(state, opts);
      if (!res) return '';
      const w = walk(state, opts);
      const S = C.summary;
      const now = (opts && opts.now) || new Date();
      const lines = [S.title, S.selfReported, ''];
      const c = contact || {};
      if (c.name) lines.push(`שם: ${c.name}`);
      if (c.phone) lines.push(`טלפון: ${c.phone}`);
      if (c.email) lines.push(`אימייל: ${c.email}`);
      if (c.time) lines.push(`זמן מועדף לשיחה: ${c.time}`);
      lines.push(`תאריך: ${now.toISOString().slice(0, 10)} · מזהה שאלון: ${state.sessionId}`);
      lines.push('');
      lines.push(`עדיפות ראשית: ${res.primaryNeed.label}`);
      const others = (w.facts.priorities || []).filter((p) => p !== res.primaryPriority).map((p) => C.priorities[p].label);
      lines.push(`עדיפויות משניות: ${others.length ? others.join(', ') : 'לא נבחרו'}`);
      lines.push(`מסלול השאלון: מסלול ${C.priorities[res.primaryPriority].n}, ${C.priorities[res.primaryPriority].short}${others.length ? ', עם התייחסות ל' + others.join(', ל') : ''}`);
      lines.push('');
      lines.push('התשובות (דיווח עצמי):');
      for (const a of answersList(state, opts)) if (a.questionId !== 'priorities' && a.questionId !== 'primary') lines.push(`- ${a.label}: ${a.value}`);
      if (!res.incomeBandsVerified && w.facts.income) lines.push('  (טווחי ההכנסה הוצגו כטווחים כלליים, בלי נתוני שנת מס מאומתים)');
      lines.push('');
      lines.push('ציוני רלוונטיות (0–100, לא דירוג של המצב הכלכלי):');
      lines.push(AREAS.map((a) => `${a} ${C.areas[a].title}: ${res.relevanceScores[a].score}`).join(' · '));
      lines.push('');
      lines.push(`אבחון ראשוני: ${res.knowledge.conclusions.join('; ')}${res.limited ? ' (אבחון מוגבל: רוב התשובות היו "לא יודע")' : ''}`);
      if (res.knowledge.indications.length) {
        lines.push('פערים אפשריים (אינדיקציות, לא עובדות):');
        for (const t of [...new Set(res.knowledge.indications.map((i) => i.text))]) lines.push(`- ${t}`);
      }
      if (res.contradictions.length) {
        lines.push('סתירות לבירור:');
        for (const x of res.contradictions) lines.push(`- ${x.text}`);
      }
      const shownAreas = [res.primaryNeed.area, ...res.secondaryNeeds.map((n) => n.area)];
      const miss = C.result.missingFacts.filter((m) => res.knowledge.missing.includes(m.fact) && m.areas.some((a) => shownAreas.includes(a))).map((m) => m.text);
      lines.push(`מידע חסר להמשך: ${miss.length ? miss.join('; ') : 'אין פריטים חסרים מהשאלון'}; בכל מקרה: ${res.documents.join('; ')}`);
      lines.push(`נושאים לבירור בשיחה: ${res.recommendedChecks.join(' | ')}`);
      const urgency = S.urgency.filter((u) => ev(u.when, w.ctx));
      lines.push(`דחיפות: ${urgency.length ? urgency.map((u) => `${u.level} (${u.text})`).join('; ') : S.urgencyUnknown}`);
      lines.push('שאלות פתיחה מוצעות:');
      const openFor = (a) => (S.opening[a] || []).find((o) => !o.when || ev(o.when, w.ctx));
      const opening = [res.primaryNeed.area, ...res.secondaryNeeds.map((n) => n.area)].map(openFor).filter(Boolean).map((o) => o.text);
      for (const a of S.opening[res.primaryNeed.area] || []) if (opening.length < 3 && !opening.includes(a.text) && (!a.when || ev(a.when, w.ctx))) opening.push(a.text);
      opening.slice(0, 3).forEach((t, i) => lines.push(`${i + 1}. ${t}`));
      if (c.source) { lines.push(''); lines.push(`מקור הגעה: ${c.source}`); }
      return guard(lines.map((l) => (l === '' ? ' ' : l))).map((l) => (l === ' ' ? '' : l)).join('\n');
    }

    // ---------- the session model (section 28) ----------
    function session(state, opts) {
      const w = walk(state, opts);
      return {
        sessionId: state.sessionId,
        selectedPriorities: w.facts.priorities || [],
        answers: w.valid.map((h) => ({ ...h })),
        derivedFacts: { ...w.facts },
        missingInformation: C.result.missingFacts.filter((m) => !isKnown(w.ctx, m.fact)).map((m) => m.fact),
        currentStep: w.next ? w.next.id : null,
        completionStatus: w.done ? 'complete' : 'in-progress',
      };
    }

    // ---------- saving on this device only, without contact details ----------
    function serialize(state, now) { return JSON.stringify({ ...state, savedAt: (now || new Date()).getTime() }); }
    function restore(json, maxAgeDays, now) {
      try {
        const s = JSON.parse(json);
        if (!s || s.v !== STATE_VERSION || !Array.isArray(s.history) || typeof s.sessionId !== 'string') return null;
        if (((now || new Date()).getTime() - (s.savedAt || 0)) > maxAgeDays * 86400000) return null;
        const clean = { v: s.v, sessionId: s.sessionId, startedAt: s.startedAt, drafts: {}, history: s.history.filter((h) => h && Q[h.questionId]).map((h) => ({ questionId: h.questionId, value: h.value, timestamp: h.timestamp })) };
        // anything that no longer fits the questions is dropped by the replay
        clean.history = walk(clean, { now }).valid;
        return clean;
      } catch (e) { return null; }
    }

    // ---------- self-check of the content, run by the tests ----------
    function validate() {
      const errors = [];
      const facts = new Set(['priorities', 'primary', ...Object.keys(Q)]);
      for (const q of Object.values(Q)) for (const d of q.derive || []) Object.keys(d.set).forEach((k) => facts.add(k));
      const checkCond = (c, where) => {
        if (!c) return;
        if (c.all || c.any) return (c.all || c.any).forEach((x) => checkCond(x, where));
        if (c.not) return checkCond(c.not, where);
        if ('fact' in c && !facts.has(c.fact)) errors.push(`${where}: unknown fact ${c.fact}`);
        if (('priority' in c || 'primary' in c || 'secondary' in c) && !C.priorities[c.priority || c.primary || c.secondary]) errors.push(`${where}: unknown priority`);
        if (c.score && !AREAS.includes(c.score.area)) errors.push(`${where}: unknown area`);
      };
      for (const [id, q] of Object.entries(Q)) {
        if (!q.summaryLabel) errors.push(`${id}: no summary label`);
        if (!['single', 'multi'].includes(q.type)) errors.push(`${id}: bad type`);
        if (!q.options && !q.optionsFrom) errors.push(`${id}: no options`);
        if (q.options) {
          const vals = q.options.map((o) => o.value);
          if (new Set(vals).size !== vals.length) errors.push(`${id}: duplicate option`);
          if (q.options.length < 2) errors.push(`${id}: too few options`);
        }
        checkCond(q.when, id);
        (Array.isArray(q.text) ? q.text : []).forEach((t) => checkCond(t.when, id));
      }
      for (const [p, path] of Object.entries(C.paths)) {
        if (!C.priorities[p]) errors.push(`path ${p}: no priority`);
        [...path.core, ...path.key].forEach((id) => { if (!Q[id]) errors.push(`path ${p}: unknown question ${id}`); });
      }
      for (const p of Object.keys(C.priorities)) if (!C.paths[p]) errors.push(`priority ${p}: no path`);
      C.bridges.forEach((b) => b.questions.forEach((id) => { if (!Q[id]) errors.push(`bridge: unknown question ${id}`); }));
      C.background.forEach((b) => { if (!Q[b.question]) errors.push(`background: unknown question ${b.question}`); checkCond(b.when, 'background ' + b.question); });
      C.messages.forEach((m) => { checkCond(m.when, 'message ' + m.id); if (m.after !== '*') m.after.forEach((id) => { if (!Q[id]) errors.push(`message ${m.id}: unknown question ${id}`); }); });
      C.scoring.forEach((r, i) => { if (!AREAS.includes(r.area)) errors.push(`rule ${i}: bad area`); checkCond(r.when, 'rule ' + i); if (!r.why) errors.push(`rule ${i}: no reason`); });
      C.contradictions.forEach((x) => checkCond(x.when, 'contradiction ' + x.id));
      for (const t of allTexts()) if (!safe(t)) errors.push('forbidden wording: ' + t);
      return errors;
    }
    function allTexts() {
      const out = [];
      const walkObj = (o, key) => {
        if (typeof o === 'string') { if (key !== 'value' && !/^[a-zA-Z0-9*]+$/.test(o)) out.push(o); return; }
        if (Array.isArray(o)) return o.forEach((x) => walkObj(x, key));
        if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (k !== 'forbidden') walkObj(v, k);
      };
      walkObj(C, '');
      return out;
    }

    return { newState, answer, skip, back, editFrom, view, answersList, result, whatsappText, whatsappUrl, summary, session, serialize, restore, validate, allTexts, incomeBands, safe, _walk: walk, AREAS };
  }

  const api = { make };
  if (root.CompassContent && root.CompassRegulatory) api.engine = make(root.CompassContent, root.CompassRegulatory);
  root.CompassEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
