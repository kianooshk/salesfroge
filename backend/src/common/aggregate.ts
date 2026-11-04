export interface AggSpec {
  groupBy?: string | null;
  aggregate?: string | null;
  aggregateField?: string | null;
}

export function reduceValue(rows: any[], aggregate?: string | null, field?: string | null): number {
  const agg = aggregate || 'count';
  if (agg === 'count' || !field) return rows.length;
  const nums = rows.map((row) => Number(row?.[field])).filter((num) => Number.isFinite(num));
  if (!nums.length) return 0;
  if (agg === 'sum') return nums.reduce((total, num) => total + num, 0);
  if (agg === 'avg') return nums.reduce((total, num) => total + num, 0) / nums.length;
  if (agg === 'min') return Math.min(...nums);
  if (agg === 'max') return Math.max(...nums);
  return rows.length;
}

export function groupKey(value: any): string {
  if (value == null || value === '') return '(blank)';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return String(value);
}

export function aggregateRows(rows: any[], spec: AggSpec, order?: string[]) {
  const total = rows.length;
  if (!spec.groupBy) {
    return {
      total,
      groups: [
        {
          key: 'All',
          count: total,
          value: reduceValue(rows, spec.aggregate, spec.aggregateField),
        },
      ],
    };
  }
  const buckets = new Map<string, any[]>();
  for (const row of rows) {
    const key = groupKey(row[spec.groupBy]);
    const list = buckets.get(key) || [];
    list.push(row);
    buckets.set(key, list);
  }
  const groups = Array.from(buckets.entries()).map(([key, items]) => ({
    key,
    count: items.length,
    value: reduceValue(items, spec.aggregate, spec.aggregateField),
  }));
  if (order?.length) {
    groups.sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  } else {
    groups.sort((a, b) => b.value - a.value);
  }
  return { total, groups };
}
