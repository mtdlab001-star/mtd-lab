import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hmrcApiBase } from '@/lib/hmrc'
import { getValidHmrcAccessToken } from '@/lib/hmrc-connection'
import { buildFraudHeaders } from '@/lib/hmrc-fraud'
import { isSameOriginRequest } from '@/lib/request-security'

function num(form:FormData,key:string){const raw=String(form.get(key)||'').trim();if(!raw)return undefined;const n=Number(raw);return Number.isFinite(n)&&n>=0?n:undefined}
function text(form:FormData,key:string){const v=String(form.get(key)||'').trim();return v||undefined}
function clean(obj:any):any{if(Array.isArray(obj))return obj.map(clean);if(obj&&typeof obj==='object')return Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined).map(([k,v])=>[k,clean(v)]));return obj}
function taxYearStart(taxYear:string){return Number(taxYear.slice(0,4))}
function anyDefined(obj:any){return Object.values(obj).some(v=>v!==undefined&&v!=='')}

export async function POST(req:Request){
 if(!isSameOriginRequest(req))return new NextResponse('Invalid request origin',{status:403})
 const form=await req.formData();const taxpayerId=String(form.get('taxpayerId')||'demo');const taxYear=String(form.get('taxYear')||'')
 const back=new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/end-of-year/other-income`,req.url);back.searchParams.set('taxYear',taxYear)
 if(!/^20\d{2}-\d{2}$/.test(taxYear)){back.searchParams.set('error','Select a valid HMRC tax year');return NextResponse.redirect(back,303)}
 const is2026On=taxYearStart(taxYear)>=2026;const payload:any={}
 const postAmount=num(form,'postCessationAmount');const postTaxYear=text(form,'postCessationTaxYear')
 if(postAmount!==undefined||postTaxYear){if(postAmount===undefined||!postTaxYear){back.searchParams.set('error','Post cessation receipts require both amount and tax year to be taxed.');return NextResponse.redirect(back,303)}payload.postCessationReceipts=[clean({customerReference:text(form,'postCustomerReference'),businessName:text(form,'postBusinessName'),dateBusinessCeased:text(form,'dateBusinessCeased'),businessDescription:text(form,'businessDescription'),incomeSource:text(form,'postIncomeSource'),amount:postAmount,taxYearIncomeToBeTaxed:postTaxYear})]}
 const businessGross=num(form,'businessReceiptGross');const businessTaxYear=text(form,'businessReceiptTaxYear')
 if(businessGross!==undefined||businessTaxYear){if(is2026On){back.searchParams.set('error','Business receipts are not part of the HMRC Other Income request schema for 2026-27 onwards.');return NextResponse.redirect(back,303)}if(businessGross===undefined||!businessTaxYear){back.searchParams.set('error','Business receipts require both gross amount and tax year.');return NextResponse.redirect(back,303)}payload.businessReceipts=[{grossAmount:businessGross,taxYear:businessTaxYear}]}
 const gainAmount=num(form,'overseasGainAmount');if(gainAmount!==undefined)payload.overseasIncomeAndGains={gainAmount}
 const omittedAmount=num(form,'omittedForeignIncomeAmount');if(omittedAmount!==undefined)payload.omittedForeignIncome={amount:omittedAmount}
 if(is2026On){
  const abroad=clean({countryCode:text(form,'abroadCountryCode')?.toUpperCase(),amountBeforeTax:num(form,'abroadAmountBeforeTax'),taxTakenOff:num(form,'abroadTaxTakenOff'),specialWithholdingTax:num(form,'abroadSpecialWithholdingTax'),foreignTaxCreditRelief:String(form.get('abroadForeignTaxCreditRelief')||'')==='yes'?true:undefined,taxableAmount:num(form,'abroadTaxableAmount'),residentialFinancialCostAmount:num(form,'abroadResidentialFinancialCost'),broughtFwdResidentialFinancialCostAmount:num(form,'abroadBroughtForwardResidentialFinancialCost')})
  if(anyDefined(abroad)){if(!abroad.countryCode||abroad.taxableAmount===undefined){back.searchParams.set('error','Income received whilst abroad requires a three letter country code and taxable amount.');return NextResponse.redirect(back,303)}if(!/^[A-Z]{3}$/.test(abroad.countryCode)){back.searchParams.set('error','Country code must be a three letter ISO country code such as FRA or GBR.');return NextResponse.redirect(back,303)}payload.allOtherIncomeReceivedWhilstAbroad=[abroad]}
  const gifts=clean({transactionBenefit:num(form,'transactionBenefit'),protectedForeignIncomeSourceBenefit:num(form,'protectedForeignIncomeSourceBenefit'),protectedForeignIncomeOnwardGift:num(form,'protectedForeignIncomeOnwardGift'),benefitReceivedAsASettler:num(form,'benefitReceivedAsASettler'),onwardGiftReceivedAsASettler:num(form,'onwardGiftReceivedAsASettler')});if(anyDefined(gifts))payload.chargeableForeignBenefitsAndGifts=gifts
  const assetType=text(form,'preOwnedAssetType');const assetAmount=num(form,'preOwnedAssetAmount');if(assetType||assetAmount!==undefined){if(!assetType||assetAmount===undefined){back.searchParams.set('error','Pre owned asset benefit requires both asset type and amount.');return NextResponse.redirect(back,303)}payload.benefitFromPreOwnedAssets=[{typeOfAsset:assetType,amountOfBenefit:assetAmount}]}
  const category=text(form,'additionalIncomeCategory');const breakdown=clean({amountBeforeTax:num(form,'additionalAmountBeforeTax'),allowableExpenses:num(form,'additionalAllowableExpenses'),taxDeducted:num(form,'additionalTaxDeducted'),lossesBroughtForward:num(form,'additionalLossesBroughtForward'),carryForwardLosses:num(form,'additionalCarryForwardLosses')})
  const allowed=new Set(['propertyIncomeDistributions','personalInsuranceBenefits','incomeFromUnauthorisedUnitTrust','profitsFromCertificateOfDeposit','nonCashBenefitsFromFormerEmployer','authorisedPaymentsFromOverseasPensionScheme','taxableAnnualPayments','miscellaneousIncome'])
  if(category||anyDefined(breakdown)){if(!category||!allowed.has(category)){back.searchParams.set('error','Choose a valid additional income category.');return NextResponse.redirect(back,303)}if(!anyDefined(breakdown)){back.searchParams.set('error','Enter at least one amount for the selected additional income category.');return NextResponse.redirect(back,303)}payload.additionalIncome={[category]:breakdown}}
 }
 if(Object.keys(payload).length===0){back.searchParams.set('error','Enter at least one Other Income item before submitting.');return NextResponse.redirect(back,303)}
 const {data:taxpayer}=await supabaseAdmin().from('taxpayers').select('nino').eq('id',taxpayerId).maybeSingle();if(!taxpayer?.nino){back.searchParams.set('error','Taxpayer NINO is missing');return NextResponse.redirect(back,303)}
 let token:string;try{token=await getValidHmrcAccessToken(taxpayerId)}catch(e:any){back.searchParams.set('error',e.message||'HMRC connection is incomplete');return NextResponse.redirect(back,303)}
 const fraud=buildFraudHeaders(req,form,taxpayerId);if(fraud.missing.length){back.searchParams.set('error',`Missing HMRC fraud prevention data: ${fraud.missing.join(', ')}`);return NextResponse.redirect(back,303)}
 try{
  const res=await fetch(`${hmrcApiBase}/individuals/other-income/${encodeURIComponent(taxpayer.nino)}/${encodeURIComponent(taxYear)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.hmrc.3.0+json','Content-Type':'application/json',...(process.env.HMRC_ENVIRONMENT==='production'?{}:{'Gov-Test-Scenario':'STATEFUL'}),...fraud.headers},body:JSON.stringify(payload),cache:'no-store'})
  const body=await res.text();let data:any={};try{data=body?JSON.parse(body):{}}catch{data={raw:body}}const correlationId=res.headers.get('x-correlationid')||res.headers.get('x-correlation-id')||''
  if(!res.ok){const first=Array.isArray(data?.errors)&&data.errors[0]?`${data.errors[0].code||''} ${data.errors[0].message||''}`.trim():'';back.searchParams.set('error',first||data?.message||data?.code||`HMRC ${res.status}`);if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)}
  back.searchParams.set('saved','1');if(correlationId)back.searchParams.set('correlationId',correlationId);return NextResponse.redirect(back,303)
 }catch(e:any){back.searchParams.set('error',e.message||'Could not submit HMRC Other Income');return NextResponse.redirect(back,303)}
}
