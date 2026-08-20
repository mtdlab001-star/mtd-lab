export type QuarterlyPeriodType = 'standard' | 'calendar'

export function quarterlyPeriodLabel(value?: string | null) {
  return String(value || '').toLowerCase().includes('calendar') ? 'Calendar quarters' : 'Standard quarters'
}

export function quarterlyPeriodDates(taxYearStart: number, type: QuarterlyPeriodType) {
  if (type === 'calendar') return [
    { quarter: 1, start: `${taxYearStart}-04-01`, end: `${taxYearStart}-06-30`, due: `${taxYearStart}-08-07` },
    { quarter: 2, start: `${taxYearStart}-04-01`, end: `${taxYearStart}-09-30`, due: `${taxYearStart}-11-07` },
    { quarter: 3, start: `${taxYearStart}-04-01`, end: `${taxYearStart}-12-31`, due: `${taxYearStart + 1}-02-07` },
    { quarter: 4, start: `${taxYearStart}-04-01`, end: `${taxYearStart + 1}-03-31`, due: `${taxYearStart + 1}-05-07` }
  ]
  return [
    { quarter: 1, start: `${taxYearStart}-04-06`, end: `${taxYearStart}-07-05`, due: `${taxYearStart}-08-07` },
    { quarter: 2, start: `${taxYearStart}-04-06`, end: `${taxYearStart}-10-05`, due: `${taxYearStart}-11-07` },
    { quarter: 3, start: `${taxYearStart}-04-06`, end: `${taxYearStart + 1}-01-05`, due: `${taxYearStart + 1}-02-07` },
    { quarter: 4, start: `${taxYearStart}-04-06`, end: `${taxYearStart + 1}-04-05`, due: `${taxYearStart + 1}-05-07` }
  ]
}

export function canChangeQuarterlyPeriodType(obligations: any[], submissions: any[], businessId: string, taxYearStart: number) {
  const start = `${taxYearStart}-04-01`
  const end = `${taxYearStart + 1}-04-05`
  const submitted = (submissions || []).some((s: any) => s.business_id === businessId && s.status === 'submitted' && s.period_end >= start && s.period_end <= end)
  const fulfilled = (obligations || []).some((o: any) => (!o.business_id || o.business_id === businessId) && String(o.status || '').toLowerCase() === 'fulfilled' && o.period_end >= start && o.period_end <= end)
  return !submitted && !fulfilled
}
