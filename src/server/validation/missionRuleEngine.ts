export class RestrictedContactError extends Error {
  constructor() {
    super("Restricted contact mag geen doel van een missie zijn.");
    this.name = "RestrictedContactError";
  }
}

export function assertNoRestrictedTargets(
  contacts: { id: string; restricted: boolean }[],
  targetIds: string[],
) {
  const blocked = new Set(contacts.filter((contact) => contact.restricted).map((contact) => contact.id));
  if (targetIds.some((id) => blocked.has(id))) {
    throw new RestrictedContactError();
  }
}
