export function person(user?: { firstName?: string; lastName?: string } | null) {
  if (!user) return '';
  return `${user.firstName || ''} ${user.lastName || ''}`.trim();
}

export function money(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

export function compactNumber(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return '0';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value));
}

export function dateFmt(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dateTimeFmt(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDateTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function titleOf(row: any) {
  if (!row) return '';
  if (row.firstName || row.lastName) return `${row.firstName || ''} ${row.lastName || ''}`.trim();
  return row.name || row.subject || (row.caseNumber != null ? `Case ${row.caseNumber}` : 'Record');
}

export function cell(row: any, name: string) {
  if (name === 'name') return titleOf(row);
  if (name === 'owner') return person(row.owner) || '—';
  if (name === 'account') return row.account?.name || '—';
  if (name === 'contact') return person(row.contact) || '—';
  if (name === 'amount' || name === 'annualRevenue' || name === 'budget') return money(row[name]);
  if (name === 'probability') return row.probability != null && row.probability !== '' ? `${row.probability}%` : '—';
  if (name === 'closeDate' || name === 'dueDate' || name === 'customerSince') return dateFmt(row[name]);
  if (name === 'slaDueAt' || name === 'startTime' || name === 'endTime') return dateTimeFmt(row[name]);
  const value = row[name];
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return '—';
  return String(value);
}

export function splitPayload(meta: any, form: Record<string, any>) {
  if (meta.custom) {
    const data: Record<string, any> = {};
    for (const field of meta.fields) {
      if (form[field.name] !== undefined) data[field.name] = form[field.name];
    }
    return data;
  }
  const data: Record<string, any> = {};
  const customFields: Record<string, any> = {};
  for (const field of meta.fields) {
    if (form[field.name] === undefined || form[field.name] === '') continue;
    if (field.custom) customFields[field.name] = form[field.name];
    else data[field.name] = form[field.name];
  }
  if (Object.keys(customFields).length) data.customFields = customFields;
  return data;
}

export function formFromRecord(meta: any, record: any) {
  const form: Record<string, any> = {};
  for (const field of meta.fields || []) {
    const raw = field.custom ? record?.customFields?.[field.name] ?? record?.[field.name] : record?.[field.name];
    if (field.type === 'date') form[field.name] = raw ? toDateInput(raw) : '';
    else if (field.type === 'datetime') form[field.name] = raw ? toDateTimeInput(raw) : '';
    else form[field.name] = raw ?? '';
  }
  return form;
}

export function displayMention(body: string) {
  return (body || '').replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}
