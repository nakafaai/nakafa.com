import { Array as Arr, Match, Schema } from "effect";

/**
 * The drugs the lab can add to a cholinergic synapse, each acting on one
 * step: nicotine opens the receptor as acetylcholine does (OpenStax Anatomy
 * and Physiology 2e, 12.5); curare holds the receptor's binding sites without
 * opening it (StatPearls, Neuromuscular Blocking Agents, NBK537168); an
 * organophosphate phosphorylates acetylcholinesterase so acetylcholine is not
 * split (StatPearls, Organophosphate Toxicity, NBK470430); botulinum toxin
 * cleaves the SNARE proteins vesicles need to fuse, so none release (Purves
 * et al., Neuroscience 6e, 2018, Box 5B).
 */
const DrugSchema = Schema.Literals([
  "nicotine",
  "curare",
  "organophosphate",
  "botulinum",
]);
export type Drug = typeof DrugSchema.Type;

/** What the cleft holds besides acetylcholine: no drug, or one of them. */
const TreatmentSchema = Schema.Union([DrugSchema, Schema.Literal("none")]);
export type Treatment = typeof TreatmentSchema.Type;

/** The resting membrane potential, in millivolts (OpenStax Anatomy and Physiology 2e, 12.4). */
export const REST = -70;

/** The threshold of an action potential, in millivolts (OpenStax Anatomy and Physiology 2e, 12.4). */
export const THRESHOLD = -55;

/**
 * The reversal potential of the acetylcholine receptor's current, in
 * millivolts: its channel passes Na+ and K+ almost equally, so the current
 * reverses near 0 mV (Purves et al., Neuroscience 6e, 2018, Ch. 5).
 */
const REVERSAL = 0;

/** Acetylcholine molecules in one synaptic vesicle (Purves et al., Neuroscience 6e, 2018, Ch. 5: about 10,000). */
export const PER_VESICLE = 10_000;

/** Vesicles one impulse releases at this active zone: the teaching model's choice. */
export const VESICLES = 2;

/**
 * Milliseconds from the impulse reaching the terminal to the vesicles
 * fusing, while Ca2+ enters: the teaching model's choice within the delay of
 * about a millisecond Purves et al. (Neuroscience 6e, 2018, Ch. 5) measure
 * across a whole synapse.
 */
export const DELAY = 0.5;

/**
 * Milliseconds the released acetylcholine takes to reach the receptors in
 * the lab: the playback stretches this crossing so it can be followed, while
 * diffusion across a 30 nm cleft takes far less (Purves et al., Neuroscience
 * 6e, 2018, Ch. 5).
 */
export const CROSSING = 0.05;

/**
 * The time constant, in milliseconds, with which acetylcholinesterase clears
 * acetylcholine from the cleft and its receptors close: the teaching model's
 * choice, of the order of a millisecond, as transmission at a cholinergic
 * synapse is over within about a millisecond (Purves et al., Neuroscience 6e,
 * 2018, Ch. 5).
 */
const CLEARANCE = 1;

/**
 * How many times longer acetylcholine acts once its enzyme is blocked: an
 * anticholinesterase lengthens the decay of the end-plate current 2 to 7
 * times, 3.3 times on average (Magleby and Terrar, J Physiol 244:467, 1975).
 */
const INHIBITED = 3.3;

/**
 * The postsynaptic membrane's time constant, in milliseconds: the teaching
 * model's choice at the low end of the 20 to 100 ms that neurons measure
 * (Koch, Rapp and Segev, Cereb Cortex 6:93, 1996).
 */
const MEMBRANE = 30;

/**
 * The acetylcholine in the cleft, in molecules, that fills half of the
 * receptors' binding sites: the teaching model's choice, one impulse's
 * release, so its receptors open by a quarter.
 */
const HALF = VESICLES * PER_VESICLE;

/**
 * How much the open receptors' conductance outweighs the membrane's own, if
 * all were open: the teaching model's choice, which makes one impulse's
 * excitatory postsynaptic potential about 11 mV, between the weak 0.5 to 7 mV
 * and the suprathreshold nicotinic synapses on ganglion neurons (Rimmer and
 * Horn, Front Neurol 1:130, 2010).
 */
const GAIN = 30;

/**
 * The drugs' concentrations, each over its own dissociation constant from the
 * binding sites: the teaching model's doses. Curare at twenty times its
 * constant leaves acetylcholine almost no site; nicotine at 0.3 opens enough
 * receptors to hold the membrane above threshold.
 */
const CURARE = 20;
const NICOTINE = 0.3;

/** Impulses in one run of the lab, after which the synapse rests and the run starts again. */
export const IMPULSES = 8;

/** The time step the potential is integrated with while acetylcholine acts, in milliseconds. */
const STEP = 0.05;

/** Milliseconds between impulses arriving `rate` times a second. */
export function interval(rate: number) {
  return 1000 / rate;
}

/** The acetylcholine molecules one impulse releases into the cleft: none once botulinum toxin has cleaved the SNAREs. */
export function released(treatment: Treatment) {
  return treatment === "botulinum" ? 0 : VESICLES * PER_VESICLE;
}

/** The time constant, in milliseconds, with which acetylcholine leaves the cleft. */
export function clearance(treatment: Treatment) {
  return treatment === "organophosphate" ? CLEARANCE * INHIBITED : CLEARANCE;
}

/**
 * The acetylcholine in the cleft, in molecules, `time` milliseconds into a
 * run of impulses arriving `rate` times a second: each impulse releases its
 * vesicles `DELAY` after it arrives, and every release decays with the
 * clearance time constant.
 */
export function transmitterAt(
  time: number,
  rate: number,
  treatment: Treatment
) {
  const tau = clearance(treatment);
  return Arr.reduce(Arr.range(0, IMPULSES - 1), 0, (sum, index) => {
    const since = time - index * interval(rate) - DELAY;
    return since < 0 ? sum : sum + released(treatment) * Math.exp(-since / tau);
  });
}

/**
 * The share of the receptors' binding sites that hold an agonist and the
 * share that hold curare, with `transmitter` molecules of acetylcholine in
 * the cleft. Acetylcholine, nicotine and curare compete for the same sites,
 * each in proportion to its concentration over its dissociation constant.
 */
export function bindingAt(transmitter: number, treatment: Treatment) {
  const acetylcholine = transmitter / HALF;
  const nicotine = treatment === "nicotine" ? NICOTINE : 0;
  const curare = treatment === "curare" ? CURARE : 0;
  const total = 1 + acetylcholine + nicotine + curare;
  return {
    acetylcholine: acetylcholine / total,
    curare: curare / total,
    nicotine: nicotine / total,
  };
}

/**
 * The share of receptors open: a receptor opens only when both of its
 * binding sites, on its two α subunits, hold an agonist (Unwin, Proc AuPS
 * 36:24P, 2005).
 */
export function openAt(transmitter: number, treatment: Treatment) {
  const binding = bindingAt(transmitter, treatment);
  return (binding.acetylcholine + binding.nicotine) ** 2;
}

/**
 * The potential the membrane settles at while a share `open` of the
 * receptors stays open: the balance of the leak towards rest and the
 * receptors' current towards their reversal potential.
 */
export function settledAt(open: number) {
  return (REST + GAIN * open * REVERSAL) / (1 + GAIN * open);
}

/**
 * The postsynaptic potential `time` milliseconds into a run, in millivolts,
 * and whether it has reached threshold so far, so the next neuron fired. It
 * integrates the membrane exactly over each step, taking the open share as
 * constant within the step: fine steps while acetylcholine acts, and one step
 * to the next impulse once it has gone. Nicotine is already in the cleft as
 * the run starts, so the membrane starts settled under it.
 */
export function potentialAt(time: number, rate: number, treatment: Treatment) {
  const gap = interval(rate);
  const acting = DELAY + 12 * clearance(treatment);
  let potential = settledAt(openAt(0, treatment));
  let peak = potential;
  const advance = (from: number, to: number) => {
    const open = openAt(
      transmitterAt((from + to) / 2 - CROSSING, rate, treatment),
      treatment
    );
    const settled = settledAt(open);
    potential =
      settled +
      (potential - settled) *
        Math.exp((-(1 + GAIN * open) * (to - from)) / MEMBRANE);
    peak = Math.max(peak, potential);
  };
  for (let index = 0; index < IMPULSES && index * gap < time; index += 1) {
    const start = index * gap;
    const end = index === IMPULSES - 1 ? time : Math.min(time, start + gap);
    const fine = Math.min(end, start + acting);
    const steps = Math.ceil((fine - start) / STEP);
    for (let step = 0; step < steps; step += 1) {
      advance(start + step * STEP, Math.min(fine, start + (step + 1) * STEP));
    }
    if (end > fine) {
      advance(fine, end);
    }
  }
  return { fired: peak >= THRESHOLD, potential };
}

/**
 * How the lab plays one impulse, as pairs of seconds on the screen and
 * milliseconds at the synapse: the impulse arrives and Ca2+ enters, the
 * vesicles fuse and acetylcholine crosses the cleft in slow motion, the
 * receptors open while the enzyme splits it, and then the rest of the
 * interval passes quickly. The last pair stands for the interval's end.
 */
const PLAYBACK = [
  [0, 0],
  [1.2, 0.45],
  [2, 0.55],
  [3.6, 3],
] as const;

/** Seconds on the screen that one impulse takes to play. */
export const CYCLE = 4.4;

/** Seconds on the screen that one run of the lab takes to play. */
export const RUN = CYCLE * IMPULSES;

/**
 * The playback of one impulse for impulses `gap` milliseconds apart, as its
 * stretches from one pair of seconds on the screen and milliseconds at the
 * synapse to the next.
 */
function playback(gap: number) {
  const knots = Arr.append(PLAYBACK, [CYCLE, gap] as const);
  return Arr.zip(knots, Arr.drop(knots, 1));
}

/** How far `value` has come from `from` towards `to`, held between none and all of the way. */
function progress(value: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/**
 * The time at the synapse, in milliseconds since the run started, at `shown`
 * seconds into the run on the screen: linear along each stretch of the
 * impulse's playback, the interval's last stretch passing quickly.
 */
export function synapseTime(shown: number, rate: number) {
  const gap = interval(rate);
  const { index, within } = phaseOf(shown);
  return Arr.reduce(
    playback(gap),
    index * gap,
    (time, [[fromShown, fromTime], [toShown, toTime]]) =>
      time + (toTime - fromTime) * progress(within, fromShown, toShown)
  );
}

/**
 * The seconds on the screen, from an impulse's arrival, at which `time`
 * milliseconds have passed at the synapse since it arrived: the playback
 * read the other way, none before it arrives and the end of the cycle for
 * any later time.
 */
export function shownAt(time: number, rate: number) {
  return Arr.reduce(
    playback(interval(rate)),
    0,
    (shown, [[fromShown, fromTime], [toShown, toTime]]) =>
      shown + (toShown - fromShown) * progress(time, fromTime, toTime)
  );
}

/**
 * Where an impulse is in its playback: which impulse of the run, and how many
 * seconds on the screen have passed since it arrived.
 */
export function phaseOf(shown: number) {
  const index = Math.max(0, Math.min(IMPULSES - 1, Math.floor(shown / CYCLE)));
  return { index, within: Math.min(CYCLE, shown - index * CYCLE) };
}

/** Names a treatment's step for reading the drug toggle: the drug, or none. */
export function treatmentOf(value: string): Treatment {
  return Match.value(value).pipe(
    Match.when("nicotine", () => "nicotine" as const),
    Match.when("curare", () => "curare" as const),
    Match.when("organophosphate", () => "organophosphate" as const),
    Match.when("botulinum", () => "botulinum" as const),
    Match.orElse(() => "none" as const)
  );
}

/** What one binding site of a receptor holds. */
const LigandSchema = Schema.Literals([
  "acetylcholine",
  "nicotine",
  "curare",
  "empty",
]);
type Ligand = typeof LigandSchema.Type;

/** One receptor as the lab draws it: what its two binding sites hold, and whether its channel is open. */
const ReceptorSchema = Schema.Struct({
  open: Schema.Boolean,
  sites: Schema.Tuple([LigandSchema, LigandSchema]),
});
type Receptor = typeof ReceptorSchema.Type;

/**
 * What `count` receptors near the release sites hold, `transmitter`
 * molecules of acetylcholine being in the cleft: as many sites hold each
 * ligand as its share of the sites says, the open share of the receptors
 * open with an agonist on both sites, and the agonists left over sit alone
 * on a receptor that stays shut, since one ligand does not open it. Nicotine
 * takes the first sites, so the receptors it opens stay the same.
 */
export function receptorsAt(
  transmitter: number,
  treatment: Treatment,
  count: number
): readonly Receptor[] {
  const binding = bindingAt(transmitter, treatment);
  const sites = 2 * count;
  const nicotine = Math.round(sites * binding.nicotine);
  const agonists = Math.min(
    sites,
    nicotine + Math.round(sites * binding.acetylcholine)
  );
  const curare = Math.min(sites - agonists, Math.round(sites * binding.curare));
  const open = Math.min(
    Math.round(count * openAt(transmitter, treatment)),
    Math.floor(agonists / 2)
  );
  const single = agonists - 2 * open;
  // Agonist sites in order: both sites of each open receptor, then one site
  // of each receptor after them, then their second sites.
  const rank = (receptor: number, site: number) => {
    if (receptor < open) {
      return 2 * receptor + site;
    }
    return site === 0
      ? 2 * open + (receptor - open)
      : 2 * open + (count - open) + (receptor - open);
  };
  return Arr.map(Arr.range(0, count - 1), (receptor) => {
    const holds = (site: number): Ligand => {
      const order = rank(receptor, site);
      if (order < nicotine) {
        return "nicotine";
      }
      if (order < agonists && order < 2 * open + single) {
        return "acetylcholine";
      }
      return sites - 1 - order < curare ? "curare" : "empty";
    };
    return { open: receptor < open, sites: [holds(0), holds(1)] as const };
  });
}
