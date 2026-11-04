export function suggestMapping(
  headers: string[],
  fields: { name: string; label?: string }[],
): Record<string, string> {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = norm(header || '');
    if (!normalized) continue;
    const match = fields.find((field) => {
      const names = [field.name, field.label || ''].map(norm).filter(Boolean);
      return names.some((name) => name === normalized || name.includes(normalized) || normalized.includes(name));
    });
    if (match) mapping[header] = match.name;
  }
  return mapping;
}

export function applyMapping(row: Record<string, any>, mapping: Record<string, string>) {
  const out: Record<string, any> = {};
  for (const [header, field] of Object.entries(mapping || {})) {
    if (!field) continue;
    if (row[header] === undefined) continue;
    out[field] = row[header];
  }
  return out;
}
