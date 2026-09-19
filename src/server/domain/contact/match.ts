export type MatchableContact = {
  id: string;
  seed_key?: string | null;
  name: string;
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

export function matchContactKeys(keys: string[], contacts: MatchableContact[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of keys) {
    const key = raw.trim();
    if (!key) continue;
    const k = key.toLowerCase();
    const hit = contacts.find((contact) => {
      if (contact.id === key) return true;
      if (contact.seed_key && contact.seed_key.toLowerCase() === k) return true;
      const name = contact.name.trim().toLowerCase();
      if (name === k) return true;
      const first = firstName(contact.name);
      return first.length >= 3 && (k === first || k.startsWith(`${first} `));
    });
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      ids.push(hit.id);
    }
  }
  return ids;
}
