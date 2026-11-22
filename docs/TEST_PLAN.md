# Playtest plan (about 25 minutes)

The goal is to confirm the prototype works, and to collect your judgment on whether the numbers, the pace of events and the stories *feel right* for Arentoria. Note anything that feels off, since calibration is the next step.

**Launch:** double-click `Launch Arentoria.cmd` (Windows) or `Launch Arentoria.command` (Mac), or run `npm run launch`. The first launch installs dependencies (about a minute), then your browser opens the Sandbox. To stop, press Ctrl+C in the launcher window or close it.

The **campaign clock** bar is how you move time: **+1 day**, **+1 week**, **+4 weeks**, or **Until something needs the party** (up to 8 weeks, stopping as soon as a decision arises or something major happens). **Run a whole season** plays 13–52 weeks in one go.

Start with the defaults: *Conservative Commons cart*, seed `autumn-940`, "Stop and ask".

| # | Do | Expect |
|---|---|---|
| 1 | **A normal session.** Click **+1 week**. | The clock reads *Day 7 · Restday, 7 Harvest 940 CY*. You see a "Since last time" summary, tiles, and the first weekly report. |
| 2 | Click **+1 day**. | Day 8. The overview line shows "+ 1 day(s) of week 2 (sold …, takings … so far)"; the weekly books close on day 7 of each week. |
| 3 | **Downtime.** Click **Until something needs the party**. | It stops on **Day 14**: "Stopped: A prime pitch for the festival" (the Harvest Fair). The offer appears under **Waiting on an answer** with an "answer by" date. |
| 4 | Pick **Take the pitch** in the waiting list, then click **Noted — keep going**. | The clock runs on, and the pitch boosts sales during the fair. Without an answer, the clock would stop again at the deadline to ask, and on "Don't stop" the standing order decides. |
| 5 | Keep clicking **Until something needs the party** and answer whatever comes up. | Over the season: more festival offers, a staff raise request, the **licensing ruling (week 25, a DM decision)**, and occasional crowds, shortages or complaints. Ordinary weeks pass quietly; the clock usually runs 3–8 weeks between stops. |
| 6 | **Change the plan mid-season.** Raise **Price per pie** by 1 cp. | A banner says "The plan has changed" with **Apply from day N**, **Restart…** and **Undo edits**. The clock buttons wait until you choose. |
| 7 | Click **Apply from day N**, then **+4 weeks**. Open **Audit trail**. | The business carries on under the new price. The audit trail lists "Business plan revised between sessions". |
| 8 | Click **Players** in the top bar. | The same moment as the party sees it: the digest, reports and open decisions with deadlines, but no hidden numbers, no "↳" explanations, and no Threads/Why tabs. Switch back to **DM**. |
| 9 | **Whole season, unattended.** Set "When a decision comes due" to **Don't stop**, choose **26 weeks**, then click **Restart & run season**. Click it again. | Total profit about **273 gp**, identical both times (same seed + same plan = same world). Every decision was handled by the standing orders. |
| 10 | Change the price to **7 cp** and click **Restart & run season** again. | Profit drops to about **127 gp**. The tiles say "▼ … vs previous run", and the cash chart shows the previous run dashed. |
| 11 | Pick the **Aggressive Grand Market expansion** scenario and run the season with **Stop and ask**. Decline the guild and refuse the crew. | A busier, rougher year: the guild's formal notice (about week 8), an inspection you rule on as DM (week 9), a formal complaint, then the protection racket's proposition, warning and reprisal (weeks 18–22). Warning signs come before each escalation. Joining the guild or paying the crew changes everything after that point. |
| 11b | **A gamble.** Pick **Careful Grand Market expansion**, set **Construct workload** to **Pushed** and **Pies per week** to 1900, then run 52 weeks a few times with different seeds. | Usually more profit than steady, but some seeds go badly: reports warn the constructs are "running hot", and roughly one year in six brings a kitchen fire that closes the kitchen for weeks. Compare **Careful** against **Aggressive** too: cutting corners loses to doing the same thing carefully. |
| 12 | Open **Why? (week inspector)** and **Threads**. | Each hidden value lists the causes of its change, including an "events, decisions & limits" line, and they add up. Threads show stages, pressure, and any frozen "settle at the table" situations. |
| 13 | Go to **Compare strategies** and click **Run comparison**. | Sound plans rank well above the "(control)" plans. The **Pacing** table shows how often each strategy produces decisions, notable and major events, the longest quiet stretch, and whether any crisis repeats. |
| 14 | Open **Canon & assumptions**. | Each item is labelled canon / proposed / provisional; only the campaign-brief facts are canon. |

## Things to judge (please jot down)

- **Pace.** Does roughly one decision every 4–6 in-game weeks feel right for a well-run business? Do the risky plans feel eventful rather than relentless?
- **Session fit.** For a typical session (about a week passes), was there enough to talk about? For a long downtime, did "Until something needs the party" stop at the right moments?
- **Money.** Does ~10 gp/week for an honest Commons cart and ~25 gp/week for a luxury High March business feel right next to 14 gp/week rent?
- **Trouble.** A busy Commons cart that refuses to pay usually meets the Ninepenny Crew in its first year (watchers, then a demand, then a warning). Too often, or about right?
- **Risk.** Is pushing the constructs tempting but scary? Is a kitchen fire in about one pushed year in six the right level of danger?
- **Voice.** Do the reports and the "since last time" summary read like something the party would hear?
- **Decisions.** Which choices felt meaningful, and which decisions are missing?

## Automated checks (developers)

```bash
npm run check        # typecheck + tests
npm run build        # production build
npm run compare -- --runs 30 --weeks 26,52
```
