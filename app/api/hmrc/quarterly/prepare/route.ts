import { NextResponse } from 'next/server'

function money(value: FormDataEntryValue | null) {
  const n=Number(value||0)
  return Number.isFinite(n) && n >= 0 ? Math.round(n*100)/100 : 0
}

export async function POST(req: Request) {
  const form=await req.formData()
  const taxpayerId=String(form.get('taxpayerId')||'demo')
  const payload={
    taxpayerId,
    businessId:String(form.get('businessId')||''),
    periodStart:String(form.get('periodStart')||''),
    periodEnd:String(form.get('periodEnd')||''),
    turnover:money(form.get('turnover')),
    otherIncome:money(form.get('otherIncome')),
    costOfGoods:money(form.get('costOfGoods')),
    staffCosts:money(form.get('staffCosts')),
    travelCosts:money(form.get('travelCosts')),
    premisesCosts:money(form.get('premisesCosts')),
    professionalFees:money(form.get('professionalFees')),
    otherExpenses:money(form.get('otherExpenses'))
  }
  const token=Buffer.from(JSON.stringify(payload),'utf8').toString('base64url')
  return NextResponse.redirect(new URL(`/taxpayers/${encodeURIComponent(taxpayerId)}/quarterly/review?data=${encodeURIComponent(token)}`,req.url),303)
}
