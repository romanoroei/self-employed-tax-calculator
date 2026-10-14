const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const core=html.slice(html.indexOf('const TAX_DATA'),html.indexOf('function renderParameters'));
const api=vm.runInNewContext(core+'\n;({TAX_DATA,calculateScenario,calculateCombined,evaluateDeposit,insuranceEstimate})',{Intl});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
function bestAt(income,deposit,data,extra){
  return ['regular','mutav'].map(route=>api.evaluateDeposit(income,deposit,data,route,extra,0)).filter(Boolean).sort((a,b)=>b.total-a.total||b.deduction-a.deduction)[0];
}
test('2026 maximum-income example preserves conservative target and tax benefits',()=>{
  const r=api.calculateCombined(500000,2026);
  assert.equal(r.targetDeposit,45642);
  assert.equal(r.minimumDeposit,45060);
  assert.equal(r.deposit,45060);
  assert.equal(r.deduction,25608);
  assert.equal(r.credit,12804);
  near(r.total,13444.2);
  near(r.pensionTotal,17765.35014680573);
});
test('disability deduction removes the extra half-percent throughout the combined calculation',()=>{
  const r=api.calculateCombined(500000,2026,false);
  assert.equal(r.extraCredit,false);
  assert.equal(r.credit,11640);
  assert.equal(r.deduction,25608);
  assert.equal(r.minimumDeposit,45060);
  near(r.total,13036.8);
  const normal=api.calculateCombined(500000,2026,true);
  near(normal.total-r.total,407.4);
  near(normal.study.total,r.study.total);
});
test('study-fund explanation uses the income actually passed to the pension calculation',()=>{
  const r=api.calculateCombined(165000,2026);
  near(r.study.deduction,7425);
  near(r.income,157575);
  assert.equal([...html.matchAll(/id="joint-note"/g)].length,0);
  assert.match(html, /<h3 class="fund-heading pension-heading">[\s\S]*?id="pension-income"[\s\S]*?<\/h3>/);
  assert.match(html, /<h3 class="fund-heading study-heading">[\s\S]*?id="study-income"[\s\S]*?<\/h3>/);
});
test('minimum preserves all displayed pension benefits across years and tier boundaries',()=>{
  const incomes=[0,1,50000,84120,116399,116400,116401,157575,164399,164400,164401,165000,232799,232800,232801,291000,486797.135,500000,560280,721560,1000000];
  for(const year of [2024,2025,2026])for(const extra of [true,false])for(const income of incomes){
    const r=api.calculateScenario(income,year,0,extra);
    assert.ok(Number.isInteger(r.minimumDeposit)&&r.minimumDeposit>=0&&r.minimumDeposit<=r.targetDeposit);
    const minimum=bestAt(income,r.minimumDeposit,r.data,extra);
    assert.equal(r.deposit,r.minimumDeposit);
    near(minimum.total,r.total);
    near(minimum.deduction,r.deduction);
    const insurance=api.insuranceEstimate(income,minimum.deduction,year);
    const targetInsurance=api.insuranceEstimate(income,r.deduction,year);
    near(insurance.national,targetInsurance.national);
    near(insurance.health,targetInsurance.health);
    if(r.minimumDeposit>0){
      const lower=bestAt(income,r.minimumDeposit-1,r.data,extra);
      assert.ok(lower.total<r.total-1e-7||lower.deduction<r.deduction-1e-7);
    }
  }
});
test('no smaller deposit qualifies, including the preferred-member threshold',()=>{
  for(const income of [157575,500000])for(const extra of [true,false]){
    const r=api.calculateScenario(income,2026,0,extra);
    for(let deposit=0;deposit<r.minimumDeposit;deposit++){
      const candidate=bestAt(income,deposit,r.data,extra);
      assert.ok(candidate.total<r.total-1e-7||candidate.deduction<r.deduction-1e-7);
    }
  }
});
test('all inline scripts remain valid JavaScript',()=>{
  for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(script[1]);
});
