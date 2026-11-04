import { aggregateRows } from './aggregate';

describe('aggregateRows', () => {
  const rows = [
    { stage: 'Proposal', amount: 100 },
    { stage: 'Proposal', amount: 50 },
    { stage: 'Closed Won', amount: 20 },
  ];

  it('sums a grouped numeric field', () => {
    const result = aggregateRows(rows, { groupBy: 'stage', aggregate: 'sum', aggregateField: 'amount' });
    expect(result.total).toBe(3);
    expect(result.groups.find((group) => group.key === 'Proposal')?.value).toBe(150);
  });

  it('follows an explicit stage order', () => {
    const result = aggregateRows(rows, { groupBy: 'stage', aggregate: 'count' }, ['Closed Won', 'Proposal']);
    expect(result.groups.map((group) => group.key)).toEqual(['Closed Won', 'Proposal']);
  });

  it('counts everything when there is no group', () => {
    expect(aggregateRows(rows, { aggregate: 'count' }).groups).toEqual([{ key: 'All', count: 3, value: 3 }]);
  });
});
