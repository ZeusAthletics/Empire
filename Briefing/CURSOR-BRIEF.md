# HARDWIG: EMPIRE MODE — brief voor Cursor

Bij deze brief hoort `hardwig-empire-mode.html`: één zelfstandig bestand met het werkende
prototype. **Dat bestand is de bron van waarheid** voor uitzicht, gedrag en copy. Deze brief
vertelt hoe je het port naar React + TypeScript + Vite + Tailwind.

Lees eerst het HTML-bestand volledig. Bovenaan staat een kop met de blokken `[A]` tot `[Q]`;
elk blok draagt het bestandspad dat het in de echte app moet krijgen. Port per blok, niet per
scherm — de schermen delen bewust dezelfde primitieven.

---

## 1. Stack

```
Vite + React 18 + TypeScript
Tailwind CSS            tokens uit blok [A] als CSS-variabelen in @layer base
lucide-react            iconen; de paden in blok [C] zijn eigen tekeningen, vervang ze gerust
framer-motion           alleen voor sheets, XP-bar, markerglow en missievoltooiing
zustand + persist       vervangt het handgeschreven store-object uit blok [E]
maplibre-gl of leaflet  vervangt de eigen kaartmotor uit blok [H]
```

Geen extra UI-library. De primitieven zijn klein genoeg om zelf te bezitten.

## 2. Mapping blok → bestand

| blok | inhoud | bestand |
|---|---|---|
| A | design tokens | `src/styles/tokens.css` |
| B | basis- en componentstijlen | `src/styles/global.css` of Tailwind `@layer components` |
| C | datamodellen (staan al als TS-interfaces in commentaar) | `src/types/index.ts` |
| D | demo-data | `src/data/seed.ts` |
| E | state, acties, localStorage | `src/store/useStore.ts` |
| F | `Bar` `Pill` `Tag` `plate` `heroArt` | `src/components/ui/*` |
| G | AppShell, bottom nav, Nyx-FAB, Sheet | `src/components/` |
| H | kaartmotor | `src/features/map/` |
| I–O | de zes schermen | `src/screens/` |
| P | Nyx | `src/features/nyx/` |
| Q | router en de gedelegeerde handler | `src/app/` |

Elke `PascalCase`-functie in het prototype wordt één component met dezelfde naam. De
gedelegeerde `handleAction`-switch in blok `[Q]` wordt gewone `onClick`-props; de `case`-namen
zijn de namen van je handlers.

## 3. Design tokens

```
Night Black     #0B0907     achtergrond
Charcoal        #171411     kaarten
Charcoal 2      #1F1B16     verhoogde vlakken
Champagne Gold  #C9A34E     actief, primaire actie, main story
Gold soft       #E4C782     accentlijnen en cijfers
Warm Ivory      #F6ECDF     tekst
Amber           #FF9A3C     bedrijven, eigen pins
Coral           #F05252     boss en risico
Burgundy        #681C35     diepte achter boss-elementen
Jade            #4FBF8B     home base, opportuniteit, positieve delta
```

Zwart, charcoal, ivoor en goud dragen ~85% van het beeld. Amber, coral en jade zijn
statuskleuren, geen decoratie.

**Typografie.** Anton voor display en missietitels (`.display`, schaal 34/27/21/17).
Montserrat voor alles wat gelezen wordt (400/600/700/800). Caveat uitsluitend voor drie
plekken: de hero-accenten, het Nyx-citaat in Journal, de conclusie in de Wrap.

**Ritme.** 4pt-schaal, kaarten `radius 16`, binnenmarge `14`, sectiemarge `16`,
verticale afstand tussen kaarten `10`. Raak dit niet aan per scherm.

## 4. Wat werkt in het prototype

Alle vijf tabs, plus missiedetail, wrap en de sheets. Deze vijf paden zijn getest:

- **A** Home → Continue mission → Mission detail → Open map → marker geselecteerd, sheet open
- **B** Map → marker tikken → bottom sheet → eigen pin maken (knop of lang indrukken) → pin blijft staan
- **C** Journal → Quick note → entry verschijnt in de tijdlijn → Create wrap → maandwrap
- **D** Nyx → voorstel → Accept → missie staat in Missions (Edit past titel en XP aan, Ignore verwijdert)
- **E** Profile → Campaign highlight → wrap van die maand

Persistentie via `localStorage` onder `hardwig.empire.v1`: journal, eigen pins, geaccepteerde
missies, afgevinkte objectieven, actieve missie, gegenereerde wraps, XP en statwaarden. Bij een
andere `version` valt de store terug op de seed — bouw daar in de echte app een migratie.

## 5. De kaart

Het prototype projecteert echte lat/lng met Web Mercator, vraagt echte OSM-rastertegels op en
valt terug op een eigen vectorlaag met dezelfde echte coördinaten wanneer die tegels niet laden
(offline, of een strikte content-security policy in de previewomgeving). De vectorlaag tekent de
gemeenten van de Kempen op hun werkelijke positie en verbindt ze schematisch — het is
uitdrukkelijk geen nagemaakt kaartbeeld.

In de echte app vervang je blok `[H]` door MapLibre of Leaflet. De aanbevolen tegelbron is de
donkere basemap van CARTO (gratis, geen sleutel, wel attributie verplicht):

```ts
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap, &copy; CARTO', maxZoom: 19
})
```

Behoud daarbij: de warme filmische grade over de tegels (multiply-laag `rgba(70,45,22,.55)` plus
`rgba(11,9,7,.34)`), de vignettering, markers als `divIcon` met de SVG uit `markerSvg()`, en de
filters uit `filterPins()`. Lang indrukken op de kaart blijft de snelste weg naar een eigen pin.

Markers hebben vijf toestanden: default, selected, active, completed, locked. Status wordt nooit
alleen met kleur gecommuniceerd — voltooid krijgt een vinkje, vergrendeld een slot.

## 6. Nyx

Nyx verschijnt enkel als zwevende avatarknop rechtsonder, en in haar eigen sheet. Geen portret
in gewone schermen; het portret in de FAB is ingebed als data-URI (`NYX_SRC`), vervang dat in de
echte app door een geoptimaliseerd bestand in `/public`.

Haar antwoorden komen nu uit `nyxReply()` — een sleutelwoordfunctie met vaste teksten. Dat is
bewust het aanhechtingspunt voor een echte LLM-call: zelfde in- en uitvoer, zelfde toon. Ze
spreekt de gebruiker aan met *u*, kort, zonder aanmoedigingstaal.

## 7. Bewuste afwijkingen van de screenshots

- De kleine Core-stats op Home toonden 42 / 39 / 28, het profiel 86 / 73 / 47 voor dezelfde
  statistieken. Overal de profielwaarden aangehouden; één bron.
- Het VOKA-event stond op +250 XP op de kaart en +150 XP in de missielijst. Overal 250.
- De rechterkolom van de Journal-screenshot (Daily impact, Today's stats, Upcoming) past niet
  naast de tijdlijn op 390px. Die blokken staan nu onder de tijdlijn, in dezelfde volgorde.
- Geen aparte "Add entry"-knop in Journal — de composer onderaan is de invoer, zoals gevraagd.
- Alle beeldvlakken zijn eigen SVG-composities met gradients. Vervang ze in de echte app door
  echte foto's; de klassen `.plate.fill`, `.plate.sq` en `.plate.wide` zijn de plekken.

## 8. Wat er nog niet in zit

Bewust weggelaten, in volgorde van waarde:

1. Echte fotoupload in Journal (nu een placeholderkoppeling) en spraaknotities.
2. Contacten als eigen scherm — ze bestaan als datamodel en op de kaart, maar hebben geen lijst.
3. Missiebewerking en het aanmaken van een missie zonder Nyx.
4. Meerdere hoofdstukken; hoofdstuk I is hardcoded.
5. Server en account. Alles staat nu in één browser.

## 9. Toon van de teksten

Nederlands, Vlaams, tegen de gebruiker in *u*. Kort, zakelijk, licht filmisch, nooit
motiverend-schreeuwerig. Engelse labels blijven Engels waar ze in de screenshots Engels waren
(`CONTINUE MISSION`, `MAIN STORY`, `CREATE WRAP`) — die gemengde registers zijn het merk, geen
slordigheid. Lege toestanden zijn een uitnodiging tot handelen, geen excuus.
