const MENTION = /@\[([^\]]*)\]\(([^)\s]+)\)/g;

export function parseMentionIds(body: string | null | undefined): string[] {
  if (!body) return [];
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION.source, 'g');
  while ((match = re.exec(body))) {
    if (match[2]) ids.add(match[2]);
  }
  return Array.from(ids);
}

export function mentionDisplay(body: string | null | undefined): string {
  if (!body) return '';
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}
