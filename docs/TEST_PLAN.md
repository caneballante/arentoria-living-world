# Playtest plan (about 20 minutes)

The goal is to confirm the prototype works, and to collect your judgment on whether the numbers and stories *feel right* for Arentoria. Note anything that feels off, since calibration is the next step.

**Launch:** double-click `Launch Arentoria.cmd` (Windows) or `Launch Arentoria.command` (Mac), or run `npm run launch`. The first launch installs dependencies (about a minute), then your browser opens the Sandbox. To stop, press Ctrl+C in the launcher window or close it.

| # | Do | Expect |
|---|---|---|
| 1 | Leave the defaults (*Conservative Commons cart*, seed `autumn-940`, 26 weeks, *Pause for decisions*) and click **Run the season**. | The run stops in **week 25** with "Decision needed (DM ruling)": the constructs' licensing ruling. |
| 2 | Choose **Approve**. | The season completes. Tiles show about **267 gp** total profit, 1–2 losing weeks, charts for weekly profit and cash, and a latest weekly report. |
| 3 | Click **Run again** without changing anything, then choose Approve again. | Identical numbers (same seed + same plan = same world). |
| 4 | Change **Price per pie** from 5 to **7 cp**, run again, and approve. | Profit drops to about **102 gp**. The tiles say "▼ … vs previous run", the cash chart shows the previous run dashed, and the reports mention customers walking past the price board. |
| 5 | Open **Why? (week inspector)** and drag through the weeks. Open **Threads**. | Each hidden value (reputation, visibility, scrutiny…) lists the causes of its change, and they add up. Threads show pressure that is calm for this plan. |
| 6 | Click **Players** (top bar). | No hidden numbers anywhere: no reputation tile, no Threads/Why tabs, and report lines have no "↳" explanations. You see only what the party would learn. |
| 7 | Switch back to **DM**. Pick the scenario **Aggressive Grand Market expansion** and run it. | Several decisions arrive in order: Fellowship guild notice (week 8), a Saltgutter Crew protection demand (week 19), a violent reprisal (week 22), then the licensing ruling. The **Events** tab shows warning signs ("strangers counting customers") *before* each demand. |
| 8 | Run it again, answering differently: **Join as full member**, then **Pay**. Then try once with **Handle it in person (flag)**. | Different choices produce a different season (fewer crises, different profit). "Flag" freezes that situation and marks it "Awaiting in-person resolution". |
| 9 | Go to **Compare strategies** and click **Run comparison**. | Every strategy runs 20 seeded times in a few seconds. Sound plans rank well above the two "(control)" plans; risky plans show high extortion/guild columns; your current Sandbox plan appears as "Your plan" with head-to-head win rates. |
| 10 | Open **Canon & assumptions**. | Each item is labelled canon / proposed / provisional; only the campaign-brief facts are canon. |
| 11 | Optional: open the app on a phone-width window or in dark mode. | The layout stacks and stays readable, with no sideways scrolling. |

## Things to judge (please jot down)

- **Money.** Does ~10 gp/week for an honest Commons cart, ~13 gp/week for a paid-up Grand Market stall, and ~23 gp/week for a luxury High March business feel right next to 14 gp/week rent?
- **Prices.** Should a meat pie cost 5 cp in the Commons? 16+ cp in High March?
- **Trouble.** Do crises come too often, too rarely, or about right? Are the warning signs noticeable enough?
- **Voice.** Do the weekly reports read like something the party would hear? Is anything missing that they'd want to know?
- **Decisions.** Which choices felt meaningful, and which decisions are missing?

## Automated checks (developers)

```bash
npm run check        # typecheck + 64 tests
npm run build        # production build
npm run compare -- --runs 30 --weeks 26,52
```
