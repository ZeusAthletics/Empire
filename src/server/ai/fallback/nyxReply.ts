export type NyxReplyContext = {
  featuredTitle: string;
  network: number;
  economicCurrent: number;
};

export const NYX_GREETING =
  "Goedemorgen. Uw hefboom van vandaag ligt in netwerk, niet in output. Waar wilt u beginnen?";

/** Offline / API-down Nyx. Same I/O as a live Terra reply. Never names a model. */
export function nyxReply(question: string, ctx: NyxReplyContext): string {
  const t = question.toLowerCase();
  if (/vandaag|today|doen/.test(t)) {
    return `Eén ding: objectief 3 van ${ctx.featuredTitle}. Iemand fysiek ontmoeten weegt zwaarder dan drie berichten. Zet het vandaag nog in de agenda.`;
  }
  if (/network|netwerk/.test(t)) {
    return `Network staat op ${ctx.network}, maar uw bereik blijft binnen dezelfde cirkel. U spreekt mensen die u al kent. Connectors — mensen met eigen kringen — ontbreken. Daarom stel ik de missie hieronder voor.`;
  }
  if (/impact|move|hefboom|belangrijk/.test(t)) {
    return "Bel Pieter vandaag en bied aan zijn capaciteitsprobleem uit te tekenen. Waarde vooraf, zonder factuur. Dat is de goedkoopste manier om een connector te maken.";
  }
  if (/geld|omzet|tarief|prijs/.test(t)) {
    return `U zit op €${ctx.economicCurrent.toLocaleString("nl-BE")} van €100K in hoofdstuk I. Op €180/u is dat 196 uur. Sneller gaat enkel via retainers of via een tweede klant op hetzelfde aanbod.`;
  }
  if (/pin|kaart|map/.test(t)) {
    return "Zet een pin op elke plek waar u iemand ontmoet hebt. Na drie maanden ziet u waar uw netwerk echt zit — en waar het gat is.";
  }
  return "Genoteerd. Zet het om in een missie met één meetbaar doel en één bewijsstuk, anders blijft het een intentie.";
}

export function handleCasualUserTurn(
  text: string,
  ctx: NyxReplyContext,
): { reply: string; createdMission: null } {
  return { reply: nyxReply(text, ctx), createdMission: null };
}

export function stripModelNames(text: string): string {
  return text
    .replace(/\bgpt-5\.6-(?:luna|terra|sol)\b/gi, "Nyx")
    .replace(/\b(?:Luna|Terra|Sol|OpenAI)\b/g, "Nyx");
}
