import type { Moment } from "@repo/design-system/components/contents/biology/heart/circulation";
import {
  contraction,
  steadyBeat,
} from "@repo/design-system/components/contents/biology/heart/circulation";
import { Array as Arr, Match, Option, Schema } from "effect";

/**
 * How much blood the left ventricle holds when it has filled (end-diastolic)
 * and when it has emptied (end-systolic), in millilitres. A resting adult
 * fills to about 120 to 130 mL and keeps 50 to 60 mL (OpenStax Anatomy and
 * Physiology 2e, 19.3), so the ventricle must keep less than it filled with.
 */
export const VolumesSchema = Schema.Struct({
  endDiastolic: Schema.Finite,
  endSystolic: Schema.Finite,
}).check(
  Schema.makeFilter(
    ({ endDiastolic, endSystolic }) =>
      endSystolic > 0 && endSystolic < endDiastolic,
    {
      message:
        "Expected an end-systolic volume above 0 and below the end-diastolic volume.",
    }
  )
);
type Volumes = typeof VolumesSchema.Type;

/**
 * The five stages of one cardiac cycle: the atria contract (`atrial`), the
 * ventricle tightens with every valve shut (`contraction`), pushes blood out
 * through the open semilunar valves (`ejection`), slackens with every valve
 * shut again (`relaxation`), and fills through the open atrioventricular
 * valves (`filling`).
 */
const StageSchema = Schema.Literals([
  "atrial",
  "contraction",
  "ejection",
  "relaxation",
  "filling",
]);
export type Stage = typeof StageSchema.Type;

/** The three phases a learner names: atrial systole, ventricular systole and diastole. */
const PhaseSchema = Schema.Literals(["atrial", "ventricular", "diastole"]);
export type Phase = typeof PhaseSchema.Type;

/**
 * The heart rates the lab offers, in beats a minute: from the slow resting
 * rate of a trained athlete up to the 200 a young adult reaches at most
 * (OpenStax Anatomy and Physiology 2e, 19.4).
 */
export const RATES = { maximum: 200, minimum: 40 };

/** How many moments the lab records of one beat. */
const SAMPLES = 240;

/**
 * The times within a beat, in seconds after the ventricle starts to
 * contract, at which the mitral valve shuts (`close`), the aortic valve
 * opens (`open`) and shuts (`shut`), the mitral valve opens again
 * (`refill`), and the atrium starts to contract (`atrium`).
 */
const EventsSchema = Schema.Struct({
  atrium: Schema.Finite,
  close: Schema.Finite,
  open: Schema.Finite,
  refill: Schema.Finite,
  shut: Schema.Finite,
});
type Events = typeof EventsSchema.Type;

/**
 * Reads when each valve moves from the recorded moments of one beat, each
 * the first moment its leaflets reach the new state. A beat with no such
 * moment, which only a stopped heart has, keeps the valve's last event.
 */
export function valveEvents(
  moments: readonly Moment[],
  period: number
): Events {
  const first = (
    after: number,
    found: (moment: Moment) => boolean,
    otherwise: number
  ) =>
    Option.getOrElse(
      Option.map(
        Arr.findFirst(
          moments,
          (moment) => moment.time >= after && found(moment)
        ),
        (moment) => moment.time
      ),
      () => otherwise
    );
  const close = first(0, (moment) => moment.mitral === 0, 0);
  const open = first(close, (moment) => moment.aortic > 0, close);
  const shut = first(open, (moment) => moment.aortic === 0, open);
  const refill = first(shut, (moment) => moment.mitral > 0, shut);
  return { atrium: contraction(period).atrium, close, open, refill, shut };
}

/**
 * One beat at `rate` beats a minute, drawn for a ventricle that fills to
 * `volumes.endDiastolic` and empties to `volumes.endSystolic`. Scaling every
 * volume of the model by one factor and shifting it by one offset, with its
 * elastances, compliances and valve areas scaled to match, leaves every
 * pressure where it was, so the pressures are the model's own while the
 * volumes are this heart's.
 */
export function heartBeat(rate: number, volumes: Volumes) {
  const period = 60 / rate;
  const model = steadyBeat(rate, SAMPLES);
  const sizes = Arr.map(model, (moment) => moment.volume);
  const emptiest = Math.min(...sizes);
  const scale =
    (volumes.endDiastolic - volumes.endSystolic) /
    (Math.max(...sizes) - emptiest);
  const moments = Arr.map(model, (moment) => ({
    ...moment,
    inflow: moment.inflow * scale,
    outflow: moment.outflow * scale,
    reserve: moment.reserve * scale,
    volume: volumes.endSystolic + (moment.volume - emptiest) * scale,
  }));
  const reserves = Arr.map(moments, (moment) => moment.reserve);
  return {
    events: valveEvents(moments, period),
    moments,
    period,
    reserve: { maximum: Math.max(...reserves), minimum: Math.min(...reserves) },
  };
}
export type Beat = ReturnType<typeof heartBeat>;

/** Mixes two numbers, `share` of the way from `from` to `to`. */
function mix(from: number, to: number, share: number) {
  return from + (to - from) * share;
}

/**
 * The state of the beat at `time` seconds, looped over the beat and
 * interpolated between the two recorded moments around it.
 */
export function momentAt(beat: Beat, time: number): Moment {
  const count = beat.moments.length;
  const place =
    ((((time % beat.period) + beat.period) % beat.period) / beat.period) *
    count;
  const index = Math.floor(place);
  const share = place - index;
  const before = Arr.getUnsafe(beat.moments, index % count);
  const after = Arr.getUnsafe(beat.moments, (index + 1) % count);
  return {
    aorta: mix(before.aorta, after.aorta, share),
    aortic: mix(before.aortic, after.aortic, share),
    atrium: mix(before.atrium, after.atrium, share),
    inflow: mix(before.inflow, after.inflow, share),
    mitral: mix(before.mitral, after.mitral, share),
    outflow: mix(before.outflow, after.outflow, share),
    reserve: mix(before.reserve, after.reserve, share),
    time: (place / count) * beat.period,
    ventricle: mix(before.ventricle, after.ventricle, share),
    volume: mix(before.volume, after.volume, share),
  };
}

/** The stage of the cycle at `time` seconds into a beat with these valve events. */
export function stageAt(events: Events, time: number): Stage {
  if (time < events.close || time >= events.atrium) {
    return "atrial";
  }
  if (time < events.open) {
    return "contraction";
  }
  if (time < events.shut) {
    return "ejection";
  }
  return time < events.refill ? "relaxation" : "filling";
}

/** The phase a learner names for a stage: the two systoles and diastole. */
export const phaseOf = Match.type<Stage>().pipe(
  Match.when("atrial", (): Phase => "atrial"),
  Match.whenOr("contraction", "ejection", (): Phase => "ventricular"),
  Match.orElse((): Phase => "diastole")
);

/** The stroke volume: what the ventricle pushes out each beat, in millilitres. */
export function strokeVolume(volumes: Volumes) {
  return volumes.endDiastolic - volumes.endSystolic;
}

/** The cardiac output: what the ventricle pushes out each minute, in litres. */
export function cardiacOutput(volumes: Volumes, rate: number) {
  return (strokeVolume(volumes) * rate) / 1000;
}
