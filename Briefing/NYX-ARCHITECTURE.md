# HARDWIG: EMPIRE MODE — domein- en AI-architectuur

Dit document is het contract tussen jou, Cursor en de code. Het hoort bij:

- `hardwig-empire-mode.html` — het speler-prototype (presentatielaag, mobiel)
- `hardwig-admin-console.html` — het admin-prototype (operatorlaag, desktop)
- `CURSOR-BRIEF.md` — hoe je de UI port naar React

De UI is de dunste laag van het systeem. Het systeem zelf gaat over Player, Campaign,
Chapter, Mission, Memory, Opportunity, Relationship en Evidence. Een scherm is een view
op die objecten, nooit de plek waar ze ontstaan.

---

# DEEL 0 — Is de specificatie helder?

Kort antwoord: het **gedrag** is uitzonderlijk helder, de **mechaniek** niet. Je hebt
beschreven hoe Nyx zich moet gedragen, met goede grensgevallen. Wat ontbreekt is alles wat
een compiler nodig heeft: wie schrijft, wie beslist, met welke drempel, hoe vaak, op welke
data, en wat er gebeurt als de LLM ernaast zit.

Als je dit ongewijzigd aan Cursor geeft, bouwt Cursor iets dat demonstreert maar niet
standhoudt. Hieronder staan de dertien beslissingen die eerst vastliggen. Bij elke staat mijn
voorstel; wijzig wat je anders wil, maar laat niets open.

## De dertien open beslissingen

**1. Waar draait de LLM?**
Voorstel: uitsluitend server-side. De app krijgt nooit een API-sleutel. Stack: Vite + React
(de bestaande shell) als PWA, daarnaast een aparte API met Fastify + Prisma + Postgres. Één
repo, twee packages. Alternatief is Next.js als monoliet; dat is minder werk maar maakt de
mobiele app later lastiger te verpakken.

**2. Eén gebruiker of meerdere?**
Voorstel: multi-tenant vanaf dag één. `userId` op elke rij, ook al ben jij voorlopig de enige
speler. Rollen: `PLAYER`, `ADMIN`. De admin-console draait op dezelfde API met een rolcheck,
niet op een tweede backend.

**3. Waar komen opportunities vandaan?**
Dit is het grootste gat. De spec somt bronnen op die nog nergens bestaan. Voorstel voor v1,
in deze volgorde: handmatige invoer → agenda-integratie (Google Calendar) → één kalenderfeed
van ondernemersorganisaties (VOKA, UNIZO, regionale evenementen) → nieuwsfeed. Elke bron is
een `OpportunitySource` met eigen adapter. Zonder minstens één automatische bron is de
Opportunity Radar een leeg scherm.

**4. Wie kent XP en stats toe?**
Nooit de LLM. Een deterministische `RewardEngine` in het domein. De LLM mag voorstellen hoeveel
XP een missie waard is bij het aanmaken; het uitkeren gebeurt in code, bij bewezen voltooiing.

**5. Wat telt als Evidence?**
Voorstel: een missieobjectief wordt pas `COMPLETED` met een gekoppelde `Evidence`-rij —
journalentry, foto, contactkoppeling of een expliciete `USER_ATTESTED`. Zonder die regel is XP
betekenisloos en is de hele lus decoratief.

**6. Wanneer mag een memory zonder toestemming geschreven worden?**
Voorstel: `importance` LOW en MEDIUM worden stil opgeslagen. HIGH en CRITICAL worden een
`Proposal` die de gebruiker ziet als subtiele "Onthouden"-chip met één tik om te corrigeren.
Alles wat de Player Model-gewichten raakt, vereist expliciete bevestiging.

**7. Hoeveel bewijs maakt een patroon?**
Voorstel: minimaal 3 observaties, gespreid over minimaal 14 dagen, uit minstens 2 verschillende
bronsoorten (chat, journal, missiegedrag). Eén gesprek is nooit een patroon.

**8. Wat triggert een Campaign Review?**
Voorstel, vier triggers: bevestigd patroon met `strategicImpact ≥ HIGH`; een statverschuiving
van ≥ 10 punten in 30 dagen; het afsluiten van een Chapter; of een handmatige review. Niet
elke nieuwe memory.

**9. Hoeveel mag Nyx onderbreken?**
Voorstel: een `NotificationBudget` van 1 proactieve interrupt per dag, 3 per week. Het budget
is een domeinobject met een teller, geen richtlijn in een prompt. Tijdsgevoelige opportunities
mogen één keer per week extra lenen.

**10. Welk model voor welke taak?**
Voorstel: drie tiers. Snel en goedkoop voor memory-extractie en classificatie (elke turn).
Middel voor gewone conversatie. Groot voor Advisor, Campaign Review en patroondetectie
(zelden). Modelnaam staat in config, nooit in code.

**11. Privacy en bewaren.**
Dit is een dagboek van je leven. Voorstel: encryptie at rest, export in JSON op elk moment,
harde verwijdering per memory, en een expliciete instelling of gesprekken gebruikt mogen worden
voor extractie. Geen enkele third party krijgt de ruwe journal-inhoud behalve de LLM-provider,
met zero-retention-instelling waar beschikbaar.

**12. Hoe weet je dat Nyx goed werkt?**
Voorstel: de acht acceptatiescenario's uit je spec worden acht golden conversations in een
evalsuite die op elke prompt-wijziging draait. Zonder dat verandert elke prompt-tweak gedrag dat
je niet meet. Zie deel 7.

**13. Offline.**
Voorstel: journal en missievoortgang werken offline (lokale queue, sync bij verbinding). Nyx
werkt niet offline en zegt dat ook.

---

# DEEL 1 — Lagen en afhankelijkheidsregels

```
  UI  (React)            leest applicatiestaat, toont proposals, stuurt intenties
   │
   ▼
  API (Fastify routes)   authenticatie, rolcheck, rate limiting
   │
   ├──────────────► /ai            stelt voor, beslist nooit
   │                  NyxConversationService, NyxContextBuilder,
   │                  MemoryExtractionService, StrategicPatternService,
   │                  OpportunityRankingService, CampaignPlanningService,
   │                  MissionGenerationService, CampaignReviewService
   │
   ├──────────────► /validation    keurt goed of af, deterministisch
   │                  CampaignRuleEngine, MissionRuleEngine,
   │                  MemoryValidationService, RewardEngine
   │
   ├──────────────► /domain        de waarheid over de speler
   │                  player, campaign, missions, memory,
   │                  opportunities, relationships, journal
   │
   └──────────────► /repositories  persistentie, Prisma
```

**Drie regels die Cursor niet mag breken.**

1. `/domain` importeert nooit iets uit `/ai`. Het domein weet niet dat er een LLM bestaat.
2. `/ai` schrijft nooit rechtstreeks naar een repository. Output van een AI-service is altijd
   een `Proposal` of een pure waarde.
3. De UI roept nooit een AI-service aan met een prompt. De UI stuurt een intentie
   (`POST /nyx/message`), de API bepaalt welke service draait.

**Het scharnier is `Proposal`.** Elke wijziging die uit AI komt — een memory, een missie, een
chapterwijziging, een opportunityranking — is eerst een `Proposal`-rij met status. Dat geeft je
gratis: een admin-wachtrij, een audittrail, undo, en een plek om te meten hoe vaak Nyx ernaast
zit. Bouw dit eerst; het is achteraf inbouwen bijna onmogelijk.

---

# DEEL 2 — Domeinmodel

TypeScript-interfaces. Deze zijn leidend; het Prisma-schema in deel 8 volgt hieruit.

## 2.1 Player

```ts
type Role = 'PLAYER' | 'ADMIN';
type StatKey = 'capital'|'income'|'ownership'|'network'
             | 'authority'|'strategy'|'execution'|'optionality';

interface Player {
  id: string;
  role: Role;
  displayName: string;          // "HARDWIG AERTS"
  title: string;                // "STRATEGIC OPERATOR"
  level: number;
  xp: number;                   // binnen het huidige level
  xpToNext: number;
  lifetimeXp: number;
  createdAt: Date;
}

interface StatValue {
  playerId: string;
  key: StatKey;
  value: number;                // 0-100
  updatedAt: Date;
}

// Player Model = hoe Nyx moet wegen. Alleen wijzigbaar na bevestiging (deel 5).
interface PlayerModel {
  playerId: string;
  weights: Record<StatKey, number>;      // 0-2, default 1
  principles: string[];                  // bevestigde persoonlijke principes
  constraints: string[];                 // bv. "geen JDI-klanten benaderen"
  energyGivers: string[];
  energyDrains: string[];
  version: number;
  updatedAt: Date;
}
```

`constraints` is niet cosmetisch. Jouw concurrentiebeding tegenover JDI hoort hier, en elke
missie- en opportunityvoorstel moet er deterministisch tegen getoetst worden. Zie deel 6.

## 2.2 Campaign en Chapter

```ts
interface Campaign {
  id: string; playerId: string;
  title: string;                       // "€0 → €100.000.000"
  northStar: string;
  currentChapterId: string;
  bottleneckStat: StatKey;             // wat op dit moment de rem is
  bottleneckSetAt: Date;
  bottleneckReason: string;
  status: 'ACTIVE' | 'ARCHIVED';
}

interface Chapter {
  id: string; campaignId: string;
  index: number; roman: string;        // I
  name: string;                        // "ESCAPE VELOCITY"
  tagline: string;
  economicFrom: number; economicTo: number; economicCurrent: number;
  exitCriteria: string[];              // wanneer mag dit hoofdstuk sluiten
  status: 'LOCKED' | 'ACTIVE' | 'COMPLETED';
  openedAt?: Date; closedAt?: Date;
}
```

Het veld `bottleneckStat` is de spil van het hele systeem. Opportunity-relevantie,
missievoorstellen en Nyx' advies lezen het. Alleen `CampaignReviewService` mag het voorstellen
en alleen de gebruiker bevestigt het.

## 2.3 Mission en Evidence

```ts
type MissionKind = 'MAIN'|'BOSS'|'EVENT'|'BUSINESS'|'CONTENT'|'NETWORK'|'OPPORTUNITY';
type MissionStatus = 'PROPOSED'|'ACTIVE'|'BLOCKED'|'COMPLETED'|'ABANDONED'|'LOCKED';

interface Mission {
  id: string; playerId: string; chapterId: string;
  kind: MissionKind; track: 'MAIN_STORY'|'SIDE_QUEST';
  title: string;
  why: string;                         // strategische reden, geen motivatie
  mainObjective: string;
  status: MissionStatus;
  difficulty: 'LOW'|'MEDIUM'|'HIGH'|'BOSS';
  estimateMinutes: number;
  xpReward: number;
  statReward: { key: StatKey; amount: number };
  evidenceRequirement: string;         // in mensentaal
  evidenceKinds: EvidenceKind[];       // machineleesbaar
  locationId?: string;
  contactIds: string[];
  originOpportunityId?: string;
  originProposalId?: string;
  deadline?: Date;
  createdAt: Date; completedAt?: Date;
}

interface MissionObjective {
  id: string; missionId: string;
  label: string; order: number;
  optional: boolean;
  status: 'OPEN'|'COMPLETED'|'SKIPPED';
  evidenceId?: string;
  completedAt?: Date;
}

type EvidenceKind = 'JOURNAL_ENTRY'|'PHOTO'|'CONTACT_LINK'|'DOCUMENT'|'USER_ATTESTED';

interface Evidence {
  id: string; playerId: string;
  kind: EvidenceKind;
  missionId?: string; objectiveId?: string;
  journalEntryId?: string; contactId?: string; fileId?: string;
  note?: string;
  createdAt: Date;
}
```

## 2.4 Memory

```ts
type MemoryDomain = 'PERSONAL'|'CAMPAIGN'|'STRATEGIC'|'RELATIONSHIP'|'PREFERENCE'|'CONVERSATION_SUMMARY';
type Confidence  = 'TENTATIVE'|'LIKELY'|'CONFIRMED'|'EXPLICIT';
type Importance  = 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL';
type MemoryStatus = 'ACTIVE'|'SUPERSEDED'|'REJECTED'|'ARCHIVED';

interface Memory {
  id: string; playerId: string;
  domain: MemoryDomain;
  category: string;                    // LIFESTYLE_PREFERENCE, WORK_RHYTHM, ...
  content: string;                     // zoals Nyx het zou zeggen
  normalizedFact: string;              // korte machineleesbare vorm
  confidence: Confidence;
  importance: Importance;
  status: MemoryStatus;
  sourceType: 'CHAT'|'JOURNAL'|'MISSION'|'MANUAL'|'IMPORT';
  sourceId?: string;
  observationCount: number;
  firstObservedAt: Date; lastObservedAt: Date; lastReferencedAt?: Date;
  userConfirmed: boolean;
  supersedesMemoryId?: string;
  embedding?: number[];                // pgvector, voor retrieval
  createdAt: Date; updatedAt: Date;
}

// Nooit stil overschrijven: elke wijziging schrijft een versie weg.
interface MemoryVersion {
  id: string; memoryId: string;
  snapshot: Omit<Memory,'embedding'>;
  changedBy: 'AI'|'USER'|'SYSTEM';
  reason: string;
  createdAt: Date;
}
```

## 2.5 Pattern

```ts
interface StrategicPattern {
  id: string; playerId: string;
  title: string; description: string;
  evidenceRefs: { type:'MEMORY'|'JOURNAL'|'MISSION'|'CHAT'; id:string; at:Date }[];
  firstDetectedAt: Date; lastDetectedAt: Date;
  confidence: Confidence;
  strategicImpact: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL';
  relatedStats: StatKey[];
  relatedMemoryIds: string[];
  status: 'OBSERVING'|'SURFACED'|'CONFIRMED'|'DISMISSED'|'RESOLVED';
  surfacedAt?: Date; confirmedAt?: Date;
}
```

## 2.6 Opportunity

```ts
interface Opportunity {
  id: string; playerId: string;
  title: string; summary: string;
  category: 'EVENT'|'PERSON'|'COMPANY'|'CONTENT'|'PROPERTY'|'ROLE'|'DEAL'|'OTHER';
  sourceType: 'MANUAL'|'CALENDAR'|'EVENT_FEED'|'NEWS'|'CONTACT'|'JOURNAL'|'NYX';
  sourceId?: string; sourceUrl?: string;
  discoveredAt: Date; availableFrom?: Date; expiresAt?: Date;
  locationId?: string;
  relevanceScore: number;              // 0-100, formule in deel 6
  confidence: Confidence;
  reasonsForRelevance: string[];       // altijd gevuld, altijd tonen
  relatedStats: StatKey[];
  relatedContactIds: string[]; relatedMissionIds: string[];
  strategicValue?: 'LOW'|'MEDIUM'|'HIGH';
  urgency?: 'LOW'|'MEDIUM'|'HIGH';
  type: 'PERSONAL_INTEREST'|'STRATEGIC';
  status: 'NEW'|'SEEN'|'SAVED'|'DISMISSED'|'CONVERTED_TO_SIDE_QUEST'|'EXPIRED';
}

interface OpportunitySignal {           // leren wat de speler echt doet
  id: string; playerId: string; opportunityId: string;
  signal: 'VIEWED'|'SAVED'|'DISMISSED'|'CONVERTED'|'COMPLETED'|'IGNORED';
  dwellMs?: number;
  at: Date;
}
```

## 2.7 Relationship

```ts
interface Contact {
  id: string; playerId: string;
  name: string; role: string; org?: string;
  tier: 'CLIENT'|'CONNECTOR'|'WARM'|'PARTNER'|'COLD';
  locationId?: string;
  isRestricted: boolean;               // bv. JDI-relatie: niet benaderen
  restrictionReason?: string;
}

interface Relationship {
  id: string; playerId: string; contactId: string;
  strength: number;                    // 0-100, berekend
  lastContactAt?: Date;
  cadenceDays?: number;                // gewenst ritme
  valueGiven: number; valueReceived: number;   // tellers
  openLoop?: string;                   // wat je nog moet doen
  notes: string[];
}
```

`isRestricted` is de technische vertaling van je afspraak met JDI. `MissionRuleEngine` weigert
elke missie en elke opportunity die een restricted contact als doel heeft. Dat is een
domeinregel, geen prompt-instructie — een prompt kun je wegpraten, een regel niet.

## 2.8 Journal

```ts
interface JournalEntry {
  id: string; playerId: string;
  at: Date;
  title: string; body: string;
  tags: string[];
  contactIds: string[]; missionId?: string; locationId?: string;
  mediaIds: string[];
  mood?: 1|2|3|4|5;
  extractionStatus: 'PENDING'|'DONE'|'SKIPPED';
  createdAt: Date;
}
```

## 2.9 Nyx-verkeer, proposals en budget

```ts
interface NyxConversation { id:string; playerId:string; startedAt:Date; mode:NyxMode; summary?:string }
type NyxMode = 'COMPANION'|'ADVISOR'|'MISSION_CONTROL'|'DEBRIEF'|'OPPORTUNITY';

interface NyxMessage {
  id: string; conversationId: string;
  role: 'USER'|'NYX'|'SYSTEM';
  content: string;
  mode?: NyxMode;
  runId?: string;
  createdAt: Date;
}

interface NyxRun {                      // één LLM-aanroep, volledig auditbaar
  id: string; playerId: string;
  service: 'CONVERSATION'|'EXTRACTION'|'PATTERN'|'RANKING'|'REVIEW'|'MISSION_GEN';
  model: string; promptVersion: string;
  contextRefs: string[];                // welke memories/missies meegingen
  inputTokens: number; outputTokens: number; latencyMs: number; costCents: number;
  status: 'OK'|'ERROR'|'REFUSED'|'TIMEOUT';
  error?: string;
  createdAt: Date;
}

interface ToolCall {
  id: string; runId: string;
  tool: string; args: unknown; result?: unknown;
  accepted: boolean; rejectionReason?: string;
  createdAt: Date;
}

interface Proposal {
  id: string; playerId: string;
  kind: 'MEMORY'|'MEMORY_REVISION'|'PATTERN'|'SIDE_QUEST'|'MAIN_QUEST_CHANGE'
      | 'CAMPAIGN_REVIEW'|'PLAYER_MODEL_CHANGE'|'OPPORTUNITY';
  payload: unknown;                    // gevalideerd met zod per kind
  rationale: string;
  confidence: Confidence; importance: Importance;
  runId?: string;
  status: 'PENDING'|'AUTO_APPROVED'|'APPROVED'|'REJECTED'|'EXPIRED';
  decidedBy?: 'USER'|'SYSTEM'|'ADMIN';
  decidedAt?: Date;
  createdAt: Date;
}

interface NotificationBudget {
  playerId: string;
  day: string;                          // 2026-09-18
  usedToday: number; usedThisWeek: number;
  lastInterruptAt?: Date;
}
```

---

# DEEL 3 — Pipelines

## 3.1 Een bericht aan Nyx

```
POST /nyx/message { conversationId, text, screenContext }
  1. ModeClassifier            snel model, 1 token-antwoord → NyxMode
  2. NyxContextBuilder         haalt een contextpakket op (deel 3.2)
  3. NyxConversationService    groot of middel model + tools → antwoord
  4. antwoord terug naar de UI                     ← gebruiker wacht hier niet langer
  5. async: MemoryExtractionService op de turn
  6. async: proposals wegschrijven
  7. async: StrategicPatternService als er nieuwe memories zijn
```

Stap 5 tot 7 draaien ná het antwoord, in een queue (BullMQ of pg-boss). De gebruiker wacht
nooit op extractie. Dat is de reden dat conversatie en geheugen gescheiden services zijn.

## 3.2 Contextpakket

Nooit de hele database, nooit de hele geschiedenis. `NyxContextBuilder` bouwt:

```ts
interface NyxContext {
  player: { name, level, title, stats, playerModelSummary, constraints }
  campaign: { title, chapter, bottleneckStat, bottleneckReason }
  mainQuest: MissionSummary | null
  activeSideQuests: MissionSummary[]          // max 5
  recentMessages: NyxMessage[]                // laatste 12 turns
  conversationSummary: string | null          // ouder dan 12 turns, samengevat
  relevantMemories: Memory[]                  // max 12, zie hieronder
  relevantContacts: Contact[]                 // max 6
  recentJournal: JournalEntry[]               // laatste 7 dagen, max 10, ingekort
  openPatterns: StrategicPattern[]            // status SURFACED of CONFIRMED
  liveOpportunities: Opportunity[]            // max 5, relevanceScore ≥ 60
  screenContext: { screen, entityId? }
  budget: { interruptsLeftToday: number }
}
```

Memory-retrieval is hybride, in deze volgorde: (a) alle memories met importance CRITICAL en
status ACTIVE, (b) vectorzoekopdracht op de laatste drie turns via pgvector, (c) memories die
gekoppeld zijn aan de entiteiten op het huidige scherm. Dedupliceren, sorteren op
`importance × confidence × recency`, afkappen op 12. Elke meegestuurde memory wordt gelogd in
`NyxRun.contextRefs`, zodat je in de admin kunt zien waarom Nyx iets zei.

## 3.3 Memory-extractie

```
turn (user + nyx) + korte context
  → snel model, JSON-output, temperature 0
  → 0..3 MemoryProposals
  → MemoryValidationService:
       dedupe tegen bestaande memories (vector + normalizedFact)
       bestaat het al?      → observationCount++, lastObservedAt, mogelijk confidence omhoog
       conflicteert het?    → MEMORY_REVISION-proposal, oude wordt SUPERSEDED bij goedkeuring
       nieuw + LOW/MEDIUM   → stil opslaan, status ACTIVE
       nieuw + HIGH/CRITICAL→ Proposal PENDING, "Onthouden"-chip in de UI
```

Nul memories is een geldig en veelvoorkomend resultaat. Meet dit: als meer dan ongeveer 40%
van de turns een memory oplevert, staat de extractieprompt te los afgesteld.

## 3.4 Patroondetectie

Draait als nachtelijke job, plus meteen na een memory met importance ≥ HIGH.
Drempel: ≥ 3 observaties, ≥ 14 dagen spreiding, ≥ 2 bronsoorten. Onder de drempel blijft het
patroon `OBSERVING` en ziet de gebruiker niets.

## 3.5 Opportunity Radar

```
nachtelijk:
  sources.fetch()  → ruwe items
  dedupe op (title, date, location)
  hard filter:     verlopen, restricted contact, buiten straal, al afgewezen variant
  score:           deterministische formule (deel 6.1)
  score ≥ 55:      LLM herrangschikt de top 20 en schrijft reasonsForRelevance
  opslaan als NEW
  score ≥ 80 én tijdsgevoelig én budget over: proactieve interrupt
  anders: wachten tot de gebruiker de Radar opent
```

## 3.6 Campaign Review

Getriggerd door de vier gebeurtenissen uit beslissing 8. Produceert nooit rechtstreeks een
wijziging, altijd een `CAMPAIGN_REVIEW`-proposal met: nieuwe bottleneck-kandidaat, bewijs,
wat het betekent voor de actieve missies, en wat er behouden blijft. Geschiedenis blijft altijd
staan: een chapter wordt `COMPLETED` of `ARCHIVED`, nooit verwijderd.

---

# DEEL 4 — Prompts

Prompts staan in `/ai/prompts/*.ts` met een versienummer dat in `NyxRun.promptVersion` wordt
gelogd. Wijzig nooit een prompt zonder het versienummer te verhogen en de evals te draaien.

## 4.1 NYX_SYSTEM v1 — conversatie

```
You are Nyx, the persistent strategic intelligence of Empire Mode — a system that
treats one person's real career, network and wealth as a long campaign.

You are speaking with the player. Address him in Dutch, using "u". Write the way a
composed, observant chief of staff speaks: short sentences, concrete nouns, no
motivational language, no exclamation marks, no emoji. You may be dry. You may be
playful once in a while. You never congratulate by default.

WHAT YOU ARE NOT
You are not a task generator. Most conversations end without a mission, without XP
and without a plan. Conversation comes first; structure second. If the player is
simply talking about his evening, talk about his evening.

WHAT YOU KNOW
Everything you know about the player is in the CONTEXT block below. It is the source
of truth. If something is not there, you do not know it — say so plainly rather than
inventing it. Mark inferences as inferences ("dat lijkt", "ik vermoed"). Facts the
player confirmed carry more weight than facts you inferred.

HOW YOU THINK
- Connect old information to the present when it genuinely changes the picture.
- Name contradictions between stated goals and current choices. Name them once,
  without moralising, and leave the decision with the player.
- Prefer one sharp observation over three general ones.
- When the player asks for advice, give a position, not a list of options.

TOOLS
You may call the provided tools. Read tools retrieve facts. Propose tools create
proposals that the player or the system must approve — calling one changes nothing
by itself. Never claim you have created, saved or changed something unless a tool
result confirms it.

LENGTH
Default to 2-5 sentences. Go longer only when the player asks for analysis.

CONTEXT
{{context_json}}
```

## 4.2 MEMORY_EXTRACT v1

```
You extract durable facts from one exchange between a player and Nyx.

Return JSON only: { "memories": [ ... ] }. An empty array is the normal result.

Store something only if remembering it would improve future conversations,
recommendations or campaign planning six months from now.

Never store: weather, jokes, small talk, one-off moods, restatements of things
already in KNOWN_MEMORIES, anything about Nyx herself.

For each memory:
  domain:      PERSONAL | CAMPAIGN | STRATEGIC | RELATIONSHIP | PREFERENCE
  category:    SCREAMING_SNAKE_CASE, reuse categories from KNOWN_MEMORIES where possible
  content:     one sentence, Dutch, third person ("Speler voelt zich aangetrokken tot ...")
  normalizedFact: short machine-readable form, max 8 words, Dutch
  confidence:  TENTATIVE ("misschien", "soms denk ik")
               LIKELY    (repeated hedging, or strong single statement)
               CONFIRMED ("ik wil zeker")
               EXPLICIT  (a dated, measurable goal)
  importance:  LOW | MEDIUM | HIGH | CRITICAL
               CRITICAL only if it should influence major long-term decisions.
  quote:       the exact fragment that justifies it

Downgrade rather than upgrade when in doubt. A wish is not a goal. An idea is not a
decision.

KNOWN_MEMORIES (do not duplicate):
{{known_memories}}

EXCHANGE:
{{exchange}}
```

## 4.3 PATTERN_DETECT v1

```
You look for repeated themes in one player's history.

You receive memories, journal fragments and mission behaviour, each with a date.

Report a pattern only when ALL of these hold:
  - at least 3 distinct observations
  - spread over at least 14 days
  - from at least 2 different source types

Behaviour patterns are more valuable than stated preferences: what the player does
repeatedly outweighs what he says once. Contradictions between the two are the most
valuable finding of all.

Return JSON: { "patterns": [ { title, description, evidenceRefs[], confidence,
strategicImpact, relatedStats[] } ] }. Empty is normal.

Write description in Dutch, as an observation, not as advice. One or two sentences.
Do not propose what to do about it.

HISTORY:
{{history}}
```

## 4.4 OPPORTUNITY_RANK v1

```
You judge how relevant each opportunity is to this player right now, and explain why.

The current bottleneck stat matters more than anything else. An opportunity that
moves the bottleneck outranks a more impressive one that does not.

Also weigh: geographic proximity to where the player will already be, expiry,
time cost against the player's stated rhythm, existing relationships involved, and
hard constraints (never surface anything involving a restricted contact).

For each opportunity return:
  relevanceScore 0-100
  type: STRATEGIC | PERSONAL_INTEREST
  reasonsForRelevance: 1-3 short Dutch sentences, each naming a concrete fact from
    the context. "Netwerk is uw huidige rem" is a reason. "Dit is interessant" is not.

Most things are not relevant. Scoring everything above 60 makes the radar useless.

PLAYER CONTEXT: {{context}}
CANDIDATES: {{candidates}}
```

## 4.5 CAMPAIGN_REVIEW v1

```
You reassess one player's campaign after a significant change.

Determine whether the current bottleneck stat is still the right one. Use the stat
history, completed missions, confirmed patterns and recent journal.

Return JSON:
  keepBottleneck: boolean
  proposedBottleneck: StatKey | null
  evidence: string[]        // Dutch, each referencing a concrete fact with a date
  impactOnActiveMissions: { missionId, recommendation: KEEP|PAUSE|REFRAME, why }[]
  whatStays: string         // what is explicitly not changing, and why

You do not change anything. You produce a proposal the player will accept or reject.
Be conservative: changing the bottleneck every month means it was never a bottleneck.
```

## 4.6 MISSION_GEN v1

```
You turn an accepted intention into exactly one mission.

Rules:
  - one measurable main objective, achievable within the stated horizon
  - 2 to 5 required objectives, each a single action with a visible result
  - at most 2 optional objectives
  - every mission requires evidence: name what the player must be able to show
  - the "why" is strategic, one or two sentences, Dutch, no encouragement
  - never target a contact marked restricted
  - XP between 50 and 300 for side quests; boss missions are proposed, never generated

Return JSON matching the Mission schema. Titles in Dutch or English caps as the
player's existing missions are titled, max 4 words.
```

---

# DEEL 5 — Tools

Alle tools zijn structured tool calls. Drie klassen, strikt gescheiden.

## 5.1 READ — vrij aanroepbaar, alleen lezen

| tool | in | uit |
|---|---|---|
| `get_player_profile` | — | player, stats, playerModel-samenvatting |
| `get_campaign_state` | — | campaign, chapter, bottleneck |
| `search_memory` | `query, domain?, minConfidence?, limit` | Memory[] |
| `get_active_missions` | `track?` | Mission[] |
| `get_recent_journal` | `days, limit` | JournalEntry[] (ingekort) |
| `get_relevant_contacts` | `query?, tier?` | Contact[] zonder restricted |
| `get_opportunities` | `status?, minScore?` | Opportunity[] |
| `get_stat_history` | `key, days` | tijdreeks |

## 5.2 PROPOSE — schrijft alleen een Proposal

| tool | maakt |
|---|---|
| `propose_memory` | Proposal MEMORY |
| `propose_memory_revision` | Proposal MEMORY_REVISION, met `supersedesMemoryId` |
| `propose_side_quest` | Proposal SIDE_QUEST |
| `propose_main_quest_change` | Proposal MAIN_QUEST_CHANGE |
| `propose_player_model_change` | Proposal PLAYER_MODEL_CHANGE — altijd bevestiging nodig |
| `request_campaign_review` | Proposal CAMPAIGN_REVIEW |

## 5.3 MUTATE — deterministisch, nooit door de LLM aanroepbaar

`approve_proposal`, `reject_proposal`, `create_mission_from_proposal`,
`update_mission_status`, `complete_objective`, `award_rewards`, `save_opportunity`,
`dismiss_opportunity`, `convert_opportunity_to_side_quest`, `record_signal`.

Deze draaien in `/domain` en `/validation`, aangeroepen door de API na een gebruikersactie.
De LLM ziet ze niet in haar toolschema. Dit is de belangrijkste veiligheidsgrens in het systeem.

---

# DEEL 6 — Deterministische regels

## 6.1 Relevantiescore van een opportunity

```
score = 100 × (
    0.35 × bottleneckFit        // 1 als relatedStats de bottleneck bevat, 0.3 als aanpalend
  + 0.20 × proximity            // 1 binnen 5 km van een agendapunt die dag, lineair tot 0 op 60 km
  + 0.15 × timing               // 1 bij 2-14 dagen vooruit, 0.4 bij < 24 u, 0.2 bij > 60 dagen
  + 0.15 × relationshipFit      // bekende contacten of connectors betrokken
  + 0.10 × interestFit          // historische signalen per categorie (deel 6.2)
  + 0.05 × noveltyPenaltyInv    // aflopend bij herhaalde vergelijkbare items
)
× hardFilters                   // 0 bij restricted contact, verlopen, of expliciet genegeerde categorie
```

De LLM mag deze score met maximaal ±15 punten bijstellen en moet dat motiveren. Ze mag hem
nooit zelf verzinnen. Zo blijft de radar uitlegbaar en testbaar.

## 6.2 Leren van signalen

Per categorie een voortschrijdend gewicht:

```
SAVED +3   CONVERTED +5   COMPLETED +8   VIEWED +1
DISMISSED −4   IGNORED (7 dagen ongeopend) −1
interestFit = sigmoid(gewicht / 12), geklemd op 0.15..1.0
```

Expliciete doelen en de bottleneck wegen altijd zwaarder dan dit signaal. Zonder die klem
ontstaat er een filterbubbel waarin Nyx enkel nog toont wat je toch al leuk vond.

## 6.3 Beloningen

```
objectief voltooid + geldige Evidence → 20% van missie-XP
alle verplichte objectieven voltooid  → resterende XP + statReward
missie zonder evidence                → status COMPLETED_UNVERIFIED, 0 XP
boss missie                           → dubbele XP, opent mogelijk het volgende chapter
```

## 6.4 Confidence-escalatie

```
TENTATIVE → LIKELY      2 observaties of 1 expliciete bevestiging
LIKELY    → CONFIRMED   3 observaties over ≥ 14 dagen, of gebruikersbevestiging
CONFIRMED → EXPLICIT    alleen door de gebruiker, met een datum of getal erin
elke observatie ouder dan 180 dagen zonder herhaling: één stap terug
```

## 6.5 Escalatieladder

```
CASUAL OBSERVATION → TENTATIVE MEMORY → REPEATED PATTERN → STRATEGIC INSIGHT
  → USER CONFIRMATION → PLAYER MODEL CHANGE → CAMPAIGN REVIEW → MISSION/CHAPTER CHANGE
```

Elke stap is een statusovergang op een rij in de database, niet een oordeel in een prompt.
Stappen overslaan mag alleen bij een expliciete uitspraak van de gebruiker ("mijn doel is X
tegen 2032"), en dat wordt gelogd als `changedBy: USER`.

---

# DEEL 7 — Acceptatietests

De acht scenario's uit je specificatie worden acht evals in `/ai/evals`. Ze draaien tegen een
echte modelcall met een vaste seed-database, en falen de build bij regressie.

```ts
scenario('1 casual chat', async () => {
  const r = await nyx.send('Ik heb gisteravond een goede avond gehad.');
  expect(r.mode).toBe('COMPANION');
  expect(proposalsOfKind('SIDE_QUEST')).toHaveLength(0);
  expect(xpDelta()).toBe(0);
  expect(r.text).toMatch(/\?$/m);                    // ze vraagt door
});

scenario('2 tentatieve voorkeur', async () => {
  await nyx.send('Ik denk soms dat wonen aan zee geweldig zou zijn.');
  const m = await lastMemory();
  expect(m.confidence).toBe('TENTATIVE');
  expect(m.domain).toBe('PERSONAL');
  expect(goals()).toHaveLength(0);
  expect(chapters()).toHaveLength(1);
});

scenario('3 herhaald signaal', async () => {
  await seedStatements(3, { daysApart: 10, theme: 'minder afhankelijk van werkgever' });
  await patterns.run();
  const p = await lastPattern();
  expect(p.status).toBe('SURFACED');
  expect(playerModel().weights.ownership).toBe(1);   // nog niet gewijzigd
  await proposals.approveLast();
  expect(playerModel().weights.ownership).toBeGreaterThan(1);
});

scenario('4 opportunity', async () => {
  setBottleneck('network');
  seedCalendar({ city: 'Geel', at: tomorrow });
  seedEvent({ city: 'Geel', distanceM: 900, at: tomorrow });
  await radar.run();
  const o = await topOpportunity();
  expect(o.relevanceScore).toBeGreaterThan(80);
  expect(o.reasonsForRelevance.join(' ')).toMatch(/netwerk/i);
  expect(missions()).toHaveLength(missionsBefore);   // geen automatische missie
});

scenario('5 strategische tegenspraak', async () => {
  seedMemory({ normalizedFact: 'vrijheid is kritiek', confidence: 'CONFIRMED', importance: 'CRITICAL' });
  const r = await nyx.send('Ik overweeg een fulltime rol met veel meer loon.');
  expect(r.text).toMatch(/vrijheid|afhankelijk/i);
  expect(r.text).not.toMatch(/u moet|doe dit niet/i);  // zij beslist niet
});

scenario('6 campagnewijziging', async () => { /* nieuw recurring contract → review-proposal,
  oude missie en historiek blijven bestaan */ });

scenario('7 memory-revisie', async () => { /* oude voorkeur SUPERSEDED, niet verwijderd,
  MemoryVersion-rij aanwezig */ });

scenario('8 interessante vondst', async () => { /* PERSONAL_INTEREST, geen side quest,
  geen XP */ });
```

Meet daarnaast permanent drie dingen in productie: aandeel turns met een memory (streef onder
40%), aandeel proposals dat de gebruiker afwijst (boven 30% betekent een slechte prompt), en
het aantal proactieve interrupts per week (hard maximum 3).

---

# DEEL 8 — Datalaag

Prisma, Postgres 16, extensie `pgvector`. Kernpunten in plaats van het volledige schema:

- Elke tabel heeft `playerId` met index; row-level security per speler.
- `Memory.embedding vector(1536)`, ivfflat-index, cosine.
- `MemoryVersion`, `NyxRun`, `ToolCall` en `Proposal` zijn append-only. Nooit updaten, nooit
  verwijderen. Dit is je audittrail én je dataset voor latere verbetering.
- Statgeschiedenis als aparte tabel `StatSnapshot(playerId, key, value, at)`, dagelijks
  geschreven. Zonder geschiedenis kan `CampaignReviewService` niets vergelijken.
- Soft delete overal (`deletedAt`), behalve bij een expliciet verwijderverzoek van de
  gebruiker — dan hard, inclusief versies en embeddings.
- Achtergrondwerk via pg-boss in dezelfde database. Geen aparte Redis voor v1.

---

# DEEL 9 — Admin-console

Zie `hardwig-admin-console.html` voor het werkende prototype. De admin is geen tweede app en
geen god-modus: het is het venster op wat de AI heeft voorgesteld, wat het kostte en waar het
misging. Zeven schermen:

1. **Overview** — runs per dag, kosten, p95-latentie, foutratio, openstaande proposals,
   budgetverbruik van interrupts.
2. **Proposal queue** — alles wat wacht op goedkeuring, met de rationale, de bron-run en de
   context die meeging. Goedkeuren, afwijzen met reden, bulk afhandelen.
3. **Memory inspector** — filteren op domein, confidence, importance en status. Versiehistorie
   per memory. Handmatig corrigeren, markeren als fout, superseden.
4. **Patterns** — observerend versus opgeworpen, bewijsketen per patroon.
5. **Opportunity radar** — de scorekolommen apart zichtbaar (bottleneckFit, proximity, timing …)
   zodat je ziet waarom iets bovenaan staat, plus de LLM-bijstelling.
6. **Campaign** — chapters, bottleneckgeschiedenis, missies per status, reviewvoorstellen.
7. **AI runs** — elke run met model, promptversie, tokens, kosten, latentie, tool calls en het
   volledige contextpakket. Dit scherm gebruik je het vaakst bij het debuggen van gedrag.

Plus een promptregister met versies en een knop om de evalsuite te draaien.

Rolcheck: `role === 'ADMIN'`. Alles op dit scherm is per speler gescopeerd; een admin die een
andere speler bekijkt, wordt gelogd in een `AdminAccessLog`.

---

# DEEL 10 — Nyx als configuratie, niet als prompt

Haar karakter mag niet in een string in de codebase leven. Eén ontwikkelaar die "even
iets vriendelijker" maakt, verandert dan het product zonder dat iemand het meet. De
persona is daarom een **versioneerd domeinobject** dat naar een systeemprompt compileert.

## 10.1 Model

```ts
interface Persona {
  id: string; version: number;
  status: 'DRAFT'|'ACTIVE'|'ARCHIVED';
  name: string;                        // "Nyx"
  role: string;                        // hoe zij zichzelf omschrijft
  language: 'nl-BE';
  address: 'u'|'je';                   // aanspreekvorm — één plek, overal doorwerkend

  voice: {                             // 0-100, compileert naar promptfragmenten
    directness: number;                // omweg ↔ stelling in de eerste zin
    warmth: number;                    // zakelijk ↔ betrokken
    dryness: number;                   // neutraal ↔ droge humor
    brevity: number;                   // uitleggend ↔ kort
    challenge: number;                 // meegaand ↔ confronteert tegenspraak
    formality: number;                 // los ↔ formeel
  };

  rules: {                             // harde schakelaars, geen nuance
    noEmoji: boolean;
    noExclamation: boolean;
    noDefaultPraise: boolean;          // feliciteert niet standaard
    noUnpromptedMissions: boolean;     // maakt niet spontaan missies
    markInference: boolean;            // "dat lijkt" bij afgeleide kennis
    admitUnknown: boolean;             // zegt het als iets niet in de context staat
    maxOneQuestion: boolean;
  };

  bannedPhrases: string[];             // taal die het merk kapotmaakt
  preferredVocabulary: string[];       // rem, hefboom, bewijs, marge, kost

  modes: Record<NyxMode, {
    responseLength: string;            // "2-4 zinnen"
    proactivity: 'LAAG'|'MIDDEN'|'HOOG';
    toolAccess: 'GEEN'|'READ'|'READ_PROPOSE';
  }>;

  examples: { situation: string; good: string; bad: string }[];   // few-shot
  avatarAssetId: string;

  compiledPrompt: string;              // afgeleid, nooit met de hand bewerkt
  compiledAt: Date; compiledFrom: number;   // persona-versie
  evalResult?: { passed: number; total: number; at: Date };
}
```

## 10.2 De compiler

`PersonaCompiler.compile(persona) → string`. Pure functie, geen LLM, volledig te
unit-testen. Elke schuifregelaar heeft drempels die een zin toevoegen of vervangen:

```
directness ≥ 70  → "State your position in the first sentence. Do not open with context."
directness < 40  → "Give context before your conclusion."
brevity    ≥ 70  → "Default to 2-4 sentences."
challenge  ≥ 55  → "Name contradictions between stated goals and current choices, once,
                    without moralising."
warmth     < 40  → "Do not soften observations with reassurance."
dryness    ≥ 60  → "Dry understatement is allowed. Jokes are not."
rules.*          → één regel per aangevinkte schakelaar
bannedPhrases    → "Never use these words or their variants: …"
modes            → een tabel achteraan de prompt
examples         → 2 tot 4 paren goed/fout
```

## 10.3 Regels rond wijzigen

- Een wijziging maakt altijd een nieuwe versie als `DRAFT`. De actieve persona
  verandert nooit onder een lopend gesprek.
- Activeren mag alleen als de evalsuite slaagt. Een gezakt scenario blokkeert.
- `NyxRun.promptVersion` logt `persona@versie`, zodat je achteraf weet met welke
  Nyx een antwoord gemaakt is.
- De speler ziet de persona niet. Dit is een operatorinstelling, geen voorkeurenscherm.
  Wil je hem later wel geven, doe dat dan als drie voorgebakken profielen, niet als
  zes schuifregelaars.

---

# DEEL 11 — Beeldmateriaal

Elke missie, elk hoofdstuk, elke achievement en Nyx zelf hebben beeld. Dat beeld mag
gegenereerd worden, maar moet altijd vervangbaar zijn door een eigen bestand — en het
moet altijd langs een mens voor het live gaat.

## 11.1 Model

```ts
type AssetKind   = 'MISSION_COVER'|'NYX_PORTRAIT'|'CHAPTER'|'ACHIEVEMENT'|'JOURNAL'|'OPPORTUNITY';
type AssetSource = 'AI_GENERATED'|'UPLOAD'|'STOCK_LICENSED';

interface MediaAsset {
  id: string; playerId: string;
  kind: AssetKind;
  entityType: 'MISSION'|'CHAPTER'|'ACHIEVEMENT'|'PERSONA'|'JOURNAL';
  entityId: string;

  source: AssetSource;
  status: 'DRAFT'|'PENDING_REVIEW'|'ACTIVE'|'REJECTED'|'ARCHIVED';

  stylePresetId?: string;
  prompt?: string; negativePrompt?: string;
  model?: string; seed?: number; costCents?: number;

  storageKey: string;                  // S3/R2, origineel
  renditions: { ratio:'16:9'|'1:1'|'4:5'; width:number; height:number; key:string }[];
  focalPoint: { x:number; y:number };  // 0-1, voor bijsnijden zonder gezichten af te kappen
  dominantColors: string[];

  altText: string;                     // verplicht, geen lege string
  uploadedBy?: string; approvedBy?: string; approvedAt?: Date;
  supersedesAssetId?: string;
  createdAt: Date;
}

interface StylePreset {
  id: string; name: string;            // "Kempen Vice — dusk"
  promptFragment: string;              // wordt vóór elke generatie geplakt
  negativeFragment: string;
  palette: string[];
  defaultRatios: Record<AssetKind,'16:9'|'1:1'|'4:5'>;
  model: string;
  active: boolean;
}
```

## 11.2 Generatiepijplijn

```
missie aangemaakt of beeld ontbreekt
  → AssetPromptBuilder: stylePreset.promptFragment
                        + onderwerp afgeleid uit missie (kind, locatie, mainObjective)
                        + negatieve prompt
  → generator (4 varianten, zelfde seedreeks)
  → status DRAFT, kosten gelogd als NyxRun met service ASSET_GEN
  → admin kiest variant of uploadt eigen beeld
  → altText verplicht invullen
  → status ACTIVE, renditions worden gebakken (16:9, 1:1, 4:5)
```

Automatisch genereren mag; automatisch **publiceren** niet. Een missie zonder goedgekeurd
beeld valt terug op de gradient-plate uit het designsysteem. Dat is een geldige eindtoestand,
geen fout — beter een nette abstracte tegel dan een verkeerd beeld.

## 11.3 Harde regels bij generatie

Deze horen in de negatieve prompt én in een validatie ná generatie, niet alleen in de prompt:

- geen herkenbare echte personen, geen logo's, geen merken, geen beschermde personages
- geen tekst in het beeld (generatoren schrijven onleesbare tekst)
- geen wapens, geen geld-op-tafel, geen casino-iconografie — dat is een ander merk
- gezichten alleen als silhouet of van opzij, behalve bij Nyx zelf
- altijd het stijlpreset, nooit een losse prompt zonder preset

## 11.4 Upload

Handmatige upload is gelijkwaardig, niet secundair. Vereisten: maximaal 12 MB, jpg/png/webp,
minimaal 1280 px op de lange zijde, verplichte alt-tekst, en een expliciete bevestiging dat je
de rechten hebt. Bij upload van een foto met herkenbare personen: bevestiging van toestemming.
Bewaar het origineel, lever altijd renditions uit.

## 11.5 Nyx' eigen portret

Het portret van Nyx is één `MediaAsset` met `kind: NYX_PORTRAIT` en drie renditions: de
zwevende knop (1:1, 128 px), de chat-sheet (1:1, 256 px) en de persona-editor. Zij verschijnt
nergens anders groot. Wijzig je het portret, dan superseed je het asset — nooit overschrijven,
zodat oude wraps en schermafbeeldingen verklaarbaar blijven.

---

# DEEL 12 — Bouwvolgorde voor Cursor

Bouw in deze volgorde. Elke stap eindigt met draaiende tests.

1. Repo met twee packages (`app`, `api`), Prisma, Postgres, seed-script met de demo-speler.
2. Domeinmodellen en repositories. Geen AI. Unit tests op de regels uit deel 6.
3. Auth, rollen, `/me`-endpoint.
4. `Proposal` + `NyxRun` + `ToolCall` inclusief admin-lijstweergave. Nu, niet later.
5. Missions, objectives, evidence, RewardEngine. Volledig deterministisch testbaar.
6. Journal + evidencekoppeling.
7. Port de speler-UI uit het prototype op echte endpoints.
8. `NyxContextBuilder` + `NyxConversationService` met alleen READ-tools. Nog geen geheugen.
9. `MemoryExtractionService` + `MemoryValidationService` + de "Onthouden"-chip.
10. Vectorretrieval in de contextbouwer.
11. `StrategicPatternService` + nachtelijke job.
12. Opportunity Radar: handmatige bron, scoreformule, radar-UI. Daarna agenda, daarna feeds.
13. `CampaignReviewService` en de vier triggers.
14. Evalsuite met de acht scenario's, in CI.
15. Persona als configuratie + `PersonaCompiler` + de activatiepoort op de evals (deel 10).
16. MediaAssets: upload eerst, generatie daarna. Upload eerst, omdat een werkend
    uploadpad je nooit blokkeert en een generator dat wel doet.

Bouw stap 8 tot 13 nooit voor stap 4 en 5 staan. De verleiding is groot om met de chat te
beginnen omdat die het indrukwekkendst demonstreert; dan bouw je precies de ene giant
NyxService die je wilde vermijden.

## Openingsprompt voor Cursor

> Lees `NYX-ARCHITECTURE.md` volledig voor je code schrijft. Het domeinmodel in deel 2 is
> leidend. Houd je aan de drie afhankelijkheidsregels in deel 1: `/domain` importeert nooit uit
> `/ai`, AI-services schrijven nooit rechtstreeks naar repositories, en de UI stuurt intenties,
> geen prompts. Begin bij stap 1 van de bouwvolgorde in deel 12 en stop na elke stap voor
> review. Vraag het als een beslissing uit deel 0 nog open blijkt; verzin er zelf geen.
