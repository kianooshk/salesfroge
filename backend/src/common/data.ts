export interface FilterClause {
  field: string;
  op: string;
  value?: any;
}

const DATE_FIELDS = new Set([
  'closeDate',
  'dueDate',
  'startTime',
  'endTime',
  'slaDueAt',
  'closedAt',
  'convertedAt',
]);

const NUMBER_FIELDS = new Set(['employees', 'annualRevenue', 'amount', 'probability']);

const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

export function prepareData(input: Record<string, any> | null | undefined, allowed: string[]) {
  const out: Record<string, any> = {};
  if (!input) return out;
  for (const key of allowed) {
    if (input[key] === undefined) continue;
    let value = input[key];
    if (value === '') value = null;
    if (key === 'customFields' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        value = {};
      }
    }
    if (value != null && DATE_FIELDS.has(key)) {
      const date = new Date(value);
      value = Number.isNaN(date.getTime()) ? null : date;
    }
    if (value != null && NUMBER_FIELDS.has(key)) {
      const num = typeof value === 'number' ? value : Number(value);
      value = Number.isFinite(num) ? num : null;
    }
    out[key] = value;
  }
  if (out.ownerId == null) delete out.ownerId;
  return out;
}

function coerceCompare(value: any) {
  if (typeof value !== 'string') return value;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

export function buildFilterWhere(filters?: FilterClause[] | null): Record<string, any> {
  if (!filters?.length) return {};
  const AND = filters
    .filter((filter) => filter && filter.field && filter.op && FIELD_NAME.test(filter.field))
    .map((filter) => {
      const field = filter.field;
      switch (filter.op) {
        case 'eq':
          return { [field]: filter.value };
        case 'neq':
          return { [field]: { not: filter.value } };
        case 'contains':
          return { [field]: { contains: String(filter.value ?? ''), mode: 'insensitive' } };
        case 'startsWith':
          return { [field]: { startsWith: String(filter.value ?? ''), mode: 'insensitive' } };
        case 'gt':
          return { [field]: { gt: coerceCompare(filter.value) } };
        case 'gte':
          return { [field]: { gte: coerceCompare(filter.value) } };
        case 'lt':
          return { [field]: { lt: coerceCompare(filter.value) } };
        case 'lte':
          return { [field]: { lte: coerceCompare(filter.value) } };
        case 'in':
          return {
            [field]: {
              in: Array.isArray(filter.value)
                ? filter.value
                : String(filter.value ?? '')
                    .split(',')
                    .map((part) => part.trim())
                    .filter(Boolean),
            },
          };
        case 'empty':
          return { [field]: null };
        case 'notEmpty':
          return { NOT: { [field]: null } };
        default:
          return {};
      }
    })
    .filter((clause) => Object.keys(clause).length > 0);
  if (!AND.length) return {};
  return { AND };
}

export function andWhere(...parts: any[]) {
  const AND = parts.filter((part) => part && typeof part === 'object' && Object.keys(part).length > 0);
  if (!AND.length) return {};
  if (AND.length === 1) return AND[0];
  return { AND };
}

export function mergeTemplate(template: string, context: Record<string, any>) {
  if (!template) return '';
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = path.split('.').reduce((current, key) => (current == null ? current : current[key]), context);
    return value == null ? '' : String(value);
  });
}

export function recordContext(record: any): Record<string, any> {
  if (!record) return {};
  const context: Record<string, any> = { ...record };
  if (record.firstName || record.lastName) {
    context.name = `${record.firstName || ''} ${record.lastName || ''}`.trim();
  } else if (record.name) {
    context.name = record.name;
  } else if (record.subject) {
    context.name = record.subject;
  }
  if (record.owner) context.ownerName = `${record.owner.firstName || ''} ${record.owner.lastName || ''}`.trim();
  if (record.account) context.accountName = record.account.name;
  if (record.contact) {
    context.contactName = `${record.contact.firstName || ''} ${record.contact.lastName || ''}`.trim();
  }
  return context;
}
