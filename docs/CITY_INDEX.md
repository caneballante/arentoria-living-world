# Arentoria DM City Index: integration notes

The DM's City Index (`caneballante/arentoria`) documents the map, all 1,676 buildings, 10,000 residents (homes, jobs, households, wealth, faction ties, public notes, private pressures), 20 factions, and authored district prompts. **It is a resource, not canon.** Nothing has been built against it yet. These notes capture decisions and findings so far.

## Status in the living world: "reference"

- Living-world content keeps its four provenance labels (canon / proposed / provisional / simulated). City Index material would add a fifth: **reference**. It is real and citable, but becomes canon only when used at the table (the DM promotes it).
- The City Index's own docs call its census "canon". For this project, the DM's ruling is that it is reference material.
- Planned approach: read-only import of a **pinned** snapshot (census v20, factions v21), keyed by the index's stable IDs (`AR-xxxx` buildings, `P-xxxxx` people, `FAC-xxx` factions). The living world stores only its own changes (hires, relationships, hostility, events) against those IDs and never writes back to the index.

## DM rulings (overrides of reference data)

| Date | Ruling |
|---|---|
| 2026-11-22 | **Big factions are in.** The City Index's major factions (Cloverpot Compact, Deep Ledger, Merchants' Guild & Guild Wardens, and others) can be used. **Smaller, less consequential local factions** sit beneath them, to be created and proposed for the canon doc. Drafts: [`proposals/small-factions.md`](proposals/small-factions.md) (spreadsheet: [`proposals/small-factions.csv`](proposals/small-factions.csv)). |
| 2026-11-22 | **17 Dawnfire Promenade = AR-0603**, a Guildstrand row house, and the party lives there. The index's listed households at AR-0603 (the Tanners, incl. guildmaster Derrin Torr, P-02071; and the Harrowells) do not live there in the campaign. Recorded in `src/world/canon.ts` as `house-city-index`. Where those residents live instead is undecided; the index itself is unchanged. |

## Findings relevant to the simulation

- **Factions that match the brief's canon names:** Cloverpot Compact (FAC-002, criminal syndicate, territorial intimidation), The Deep Ledger (FAC-004, disciplined criminal fraternity, avoids public spectacle), Stonehome Heritage House (FAC-003), Merchants' Guild & Guild Wardens (FAC-005, inspections, blacklists, warehouse raids), Blanders School of Adventuring (FAC-015). Also relevant: City Guard and Watch (FAC-006), Office of Expeditionary Licenses (FAC-008, Vayne patronage), and Harrowell Agricultural Trust (FAC-010).
- **Likely replacements for proposed stand-ins:** protection crews → Cloverpot Compact or Deep Ledger members active in the district; "Bakers' and Piemakers' Fellowship" → Merchants' Guild & Guild Wardens; rival pie shops → real bakeries (e.g. Commons: Honey Bun & Bread Bell, The Warm Oven, Oven Bakehouse); suppliers → real butchers (e.g. The Ox Head and The Iron Cleaver on Redbrick Row).
- **Hiring pool:** real residents of the business's district with suitable roles and wealth.
- **NPC stats** (INT/WIS/CHA + integrity, reliability, ambition, connections) are not in the index. The plan is to generate them deterministically per person, guided by their record, labelled proposed, with DM overrides.

## Open questions

- Adopt, rename or reject the seven proposed small factions (SF-001…SF-007), then swap them into the simulation in place of the stand-ins.
- Choose Grand Market and High March rival bakeries from the index.
- Where do the displaced AR-0603 residents live, if it ever matters?
- Which index version to pin, and how to review re-imports (a diff before adopting changes).
