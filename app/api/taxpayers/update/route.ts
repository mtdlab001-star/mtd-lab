import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSameOriginRequest } from '@/lib/request-security'
import { currentWorkspace } from '@/lib/workspace'

function cleanNino(value: string) { return value.trim().toUpperCase().replace(/\s+/g, '') }
function cleanMtditid(value: string) { return value.trim().toUpperCase().replace(/\s+/g, '') }

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  try {
    const workspace = await currentWorkspace()
    if (!workspace) return NextResponse.json({ error: 'Accounting workspace access is not available' }, { status: 403 })
    const body = await req.json()
    const taxpayerId = String(body?.taxpayerId || '').trim()
    const displayName = String(body?.displayName || '').trim()
    const nino = cleanNino(String(body?.nino || ''))
    const mtditid = cleanMtditid(String(body?.mtditid || ''))
    const qualifyingIncomeText = String(body?.qualifyingIncome || '').trim()
    const qualifyingIncome = qualifyingIncomeText ? Number(qualifyingIncomeText) : null
    const qualifyingIncomeTaxYear = String(body?.qualifyingIncomeTaxYear || '').trim()
    const mtdSignupStatus = String(body?.mtdSignupStatus || 'not_checked')
    const mtdExemptionStatus = String(body?.mtdExemptionStatus || 'not_assessed')
    const previousReturnSubmitted = body?.previousReturnSubmitted === 'yes' ? true : body?.previousReturnSubmitted === 'no' ? false : null
    if (!taxpayerId || taxpayerId.length > 200) return NextResponse.json({ error: 'A valid client is required' }, { status: 400 })
    if (!displayName || displayName.length > 120) return NextResponse.json({ error: 'Enter a client name of no more than 120 characters' }, { status: 400 })
    if (nino && !/^[A-Z]{2}\d{6}[A-D]$/.test(nino)) return NextResponse.json({ error: 'Enter a valid NI number, for example AB123456C' }, { status: 400 })
    if (mtditid && !/^[A-Z0-9]{15}$/.test(mtditid)) return NextResponse.json({ error: 'Enter a valid 15 character MTD Income Tax ID' }, { status: 400 })
    if (qualifyingIncome!==null&&(!Number.isFinite(qualifyingIncome)||qualifyingIncome<0)) return NextResponse.json({ error: 'Enter a valid nonnegative qualifying income' }, { status: 400 })
    if (qualifyingIncomeTaxYear&&!/^20\d{2}-\d{2}$/.test(qualifyingIncomeTaxYear)) return NextResponse.json({ error: 'Enter the income test tax year as 2025-26' }, { status: 400 })
    if (!['not_checked','not_required','needs_signup','signed_up'].includes(mtdSignupStatus)) return NextResponse.json({ error: 'Select a valid MTD sign-up status' }, { status: 400 })
    if (!['not_assessed','not_exempt','application_pending','approved'].includes(mtdExemptionStatus)) return NextResponse.json({ error: 'Select a valid exemption status' }, { status: 400 })
    const db = supabaseAdmin()
    const { data, error } = await db.from('taxpayers').update({ display_name: displayName, nino, mtditid, qualifying_income:qualifyingIncome, qualifying_income_tax_year:qualifyingIncomeTaxYear||null, mtd_signup_status:mtdSignupStatus, mtd_exemption_status:mtdExemptionStatus, previous_return_submitted:previousReturnSubmitted, updated_at: new Date().toISOString() }).eq('id', taxpayerId).eq('firm_id', workspace.firmId).select('id').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Client details could not be updated' }, { status: 500 })
  }
}
