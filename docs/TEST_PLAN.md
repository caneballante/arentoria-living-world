# Playtest plan (about 25 minutes)

The goal is to confirm the prototype works, and to collect your judgment on whether the numbers, the pace of events and the stories *feel right* for Arentoria. Note anything that feels off, since calibration is the next step.

**Launch:** double-click `Launch Arentoria.cmd` (Windows) or `Launch Arentoria.command` (Mac), or run `npm run launch`. The first launch installs dependencies (about a minute), then your browser opens the app. To stop, press Ctrl+C in the launcher window or close it.

The **campaign clock** bar is how you move time: **+1 day**, **+1 week**, **+4 weeks**, or **Until something needs the party** (up to 8 weeks, stopping as soon as a decision arises or something major happens). **Run a whole season** plays 13–52 weeks in one go.

**First, the real starting point.** The default plan is *Starting out: one cart in the Commons*. Check the "Business size" box at the top of the plan: you can't add a second outlet, hire a second person, push the constructs, or bake more than 500 pies a week. Click **+1 week**: the report shows the week's summary and up to three notes. Click **Every note + DM explanations** to see the rest. Then try **Unrestricted (sandbox)** and back: a bigger plan offers **Trim the plan to fit**.

**The campaign (real play).** Open **Campaign** and choose **Test campaign**. Pick a district: the price fills in with the going rate there, and High March or the Crown Ward warn that a cart alone will struggle. Click **Start the test campaign**.
1. Click **+1 week**, type a deadline under "Answers due by", and click **Publish Report 1**. It appears under "Published reports"; open it. You should see a printable page with the letter, figures, any questions with tick boxes, week by week, three or four **notices** (a way to grow, another district's pitch, an option or two), and a few sentences on how the business is run. Publish a couple more reports: the notices rotate.
2. Click **Until something needs the party**. If it stops on a question that's due today, answer it. When it stops on a new question, publish Report 2: that question is in the report with its deadline and what happens if nobody answers.
3. Change an order (say the price) and click **Apply from day N**. Record a withdrawal on the **Account** tab. Both show up straight away. Change the district too: the banner explains what a move costs, and the next weekly report says "We moved to…".
4. Click **Undo Report 2…**, then **Yes, undo it**. The stretch becomes a draft again. Publish it again and it comes out the same.
5. **Rewind to the last report**, then move the clock again: the same days replay identically.
6. **Restart…** the test campaign. It goes back to day 0, and **The party's campaign** is untouched. Start the real campaign when you're ready for the table.

**The sandbox.** For the steps below, open **Sandbox** and pick *Conservative Commons cart* (an unrestricted strategy study), seed `autumn-940`, "Stop and ask".

| # | Do | Expect |
|---|---|---|
| 1 | **A normal session.** Click **+1 week**. | The clock reads *Day 7 · Marketday, 18 Rainmoot 940 CY* (the campaign starts on 12 Rainmoot). You see a "Since last time" summary, tiles, and the first weekly report. |
| 2 | Click **+1 day**. | Day 8. The overview line shows "+ 1 day(s) of week 2 (sold …, takings … so far)"; the weekly books close on day 7 of each week. |
| 3 | **Downtime.** Click **Until something needs the party**. | It stops on **Day 42**: "Stopped: A new recipe" (Pell Marrow wants to try a spiced pie). Spring is quiet in the Commons; the first big festival is the Midsummer Revel. The question appears under **Waiting on an answer** with an "answer by" date. |
| 4 | Pick an answer (the safe or the risky one) in the waiting list, then click **Noted — keep going**. | The clock runs on. If you let Pell try, the result arrives a week later as news. Without an answer, the clock would stop again at the deadline to ask, and on "Don't stop" the standing order decides. |
| 5 | Keep clicking **Until something needs the party** and answer whatever comes up. | Over the season: more festival offers, a staff raise request, the **licensing ruling (week 25, a DM decision)**, and occasional crowds, shortages or complaints. Ordinary weeks pass quietly; the clock usually runs 3–8 weeks between stops. |
| 6 | **Change the plan mid-season.** Raise **Price per pie** by 1 cp. | A banner says "The plan has changed" with **Apply from day N**, **Restart…** and **Undo edits**. The clock buttons wait until you choose. |
| 7 | Click **Apply from day N**, then **+4 weeks**. Open **Audit trail**. | The business carries on under the new price. The audit trail lists "Business plan revised between sessions". |
| 7b | **The business account.** Open the **Account** tab. As DM, record a withdrawal (say 15 gp, "Shopping for the dungeon"), then use "Change where it's kept". Click **+1 week**. | The balance drops immediately and the withdrawal appears on the statement "by DM". It's counted once after the clock moves. The tab shows the operating floor and what's safe to withdraw. To feel running dry, set "If the money runs out" to **Nobody does** and withdraw nearly everything: bills go unpaid, wages go out late, and then suppliers stop delivering until you record a deposit. |
| 8 | Click **Players** in the top bar. | The same moment as the party sees it: the digest, short reports (summary plus up to three notes), open decisions with deadlines and the account statement (read-only), but no hidden numbers, no "↳" explanations, and no Threads/Why tabs. Switch back to **DM**. |
| 9 | **Whole season, unattended.** Set "When a decision comes due" to **Don't stop**, choose **26 weeks**, then click **Restart & run season**. Click it again. | Total profit about **1,275 gp**, identical both times (same seed + same plan = same world). Every decision was handled by the standing orders. |
| 10 | Change the price to **14 cp** and click **Restart & run season** again. | Profit drops to about **925 gp**. The tiles say "▼ … vs previous run", and the cash chart shows the previous run dashed. |
| 11 | Pick the **Aggressive Grand Market expansion** scenario and run the season with **Stop and ask**. Decline the guild and refuse the crew. | A busier, rougher year: the guild's formal notice (about week 8), an inspection you rule on as DM (week 9), a formal complaint, then the protection racket's proposition, warning and reprisal (weeks 18–23). Warning signs come before each escalation. Joining the guild or paying the crew changes everything after that point. |
| 11b | **A gamble.** Pick **Careful Grand Market expansion**, set **Construct workload** to **Pushed** and **Pies per week** to 1900, then run 52 weeks a few times with different seeds. | Usually more profit than steady, but some seeds go badly: reports warn the constructs are "running hot", and roughly one year in six brings a kitchen fire that closes the kitchen for weeks. Compare **Careful** against **Aggressive** too: cutting corners loses to doing the same thing carefully. |
| 12 | Open **Why? (week inspector)** and **Threads**. | Each hidden value lists the causes of its change, including an "events, decisions & limits" line, and they add up. Threads show stages, pressure, and any frozen "settle at the table" situations. |
| 12b | **The other districts.** Pick each new starting plan in turn (*Cheap pies in the Shades*, *Stoneback yards and workshops*, *Scholarium lunch stall*, *Outer Ward delivery rounds*, *Crown Ward catering and contracts*) and run 52 weeks. | Each feels different. The Shades starts slowly and the Lowlamp Crew comes asking. Stoneback is dead on Restday and gets bulk orders. The Scholarium goes quiet in the summer recess. The Outer Ward relies on delivery runners. The Crown Ward pays well but only if you stay fully compliant: try it with "Basic" permits and watch the contracts dry up. |
| 13 | Go to **Compare strategies** and click **Run comparison**. | Sound plans rank well above the "(control)" plans. The **Pacing** table shows how often each strategy produces decisions, notable and major events, the longest quiet stretch, and whether any crisis repeats. |
| 14 | Open **Canon & assumptions**. | Each item is labelled canon / proposed / provisional. Canon covers the campaign brief plus the DM's calendar, factions and faiths. The calendar lists Firstday to Restday, with Council Day outside the week. |

## Things to judge (please jot down)

- **Pace.** Does about one A-or-B choice a month feel right? Are the safe and risky options tempting in the right ways? Do the risky plans feel eventful rather than relentless?
- **Session fit.** For a typical session (about a week passes), was there enough to talk about? For a long downtime, did "Until something needs the party" stop at the right moments?
- **Money.** Does ~20 gp/week for a starting cart, ~50 gp/week for an established Commons business and ~110 gp/week for a luxury High March or Crown Ward business feel right next to 14 gp/week rent?
- **Trouble.** A busy Commons cart that refuses to pay usually meets the Ninepenny Crew in its first year (watchers, then a demand, then a warning). Too often, or about right?
- **Risk.** Is pushing the constructs tempting but scary? Is a kitchen fire in about one pushed year in six the right level of danger?
- **Voice.** Do the reports and the "since last time" summary read like something the party would hear? Are three notes a week the right amount?
- **Starting small.** Does one cart with one seller feel like the right start? It earns about 20 gp a week after costs (see ASSUMPTIONS, "Starting small").
- **Decisions.** Which choices felt meaningful, and which decisions are missing?

## Automated checks (developers)

```bash
npm run check        # typecheck + tests
npm run build        # production build
npm run compare -- --runs 30 --weeks 26,52
```
