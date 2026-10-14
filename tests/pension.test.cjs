const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const core=html.slice(html.indexOf('const TAX_DATA'),html.indexOf('function renderParameters'));
const api=vm.runInNewContext(core+'\n;({TAX_DATA,calculateMaximumPlan,calculateScenario,calculateCombined,calculateChosenDeposits,calculateMandatoryDeposit,createDepositPlan,evaluateDeposit,insuranceEstimate,insuranceGrossBoundaries,deductionLimit,comparePensionBenefits})',{Intl});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
function bestAt(income,deposit,data,extra){
  return ['regular','mutav'].map(route=>api.evaluateDeposit(income,deposit,data,route,extra,0)).filter(Boolean).sort(api.comparePensionBenefits)[0];
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
  assert.match(html, /<h3 class="fund-heading pension-heading"[^>]*>[\s\S]*?id="pension-income"[\s\S]*?<\/h3>/);
  assert.match(html, /<h3 class="fund-heading study-heading"[^>]*>[\s\S]*?id="study-income"[\s\S]*?<\/h3>/);
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
      assert.ok(lower.combinedBenefit<r.combinedBenefit-1e-7);
    }
  }
});
test('no smaller deposit qualifies, including the preferred-member threshold',()=>{
  for(const income of [157575,500000])for(const extra of [true,false]){
    const r=api.calculateScenario(income,2026,0,extra);
    for(let deposit=0;deposit<r.minimumDeposit;deposit++){
      const candidate=bestAt(income,deposit,r.data,extra);
      assert.ok(candidate.combinedBenefit<r.combinedBenefit-1e-7);
    }
  }
});
test('all inline scripts remain valid JavaScript',()=>{
  for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(script[1]);
});

test('chosen deposits use exact amounts, including zero and partial study deductions',()=>{
  const zero=api.calculateChosenDeposits(200000,2026,0,0);
  near(zero.total,0);
  const partial=api.calculateChosenDeposits(200000,2026,1000,2000);
  near(partial.study.deduction,2000);
  near(partial.study.deductionSaving,400);
  near(partial.pension.deposit,1000);
  near(partial.pension.deduction,1000);
  near(partial.pension.total,200);
  near(partial.tax,600);
  near(partial.total,partial.tax+partial.insurance);
});
test('chosen deposits reproduce target benefits and preserve pension status thresholds',()=>{
  for(const year of [2024,2025,2026])for(const extra of [true,false]){
    const target=api.calculateCombined(500000,year,extra);
    const chosen=api.calculateChosenDeposits(500000,year,target.minimumDeposit,target.study.targetDeposit,extra);
    near(chosen.total,target.grandTotal);
    for(const deposit of [0,1000,26435,26436,45060]){
      const r=api.calculateChosenDeposits(500000,year,deposit,0,extra);
      near(r.pension.total,bestAt(500000,deposit,api.TAX_DATA[year],extra).total);
      near(r.pension.deposit,deposit);
    }
  }
  assert.throws(()=>api.calculateChosenDeposits(100000,2026,-1,0));
  assert.throws(()=>api.calculateChosenDeposits(100000,2026,0,NaN));
});

test('mandatory deposits use the two legal bands and annual ceiling in each year',()=>{
  for(const year of [2024,2025,2026]){
    const half=api.TAX_DATA[year].averageMonthlyWage*6;
    near(api.calculateMandatoryDeposit(0,year).deposit,0);
    near(api.calculateMandatoryDeposit(50000,year).raw,2225);
    near(api.calculateMandatoryDeposit(half,year).raw,half*.0445);
    near(api.calculateMandatoryDeposit(half+1000,year).raw,half*.0445+125.5);
    const capped=api.calculateMandatoryDeposit(half*2,year);
    near(capped.raw,half*.17);
    assert.equal(capped.deposit,Math.ceil(capped.raw));
    assert.equal(api.calculateMandatoryDeposit(1000000,year).deposit,capped.deposit);
  }
  assert.equal(api.calculateMandatoryDeposit(500000,2026).deposit,14045);
  assert.equal(api.calculateMandatoryDeposit(500000,2025).deposit,12787);
  assert.throws(()=>api.calculateMandatoryDeposit(-1,2026));
  assert.throws(()=>api.calculateMandatoryDeposit(100000,2023));
});
test('selected plans preserve the deposit, complete breakdown, and combined benefits',()=>{
  for(const [pension,study] of [[0,0],[1000,2000],[5000,3000],[14045,0],[50000,25000]]){
    const r=api.createDepositPlan(200000,2026,pension,study);
    const chosen=api.calculateChosenDeposits(200000,2026,pension,study);
    assert.equal(r.minimumDeposit,pension);
    assert.equal(r.study.deposit,study);
    near(r.income,200000-r.study.deduction);
    near(r.grandTotal,chosen.total);
    near(r.pensionTotal+r.study.total,r.grandTotal);
    near(r.deductionSaving+r.creditSaving,r.total);
    near(r.study.capitalBenefit,Math.min(study,20566)*(Math.pow(1.08,6)-1)*.25);
  }
  const target=api.calculateCombined(500000,2026);
  near(api.createDepositPlan(500000,2026,target.minimumDeposit,target.study.deposit).grandTotal,target.grandTotal);
});

// Independent insurance oracle: bisection, separate from the closed-form code.
const insuranceRates={
  2026:{band:92436,cap:622920,min:41304,nLow:.0447,nHigh:.1283,hLow:.0323,hHigh:.0517},
  2025:{band:90264,cap:608340,min:37608,nLow:.0447,nHigh:.1283,hLow:.0323,hHigh:(.0516+11*.0517)/12},
  2024:{band:90264,cap:588360,min:37608,nLow:.0287,nHigh:.1283,hLow:.031,hHigh:.05}
};
function referenceAssessment(income,year){
  const d=insuranceRates[year];
  const charge=base=>{base=Math.max(d.min,Math.min(d.cap,base));return {national:Math.min(base,d.band)*d.nLow+Math.max(0,base-d.band)*d.nHigh,health:Math.min(base,d.band)*d.hLow+Math.max(0,base-d.band)*d.hHigh};};
  let low=0,high=Math.max(0,income);
  for(let i=0;i<80;i++){const middle=(low+high)/2;if(middle+.52*charge(middle).national>income)high=middle;else low=middle;}
  return charge((low+high)/2);
}
function referenceTax(income,year){
  const limits=year===2026?[84120,120720,228000,301200,560280,721560,Infinity]:[84120,120720,193800,269280,560280,721560,Infinity];
  const rates=[.1,.14,.2,.31,.35,.47,.5];let tax=0,lower=0;
  for(let i=0;i<limits.length;i++){tax+=Math.max(0,Math.min(income,limits[i])-lower)*rates[i];lower=limits[i];}
  return tax;
}
function referenceBenefit(income,deposit,deduction,creditCap,year){
  const before=referenceAssessment(income,year),after=referenceAssessment(Math.max(0,income-deduction),year);
  const remainingTax=referenceTax(Math.max(0,income-deduction),year);
  const credit=Math.min(deposit-deduction,creditCap);
  return referenceTax(income,year)-remainingTax+Math.min(credit*.35,remainingTax)+before.national-after.national+before.health-after.health;
}

test('insurance matches an independent numerical assessment across all years, bands, floor and cap',()=>{
  for(const year of [2024,2025,2026])for(const income of [0,10000,40000,50000,82614,92436,95000,100000,165228,200000,500000,622920,660000,700000,1000000])for(const deduction of [0,1000,5000,11508,25608]){
    const before=referenceAssessment(income,year),after=referenceAssessment(Math.max(0,income-deduction),year),got=api.insuranceEstimate(income,deduction,year);
    near(got.national,before.national-after.national);near(got.health,before.health-after.health);
  }
});

test('statutory minimum at 200,000 optimizes tax and both insurance components together',()=>{
  const duty=api.calculateMandatoryDeposit(200000,2026);
  const r=api.createDepositPlan(200000,2026,duty.deposit,0);
  near(r.deduction,11508);near(r.credit,2537);near(r.total,3189.55);
  near(r.pensionInsurance.national,1384.13260886684);near(r.pensionInsurance.health,557.752578943224);
  near(r.grandTotal,5131.43518781006);
  // The previous income-tax-only allocation saved 4,192 tax but just 814.18 insurance.
  const previous=referenceBenefit(200000,duty.deposit,4825,9220,2026);
  near(previous,5006.1810941244);assert.ok(r.grandTotal>previous+125);
});

test('statutory minimum at 500,000 preserves the verified insurance savings',()=>{
  const r=api.createDepositPlan(500000,2026,api.calculateMandatoryDeposit(500000,2026).deposit,0);
  near(r.deduction,11508);near(r.total,4915.75);
  near(r.pensionInsurance.national,11508*.1283/(1+.52*.1283));
  near(r.pensionInsurance.health,11508*.0517/(1+.52*.1283));
  near(r.grandTotal,6857.63518781006);
});

test('statutory deposits do not invent insurance savings for credit-only or capped cases',()=>{
  for(const income of [40000,50000,700000]){
    const r=api.createDepositPlan(income,2026,api.calculateMandatoryDeposit(income,2026).deposit,0);
    near(r.pensionInsurance.national,0);near(r.pensionInsurance.health,0);
    if(income===50000){near(r.deduction,0);near(r.total,778.75);}
  }
});

test('chosen allocation beats an independent grid across tax brackets and insurance boundaries',()=>{
  for(const year of [2024,2025,2026])for(const extra of [true,false])for(const income of [42000,50000,95000,120721,165228,200000,500000,660500,700000]){
    const duty=api.calculateMandatoryDeposit(income,year);
    for(const deposit of [1000,duty.deposit,30000]){
      // Use the same disability option in the public calculation and each legal route.
      const actual=api.calculateChosenDeposits(income,year,deposit,0,extra).pension;
      near(actual.combinedBenefit,referenceBenefit(income,deposit,actual.deduction,actual.creditCap,year));
      for(const route of ['regular','mutav']){
        const candidate=api.evaluateDeposit(income,deposit,api.TAX_DATA[year],route,extra,0);
        if(!candidate)continue;
        const limit=api.deductionLimit(income,deposit,api.TAX_DATA[year],route);
        for(let i=0;i<=100;i++){
          const deduction=limit*i/100;
          const benefit=referenceBenefit(income,deposit,deduction,candidate.creditCap,year);
          assert.ok(actual.combinedBenefit>=benefit-1e-6,JSON.stringify({year,extra,income,deposit,route,deduction,benefit,actual:actual.combinedBenefit}));
        }
      }
    }
  }
});


test('pension-only maximum uses full income and reproduces standalone pension optimization',()=>{
  for(const year of [2024,2025,2026])for(const extra of [true,false])for(const income of [0,50000,100000,165000,200000,500000,1000000]){
    const plan=api.calculateMaximumPlan(income,year,extra,'pension'),standalone=api.calculateScenario(income,year,0,extra);
    assert.equal(plan.scope,'pension');near(plan.study.deposit,0);near(plan.study.deduction,0);near(plan.income,income);
    near(plan.minimumDeposit,standalone.minimumDeposit);near(plan.total,standalone.total);near(plan.grandTotal,standalone.combinedBenefit);
    const chosen=api.createDepositPlan(income,year,plan.minimumDeposit,0,extra);near(plan.grandTotal,chosen.grandTotal);
  }
  const pensionOnly=api.calculateMaximumPlan(165000,2026,true,'pension'),both=api.calculateMaximumPlan(165000,2026,true,'both');
  assert.notEqual(pensionOnly.minimumDeposit,both.minimumDeposit);
});

test('study-only maximum keeps pension zero and distinguishes current deductions from the exempt ceiling',()=>{
  for(const year of [2024,2025,2026])for(const income of [0,50000,100000,200000,500000]){
    const plan=api.calculateMaximumPlan(income,year,true,'study');
    assert.equal(plan.scope,'study');near(plan.minimumDeposit,0);near(plan.deposit,0);near(plan.total,0);near(plan.pensionTotal,0);
    near(plan.study.deposit,income===0?0:year===2026?20566:20520);near(plan.study.deduction,Math.min(Math.min(income,293397)*.045,13203));
    near(plan.grandTotal,plan.study.total);
    const chosen=api.createDepositPlan(income,year,0,plan.study.deposit);near(plan.grandTotal,chosen.grandTotal);
  }
  const plan=api.calculateMaximumPlan(200000,2026,true,'study');near(plan.study.deposit,20566);near(plan.study.deduction,9000);
});

test('both-product maximum preserves the existing combined plan and invalid choices are rejected',()=>{
  for(const year of [2024,2025,2026])for(const income of [0,100000,200000,500000]){
    const plan=api.calculateMaximumPlan(income,year),combined=api.calculateCombined(income,year);
    assert.equal(plan.scope,'both');near(plan.minimumDeposit,combined.minimumDeposit);near(plan.study.deposit,combined.study.deposit);near(plan.grandTotal,combined.grandTotal);
  }
  assert.throws(()=>api.calculateMaximumPlan(200000,2026,true,'other'));
  assert.throws(()=>api.calculateMaximumPlan(-1,2026,true,'pension'));
  assert.throws(()=>api.calculateMaximumPlan(100000,2023,true,'study'));
});
