import { buildFilterWhere, mergeTemplate, prepareData, recordContext } from './data';

describe('prepareData', () => {
  it('keeps allowed fields and coerces dates, numbers and blanks', () => {
    const data = prepareData(
      {
        name: 'Harbor',
        amount: '180000',
        closeDate: '2026-12-01',
        phone: '',
        ignored: 'nope',
        customFields: '{"region":"West"}',
      },
      ['name', 'amount', 'closeDate', 'phone', 'customFields'],
    );
    expect(data.name).toBe('Harbor');
    expect(data.amount).toBe(180000);
    expect(data.closeDate).toBeInstanceOf(Date);
    expect(data.phone).toBeNull();
    expect(data.ignored).toBeUndefined();
    expect(data.customFields).toEqual({ region: 'West' });
  });
});

describe('buildFilterWhere', () => {
  it('builds safe clauses and drops nested field names', () => {
    const where = buildFilterWhere([
      { field: 'status', op: 'eq', value: 'Open' },
      { field: 'amount', op: 'gte', value: '100' },
      { field: 'name', op: 'contains', value: 'ha' },
      { field: 'owner.email', op: 'eq', value: 'a@b.co' },
    ]);
    expect(where).toEqual({
      AND: [
        { status: 'Open' },
        { amount: { gte: 100 } },
        { name: { contains: 'ha', mode: 'insensitive' } },
      ],
    });
  });
});

describe('mergeTemplate', () => {
  it('fills dotted merge fields', () => {
    const text = mergeTemplate('Hi {{name}} at {{account.name}}', recordContext({ firstName: 'Priya', lastName: 'Shah', account: { name: 'Lumen' } }));
    expect(text).toBe('Hi Priya Shah at Lumen');
  });
});
