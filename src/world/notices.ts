/**
 * Notices: the classified ads at the back of each published report. PROPOSED flavor.
 *
 * They remind the party what they could do (grow, move, hire, protect themselves)
 * without telling them when. Every ad points at an option that really exists in the
 * simulation, and only appears when it would change something for this business.
 * Buying is a table conversation: the DM records the cost as a withdrawal and changes
 * the plan (and the business size, if needed). Prices are provisional.
 */
import { fairPrice } from "../engine/economy";
import { formatCp } from "../engine/math";
import type { ChannelType } from "../engine/plan";
import type { Notice, NoticeContext } from "../engine/types";

/** Provisional set-up costs quoted in the ads (cp). Wages and weekly fees come from the world data. */
export const GROWTH_PRICES_CP = { cart: 4500, stall: 6000, delivery: 2500 } as const;

const DISTRICT_PITCHES: Record<string, (rate: string) => { headline: string; text: string; from: string }> = {
  commons: (r) => ({ headline: "THE COMMONS: BIG APPETITES, SMALL PURSES", text: `Crowds all day and a hot pie goes for about ${r}. Mind the lads who offer to "keep an eye on the street".`, from: "Commons Traders' Noticeboard" }),
  "grand-market": (r) => ({ headline: "THE GRAND MARKET WANTS YOU (TO JOIN THE GUILD)", text: `The biggest crowds in Arentoria, wild market days, and pies at about ${r}. The guild will be along shortly to discuss your membership.`, from: "Grand Market Stallholders" }),
  "high-march": (r) => ({ headline: "HIGH MARCH: OUR RESIDENTS DO NOT QUEUE", text: `They send a footman. Fine pies, delivered to the door, fetch ${r} and more. Carts are regarded with polite horror.`, from: "A Discreet Lettings Agent" }),
  shades: (r) => ({ headline: "THE SHADES: NOBODY ASKS FOR YOUR PERMIT", text: `Cheap pitches, cheaper customers, pies at about ${r}. The street will ignore you until it trusts you, then it never shops anywhere else.`, from: "pinned to a lamp post" }),
  stoneback: (r) => ({ headline: "STONEBACK: CREWS THAT EAT LIKE OXEN", text: `Foremen order by the hundred and workshops take standing orders. Pies about ${r}. Dead quiet on Restday.`, from: "Stoneback Yards Gazette" }),
  scholarium: (r) => ({ headline: "THE SCHOLARIUM: ALWAYS HUNGRY, NEVER PAID", text: `Students count every copper (about ${r} a pie) but come back daily if you're good. The place empties in the summer recess.`, from: "Student Refreshment Committee" }),
  "outer-ward": (r) => ({ headline: "THE OUTER WARD: MORE DOORS THAN ANYWHERE", text: `Every one of them would like supper delivered. Neighborhood sellers and delivery rounds do well. Pies about ${r}.`, from: "Outer Ward Residents' Notice" }),
  "crown-ward": (r) => ({ headline: "THE CROWN WARD: EXPENSE ACCOUNTS WELCOME", text: `Ministries pay handsomely for catering (fine pies from about ${r}) provided your paperwork is immaculate. Carts are frowned upon.`, from: "Office of Civic Refreshment" }),
};

export function notices({ world, state, reportNumber, rng }: NoticeContext): Notice[] {
  const plan = state.plan;
  const here = world.neighborhoods[plan.neighborhood]!;
  const a = world.assumptions;
  const outlets = (t: ChannelType) => plan.channels.filter((c) => c.type === t && c.share > 0).length;
  const hired = new Set(plan.staff.map((s) => s.candidateId));
  const out: Notice[] = [];

  // 1. A way to grow, rotating through the ones this business hasn't taken yet.
  const grow: Notice[] = [];
  if (outlets("cart") < 2) grow.push({ kind: "grow", headline: "CART FOR SALE: COMES READY WITH STAFF!", text: "A sturdy cart, freshly painted, and a seller who knows the street. Two pitches sell more than one.", price: `${formatCp(GROWTH_PRICES_CP.cart)}, plus the seller's wage`, from: "Wheelwright, Tanners' Run" });
  if (!outlets("stall")) grow.push({ kind: "grow", headline: `STALL TO LET IN ${here.name.replace(/^the /, "").toUpperCase()}`, text: "Awning, counter and a fixed spot the customers can find. Rain or shine.", price: `${formatCp(GROWTH_PRICES_CP.stall)} to set up, then ${formatCp(here.stallFeeCpPerWeek)} a week`, from: "Market Office" });
  if (!outlets("delivery")) grow.push({ kind: "grow", headline: "RUNNERS & BASKETS: PIES TO THE DOOR", text: "Households pay a little extra not to leave the house. Some districts like this more than others.", price: `${formatCp(GROWTH_PRICES_CP.delivery)} for baskets, plus ${a.marketWageCpPerDay.runner} cp a day per runner`, from: "Runners' Guildlet" });
  if (!outlets("wholesale")) grow.push({ kind: "grow", headline: "INNKEEPER SEEKS A STEADY PIE SUPPLIER", text: "Standing orders, paid weekly, at a trade discount. Needs a runner to deliver.", from: "The Crooked Ladle and friends" });
  if (grow.length) out.push(grow[(reportNumber - 1) % grow.length]!);

  // 2. Another district, a different one each report, quoting what a typical pie sells for there.
  const others = Object.keys(world.neighborhoods).filter((id) => id !== plan.neighborhood && DISTRICT_PITCHES[id]);
  if (others.length) {
    const id = others[(reportNumber - 1) % others.length]!;
    const n = world.neighborhoods[id]!;
    const pitch = DISTRICT_PITCHES[id]!(formatCp(Math.round(fairPrice(world, n, n.demand.qualityPreference))));
    out.push({ kind: "district", ...pitch });
  }

  // 3. One or two other options that would actually change something for this business.
  const services: Notice[] = [];
  const seekers = world.staffPool.filter((c) => !hired.has(c.id) && !c.roles.includes("guard"));
  if (seekers.length) {
    const s = seekers[rng.int(0, seekers.length - 1)]!;
    services.push({ kind: "service", headline: `${s.roles.includes("runner") && !s.roles.includes("vendor") ? "RUNNER" : "SELLER"} SEEKS WORK`, text: `${s.name}: ${s.blurb}`, price: `asks ${s.askingWageCpPerDay} cp a day`, from: "Hiring board" });
  }
  const guard = world.staffPool.find((c) => c.roles.includes("guard") && !hired.has(c.id));
  if (guard && !plan.staff.some((s) => s.role === "guard")) services.push({ kind: "service", headline: "WATCHFUL TYPE FOR HIRE", text: `${guard.name}: ${guard.blurb} Keeps cash boxes full and toughs polite.`, price: `${guard.askingWageCpPerDay} cp a day`, from: "Hiring board" });
  if (plan.advertisingCpPerWeek < 100) services.push({ kind: "service", headline: "TOWN CRIER: LUNGS LIKE A BELLOWS", text: "Your name shouted down every street worth shouting down. More people who know you means more people who buy.", price: "from 1 sp a week", from: "Crier for hire" });
  if (plan.suppliers < 3) services.push({ kind: "service", headline: "BUTCHER SEEKS NEW CUSTOMERS", text: "A second supplier means fewer empty days when the deliveries don't come. Slightly dearer.", from: "Redbrick Row" });
  if (plan.quality < 4) services.push({ kind: "service", headline: "PRIME CUTS AT HONEST PRICES", text: "Finer meat makes finer pies, and finer pies fetch more in the right district.", from: "A butcher with ambitions" });
  if (plan.guild === "none") services.push({ kind: "service", headline: "THE MERCHANTS' GUILD WELCOMES ASSOCIATES", text: "Fewer surprises, friendlier inspectors, and a seat at the table.", price: `${formatCp(a.guild.associateInitiationCp)} to join, ${formatCp(a.guild.associateDuesCpPerWeek)} a week`, from: "The Guild" });
  if (plan.compliance !== "full") services.push({ kind: "service", headline: "A REMINDER FROM THE LICENSING OFFICE", text: "A food certificate costs far less than a fine.", from: "City licensing office" });
  for (let i = 0; i < 2 && services.length; i++) out.push(services.splice(rng.int(0, services.length - 1), 1)[0]!);

  return out;
}
