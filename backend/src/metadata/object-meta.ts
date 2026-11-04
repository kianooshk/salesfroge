export interface FieldDef {
  name: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'currency'
    | 'date'
    | 'datetime'
    | 'picklist'
    | 'email'
    | 'phone'
    | 'url'
    | 'lookup';
  required?: boolean;
  options?: string[];
  lookup?: 'user' | 'account' | 'contact';
}

export interface ObjectConfig {
  key: string;
  objectType: string;
  model: string;
  label: string;
  plural: string;
  icon: string;
  fields: FieldDef[];
  columns: { name: string; label: string }[];
  highlights: string[];
  searchFields: string[];
  allowed: string[];
  quickFilters?: string[];
  allowRelatedFilter?: boolean;
  baseWhere?: Record<string, any>;
  listInclude?: Record<string, any>;
  detailInclude?: Record<string, any>;
  pathField?: string;
  path?: string[];
  title?: (row: any) => string;
  beforeSave?: (data: any, existing: any | null) => void;
  relatedLists?: { key: string; label: string; object: string }[];
}

export const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Manufacturing',
  'Retail',
  'Education',
  'Media',
  'Other',
];

export const LEAD_SOURCES = ['Web', 'Phone', 'Partner', 'Referral', 'Trade Show', 'Other'];

export const OPPORTUNITY_STAGES = [
  { name: 'Prospecting', probability: 10 },
  { name: 'Qualification', probability: 20 },
  { name: 'Needs Analysis', probability: 35 },
  { name: 'Proposal', probability: 60 },
  { name: 'Negotiation', probability: 80 },
  { name: 'Closed Won', probability: 100 },
  { name: 'Closed Lost', probability: 0 },
];

export const LEAD_STATUSES = ['New', 'Working', 'Nurturing', 'Qualified', 'Unqualified'];
export const CASE_STATUSES = ['New', 'Working', 'Escalated', 'Closed'];

const ownerSelect = {
  select: { id: true, firstName: true, lastName: true, email: true, avatarColor: true },
};
const ownerInclude = { owner: ownerSelect };

function allowedFrom(fields: FieldDef[]) {
  return [...fields.map((field) => field.name), 'customFields'];
}

function personTitle(row: any) {
  return `${row.firstName || ''} ${row.lastName || ''}`.trim();
}

function applyStageProbability(data: any) {
  if (data.stage && (data.probability === undefined || data.probability === null)) {
    const stage = OPPORTUNITY_STAGES.find((item) => item.name === data.stage);
    if (stage) data.probability = stage.probability;
  }
}

function applyCaseClose(data: any, existing: any | null) {
  if (data.status === 'Closed' && !data.closedAt && !existing?.closedAt) data.closedAt = new Date();
  if (data.status && data.status !== 'Closed') data.closedAt = null;
}

const address = (prefix: string, labels: string[]): FieldDef[] => [
  { name: prefix === 'mailing' ? 'mailingStreet' : prefix === 'billing' ? 'billingStreet' : 'street', label: labels[0], type: 'text' },
  { name: prefix === 'mailing' ? 'mailingCity' : prefix === 'billing' ? 'billingCity' : 'city', label: labels[1], type: 'text' },
  { name: prefix === 'mailing' ? 'mailingState' : prefix === 'billing' ? 'billingState' : 'state', label: labels[2], type: 'text' },
  { name: prefix === 'mailing' ? 'mailingPostal' : prefix === 'billing' ? 'billingPostal' : 'postalCode', label: labels[3], type: 'text' },
  { name: prefix === 'mailing' ? 'mailingCountry' : prefix === 'billing' ? 'billingCountry' : 'country', label: labels[4], type: 'text' },
];

const leadFields: FieldDef[] = [
  { name: 'firstName', label: 'First Name', type: 'text', required: true },
  { name: 'lastName', label: 'Last Name', type: 'text', required: true },
  { name: 'company', label: 'Company', type: 'text', required: true },
  { name: 'title', label: 'Title', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'phone' },
  { name: 'website', label: 'Website', type: 'url' },
  { name: 'status', label: 'Status', type: 'picklist', options: LEAD_STATUSES, required: true },
  { name: 'rating', label: 'Rating', type: 'picklist', options: ['Hot', 'Warm', 'Cold'] },
  { name: 'source', label: 'Lead Source', type: 'picklist', options: LEAD_SOURCES },
  { name: 'industry', label: 'Industry', type: 'picklist', options: INDUSTRIES },
  ...address('street', ['Street', 'City', 'State', 'Postal Code', 'Country']),
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'ownerId', label: 'Owner', type: 'lookup', lookup: 'user', required: true },
];

const accountFields: FieldDef[] = [
  { name: 'name', label: 'Account Name', type: 'text', required: true },
  { name: 'type', label: 'Type', type: 'picklist', options: ['Prospect', 'Customer', 'Partner', 'Other'] },
  { name: 'industry', label: 'Industry', type: 'picklist', options: INDUSTRIES },
  { name: 'website', label: 'Website', type: 'url' },
  { name: 'phone', label: 'Phone', type: 'phone' },
  ...address('billing', ['Billing Street', 'Billing City', 'Billing State', 'Billing Postal', 'Billing Country']),
  { name: 'employees', label: 'Employees', type: 'number' },
  { name: 'annualRevenue', label: 'Annual Revenue', type: 'currency' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'ownerId', label: 'Owner', type: 'lookup', lookup: 'user', required: true },
];

const contactFields: FieldDef[] = [
  { name: 'firstName', label: 'First Name', type: 'text', required: true },
  { name: 'lastName', label: 'Last Name', type: 'text', required: true },
  { name: 'title', label: 'Title', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'phone' },
  { name: 'mobile', label: 'Mobile', type: 'phone' },
  { name: 'department', label: 'Department', type: 'text' },
  { name: 'accountId', label: 'Account', type: 'lookup', lookup: 'account' },
  ...address('mailing', ['Mailing Street', 'Mailing City', 'Mailing State', 'Mailing Postal', 'Mailing Country']),
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'ownerId', label: 'Owner', type: 'lookup', lookup: 'user', required: true },
];

const opportunityFields: FieldDef[] = [
  { name: 'name', label: 'Opportunity Name', type: 'text', required: true },
  { name: 'accountId', label: 'Account', type: 'lookup', lookup: 'account' },
  { name: 'contactId', label: 'Contact', type: 'lookup', lookup: 'contact' },
  { name: 'stage', label: 'Stage', type: 'picklist', options: OPPORTUNITY_STAGES.map((s) => s.name), required: true },
  { name: 'amount', label: 'Amount', type: 'currency' },
  { name: 'closeDate', label: 'Close Date', type: 'date' },
  { name: 'probability', label: 'Probability', type: 'number' },
  { name: 'type', label: 'Type', type: 'picklist', options: ['New Business', 'Existing Business'] },
  { name: 'leadSource', label: 'Lead Source', type: 'picklist', options: LEAD_SOURCES },
  { name: 'nextStep', label: 'Next Step', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'ownerId', label: 'Owner', type: 'lookup', lookup: 'user', required: true },
];

const caseFields: FieldDef[] = [
  { name: 'subject', label: 'Subject', type: 'text', required: true },
  { name: 'status', label: 'Status', type: 'picklist', options: CASE_STATUSES, required: true },
  { name: 'priority', label: 'Priority', type: 'picklist', options: ['Low', 'Medium', 'High'], required: true },
  { name: 'origin', label: 'Origin', type: 'picklist', options: ['Email', 'Phone', 'Web'] },
  { name: 'type', label: 'Type', type: 'picklist', options: ['Question', 'Problem', 'Feature Request'] },
  { name: 'slaDueAt', label: 'SLA Due', type: 'datetime' },
  { name: 'accountId', label: 'Account', type: 'lookup', lookup: 'account' },
  { name: 'contactId', label: 'Contact', type: 'lookup', lookup: 'contact' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'ownerId', label: 'Owner', type: 'lookup', lookup: 'user', required: true },
];

const activityFields: FieldDef[] = [
  { name: 'type', label: 'Type', type: 'picklist', options: ['Task', 'Call', 'Meeting', 'Note'], required: true },
  { name: 'subject', label: 'Subject', type: 'text', required: true },
  { name: 'status', label: 'Status', type: 'picklist', options: ['Open', 'Completed'] },
  { name: 'priority', label: 'Priority', type: 'picklist', options: ['Low', 'Normal', 'High'] },
  { name: 'dueDate', label: 'Due Date', type: 'date' },
  { name: 'startTime', label: 'Start', type: 'datetime' },
  { name: 'endTime', label: 'End', type: 'datetime' },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'relatedType', label: 'Related To Type', type: 'picklist', options: ['Lead', 'Account', 'Contact', 'Opportunity', 'Case'] },
  { name: 'relatedId', label: 'Related To', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'ownerId', label: 'Assigned To', type: 'lookup', lookup: 'user', required: true },
];

export const OBJECTS: ObjectConfig[] = [
  {
    key: 'leads',
    objectType: 'Lead',
    model: 'lead',
    label: 'Lead',
    plural: 'Leads',
    icon: 'lead',
    fields: leadFields,
    allowed: allowedFrom(leadFields),
    columns: [
      { name: 'name', label: 'Name' },
      { name: 'company', label: 'Company' },
      { name: 'status', label: 'Status' },
      { name: 'rating', label: 'Rating' },
      { name: 'email', label: 'Email' },
      { name: 'phone', label: 'Phone' },
      { name: 'source', label: 'Source' },
      { name: 'owner', label: 'Owner' },
    ],
    highlights: ['company', 'title', 'status', 'email', 'phone', 'owner'],
    searchFields: ['firstName', 'lastName', 'company', 'email'],
    quickFilters: ['status', 'rating', 'ownerId'],
    baseWhere: { isConverted: false },
    listInclude: ownerInclude,
    detailInclude: ownerInclude,
    pathField: 'status',
    path: LEAD_STATUSES,
    title: personTitle,
  },
  {
    key: 'accounts',
    objectType: 'Account',
    model: 'account',
    label: 'Account',
    plural: 'Accounts',
    icon: 'account',
    fields: accountFields,
    allowed: allowedFrom(accountFields),
    columns: [
      { name: 'name', label: 'Account Name' },
      { name: 'type', label: 'Type' },
      { name: 'industry', label: 'Industry' },
      { name: 'phone', label: 'Phone' },
      { name: 'website', label: 'Website' },
      { name: 'owner', label: 'Owner' },
    ],
    highlights: ['type', 'industry', 'phone', 'website', 'owner'],
    searchFields: ['name', 'industry', 'website'],
    quickFilters: ['type', 'ownerId'],
    listInclude: { ...ownerInclude, _count: { select: { contacts: true, opportunities: true, cases: true } } },
    detailInclude: {
      ...ownerInclude,
      contacts: { include: ownerInclude, orderBy: { lastName: 'asc' } },
      opportunities: { include: ownerInclude, orderBy: { closeDate: 'asc' } },
      cases: { include: ownerInclude, orderBy: { createdAt: 'desc' } },
    },
    title: (row) => row.name,
    relatedLists: [
      { key: 'contacts', label: 'Contacts', object: 'contacts' },
      { key: 'opportunities', label: 'Opportunities', object: 'opportunities' },
      { key: 'cases', label: 'Cases', object: 'cases' },
    ],
  },
  {
    key: 'contacts',
    objectType: 'Contact',
    model: 'contact',
    label: 'Contact',
    plural: 'Contacts',
    icon: 'contact',
    fields: contactFields,
    allowed: allowedFrom(contactFields),
    columns: [
      { name: 'name', label: 'Name' },
      { name: 'title', label: 'Title' },
      { name: 'account', label: 'Account' },
      { name: 'email', label: 'Email' },
      { name: 'phone', label: 'Phone' },
      { name: 'owner', label: 'Owner' },
    ],
    highlights: ['title', 'account', 'email', 'phone', 'owner'],
    searchFields: ['firstName', 'lastName', 'email', 'title'],
    quickFilters: ['ownerId'],
    listInclude: { ...ownerInclude, account: { select: { id: true, name: true } } },
    detailInclude: {
      ...ownerInclude,
      account: true,
      opportunities: { include: ownerInclude, orderBy: { createdAt: 'desc' } },
      cases: { include: ownerInclude, orderBy: { createdAt: 'desc' } },
    },
    title: personTitle,
    relatedLists: [
      { key: 'opportunities', label: 'Opportunities', object: 'opportunities' },
      { key: 'cases', label: 'Cases', object: 'cases' },
    ],
  },
  {
    key: 'opportunities',
    objectType: 'Opportunity',
    model: 'opportunity',
    label: 'Opportunity',
    plural: 'Opportunities',
    icon: 'opportunity',
    fields: opportunityFields,
    allowed: allowedFrom(opportunityFields),
    columns: [
      { name: 'name', label: 'Opportunity' },
      { name: 'account', label: 'Account' },
      { name: 'stage', label: 'Stage' },
      { name: 'amount', label: 'Amount' },
      { name: 'closeDate', label: 'Close Date' },
      { name: 'probability', label: 'Probability' },
      { name: 'owner', label: 'Owner' },
    ],
    highlights: ['account', 'stage', 'amount', 'closeDate', 'probability', 'owner'],
    searchFields: ['name', 'nextStep'],
    quickFilters: ['stage', 'ownerId'],
    listInclude: {
      ...ownerInclude,
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
    detailInclude: { ...ownerInclude, account: true, contact: true },
    pathField: 'stage',
    path: OPPORTUNITY_STAGES.map((stage) => stage.name),
    title: (row) => row.name,
    beforeSave: applyStageProbability,
  },
  {
    key: 'cases',
    objectType: 'Case',
    model: 'case',
    label: 'Case',
    plural: 'Cases',
    icon: 'case',
    fields: caseFields,
    allowed: [...allowedFrom(caseFields), 'closedAt'],
    columns: [
      { name: 'caseNumber', label: 'Number' },
      { name: 'subject', label: 'Subject' },
      { name: 'status', label: 'Status' },
      { name: 'priority', label: 'Priority' },
      { name: 'origin', label: 'Origin' },
      { name: 'slaDueAt', label: 'SLA Due' },
      { name: 'account', label: 'Account' },
      { name: 'owner', label: 'Owner' },
    ],
    highlights: ['status', 'priority', 'origin', 'slaDueAt', 'account', 'owner'],
    searchFields: ['subject', 'description'],
    quickFilters: ['status', 'priority', 'ownerId'],
    listInclude: { ...ownerInclude, account: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
    detailInclude: { ...ownerInclude, account: true, contact: true },
    pathField: 'status',
    path: CASE_STATUSES,
    title: (row) => row.subject,
    beforeSave: applyCaseClose,
  },
  {
    key: 'activities',
    objectType: 'Activity',
    model: 'activity',
    label: 'Activity',
    plural: 'Activities',
    icon: 'task',
    fields: activityFields,
    allowed: allowedFrom(activityFields),
    columns: [
      { name: 'subject', label: 'Subject' },
      { name: 'type', label: 'Type' },
      { name: 'status', label: 'Status' },
      { name: 'priority', label: 'Priority' },
      { name: 'dueDate', label: 'Due Date' },
      { name: 'startTime', label: 'Start' },
      { name: 'owner', label: 'Assigned To' },
    ],
    highlights: ['type', 'status', 'priority', 'dueDate', 'startTime', 'owner'],
    searchFields: ['subject', 'description', 'location'],
    quickFilters: ['type', 'status', 'ownerId'],
    allowRelatedFilter: true,
    listInclude: ownerInclude,
    detailInclude: ownerInclude,
    title: (row) => row.subject,
  },
];

export const OBJECT_BY_KEY: Record<string, ObjectConfig> = Object.fromEntries(OBJECTS.map((item) => [item.key, item]));
export const OBJECT_BY_API: Record<string, ObjectConfig> = Object.fromEntries(OBJECTS.map((item) => [item.objectType, item]));

export const STANDARD_OBJECTS = ['Lead', 'Account', 'Contact', 'Opportunity', 'Case', 'Activity'];

export function serializeObject(config: ObjectConfig, customFields: any[] = []) {
  return {
    key: config.key,
    objectType: config.objectType,
    label: config.label,
    plural: config.plural,
    icon: config.icon,
    endpoint: `/${config.key}`,
    fields: [
      ...config.fields,
      ...customFields.map((field) => ({
        name: field.apiName,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options || undefined,
        custom: true,
      })),
    ],
    columns: config.columns,
    highlights: config.highlights,
    pathField: config.pathField || null,
    path: config.path || null,
    relatedLists: config.relatedLists || [],
    supportsKanban: config.key === 'opportunities',
    supportsConvert: config.key === 'leads',
    stages: config.key === 'opportunities' ? OPPORTUNITY_STAGES : undefined,
  };
}
