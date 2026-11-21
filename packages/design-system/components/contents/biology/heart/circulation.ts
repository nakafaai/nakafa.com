/**
 * The left heart and the systemic arteries as a lumped model: the cardiac
 * model of Korakianitis and Shi (J Biomech 2006;39:1964-1982) with the
 * parameters Scarsoglio, Guala, Camporeale and Ridolfi publish for it
 * ("Impact of atrial fibrillation on the cardiovascular system through a
 * lumped-parameter approach", Med Biol Eng Comput 2014, arXiv:1409.2814,
 * Online Resource 1, Tables 4 to 8). Each chamber's pressure follows its
 * volume through an elastance that rises as its muscle contracts; blood
 * crosses a valve as the square root of the pressure across it, and only as
 * far as its leaflets have opened; the leaflets swing on the pressure and the
 * flow, so every valve opens and shuts on the pressures alone.
 *
 * The full model closes the loop through the lungs and the right heart. Here
 * the pulmonary veins and the systemic veins are held at the mean pressures
 * the full model reaches in normal sinus rhythm (Table 2), so one beat
 * settles in a few seconds. Pressures are in mmHg, volumes in millilitres,
 * flows in millilitres a second and times in seconds.
 */

import { MutableList, Schema } from "effect";

/** The chambers: elastances in mmHg/mL, unstressed pressure in mmHg and volume in mL (Table 4). */
const VENTRICLE = { maximum: 2.5, minimum: 0.07, pressure: 1, volume: 5 };
const ATRIUM = { maximum: 0.25, minimum: 0.15, pressure: 1, volume: 4 };

/** How freely each open valve passes blood, in mL/(s mmHg^0.5) (Table 4). */
const MITRAL_FLOW = 400;
const AORTIC_FLOW = 350;

/**
 * The aortic sinus and the systemic arteries: compliance in mL/mmHg,
 * resistance in mmHg s/mL and inertance in mmHg s^2/mL (Table 5). The
 * arterioles (0.5) and capillaries (0.52) add their resistance to the
 * arteries'.
 */
const SINUS = { compliance: 0.08, inertance: 0.000_062, resistance: 0.003 };
const ARTERIES = {
  compliance: 1.6,
  inertance: 0.0017,
  resistance: 0.05 + 0.5 + 0.52,
};

/** The resistance of the pulmonary veins as they enter the left atrium, in mmHg s/mL (Table 6). */
const PULMONARY_RESISTANCE = 0.006;

/** The mean pressures of the pulmonary and systemic veins in normal sinus rhythm, in mmHg (Table 2). */
const PULMONARY_VEINS = 9.6;
const SYSTEMIC_VEINS = 13.89;

/**
 * The leaflets' equation of motion (Table 7): the pressure across them
 * (`push`), friction (`drag`), the drag of the passing blood (`flow`), and
 * the vortex behind an open leaflet (`vortex`), which closes it as the jet
 * slows. A leaflet swings from shut (0) to fully open at 75 degrees.
 */
const LEAFLET = { drag: 50, flow: 2, push: 5500, widest: (5 * Math.PI) / 12 };
const MITRAL_VORTEX = 3.5;
const AORTIC_VORTEX = 7;

/** How long the model runs before it records a beat, so the arteries settle: four of their time constants. */
const SETTLE = 8;

/** The step the model takes at most, in seconds. */
const STEP = 0.0002;

/**
 * When, in seconds after the ventricle starts to contract, its elastance
 * peaks (`peak`) and returns to rest (`rest`), and when the atrium starts to
 * contract (`atrium`), for one beat of `period` seconds (Table 8). Systole
 * scales with the square root of the period, as Bazett's QT does, while the
 * atrium always takes the last eighth of the beat, so diastole shortens far
 * more than systole as the heart speeds up.
 */
export function contraction(period: number) {
  const peak = 0.3 * Math.sqrt(period);
  return { atrium: 0.875 * period, peak, rest: 1.5 * peak };
}

/**
 * How far the ventricle has contracted at `time` into its beat: 0 at rest,
 * 2 at the peak, rising and falling along half cosines (Eq. 10).
 */
export function ventricleDrive(time: number, period: number) {
  const { peak, rest } = contraction(period);
  if (time < peak) {
    return 1 - Math.cos((Math.PI * time) / peak);
  }
  if (time < rest) {
    return 1 + Math.cos((Math.PI * (time - peak)) / (rest - peak));
  }
  return 0;
}

/** How far the atrium has contracted at `time` into the beat: 0 at rest, 2 at its peak (Eq. 5). */
export function atriumDrive(time: number, period: number) {
  const { atrium } = contraction(period);
  if (time <= atrium) {
    return 0;
  }
  return 1 - Math.cos((2 * Math.PI * (time - atrium)) / (period - atrium));
}

/**
 * The flow through an orifice of conductance `conductance` whose pressure
 * difference after the step is `head - lag × flow`: the backward-Euler
 * solution of flow = conductance × sign × √|difference|, which keeps the
 * stiff valve stable at any step.
 */
function orifice(conductance: number, head: number, lag: number) {
  if (conductance === 0 || head === 0) {
    return 0;
  }
  const spread = conductance * conductance * lag;
  return (
    (Math.sign(head) *
      (Math.sqrt(spread * spread + 4 * conductance ** 2 * Math.abs(head)) -
        spread)) /
    2
  );
}

/** The share of a valve's full area its leaflets open at `angle` (Eq. 6). */
function openArea(angle: number) {
  return ((1 - Math.cos(angle)) / (1 - Math.cos(LEAFLET.widest))) ** 2;
}

/** One leaflet's angle, in radians from shut, and its angular speed. */
const LeafletSchema = Schema.Struct({
  angle: Schema.Finite,
  speed: Schema.Finite,
});
type Leaflet = typeof LeafletSchema.Type;

/** Swings a leaflet through one step under the pressure across it and the flow through it (Eq. 7). */
function swing(
  leaflet: Leaflet,
  pressure: number,
  flow: number,
  vortex: number,
  step: number
) {
  const cosine = Math.cos(leaflet.angle);
  const wake = flow >= 0 ? vortex * flow * Math.sin(2 * leaflet.angle) : 0;
  const speed =
    leaflet.speed +
    step *
      (pressure * LEAFLET.push * cosine -
        LEAFLET.drag * leaflet.speed +
        LEAFLET.flow * flow * cosine -
        wake);
  const angle = leaflet.angle + step * speed;
  if (angle <= 0) {
    return { angle: 0, speed: 0 };
  }
  if (angle >= LEAFLET.widest) {
    return { angle: LEAFLET.widest, speed: 0 };
  }
  return { angle, speed };
}

/**
 * One recorded moment of a beat: the time since the ventricle started to
 * contract; the pressures in the left atrium, the left ventricle and the
 * aorta; the volumes of the left ventricle and the left atrium; the flows
 * through the mitral and aortic valves; and how far each valve's leaflets
 * stand open, from 0 (shut) to 1 (fully open).
 */
const MomentSchema = Schema.Struct({
  aorta: Schema.Finite,
  aortic: Schema.Finite,
  atrium: Schema.Finite,
  inflow: Schema.Finite,
  mitral: Schema.Finite,
  outflow: Schema.Finite,
  reserve: Schema.Finite,
  time: Schema.Finite,
  ventricle: Schema.Finite,
  volume: Schema.Finite,
});
export type Moment = typeof MomentSchema.Type;

/**
 * Runs the model at `rate` beats a minute until the arteries settle, then
 * records the last beat at `samples` evenly spaced moments, the first as the
 * ventricle starts to contract.
 */
export function steadyBeat(rate: number, samples: number): readonly Moment[] {
  const period = 60 / rate;
  const substeps = Math.ceil(period / samples / STEP);
  const step = period / samples / substeps;
  const beats = Math.ceil(SETTLE / period) + 1;
  const recorded = MutableList.make<Moment>();
  let atrium = 60;
  let ventricle = 120;
  let sinus = 100;
  let sinusFlow = 80;
  let arteries = 100;
  let arterialFlow = 80;
  let mitral: Leaflet = { angle: 0, speed: 0 };
  let aortic: Leaflet = { angle: 0, speed: 0 };

  for (let beat = 0; beat < beats; beat += 1) {
    for (let index = 0; index < samples * substeps; index += 1) {
      const time = index * step;
      const atrialElastance =
        ATRIUM.minimum +
        ((ATRIUM.maximum - ATRIUM.minimum) / 2) * atriumDrive(time, period);
      const ventricularElastance =
        VENTRICLE.minimum +
        ((VENTRICLE.maximum - VENTRICLE.minimum) / 2) *
          ventricleDrive(time, period);
      const atrialPressure =
        ATRIUM.pressure + atrialElastance * (atrium - ATRIUM.volume);
      const ventricularPressure =
        VENTRICLE.pressure +
        ventricularElastance * (ventricle - VENTRICLE.volume);
      const venous = (PULMONARY_VEINS - atrialPressure) / PULMONARY_RESISTANCE;
      const inflow = orifice(
        MITRAL_FLOW * openArea(mitral.angle),
        atrialPressure - ventricularPressure + step * atrialElastance * venous,
        step * (atrialElastance + ventricularElastance)
      );
      const outflow = orifice(
        AORTIC_FLOW * openArea(aortic.angle),
        ventricularPressure - sinus + (step * sinusFlow) / SINUS.compliance,
        step * (ventricularElastance + 1 / SINUS.compliance)
      );
      if (beat === beats - 1 && index % substeps === 0) {
        MutableList.append(recorded, {
          aorta: sinus,
          aortic: aortic.angle / LEAFLET.widest,
          atrium: atrialPressure,
          inflow,
          mitral: mitral.angle / LEAFLET.widest,
          outflow,
          reserve: atrium,
          time,
          ventricle: ventricularPressure,
          volume: ventricle,
        });
      }
      mitral = swing(
        mitral,
        atrialPressure - ventricularPressure,
        inflow,
        MITRAL_VORTEX,
        step
      );
      aortic = swing(
        aortic,
        ventricularPressure - sinus,
        outflow,
        AORTIC_VORTEX,
        step
      );
      atrium += step * (venous - inflow);
      ventricle += step * (inflow - outflow);
      sinus += (step * (outflow - sinusFlow)) / SINUS.compliance;
      sinusFlow =
        (sinusFlow + (step * (sinus - arteries)) / SINUS.inertance) /
        (1 + (step * SINUS.resistance) / SINUS.inertance);
      arteries += (step * (sinusFlow - arterialFlow)) / ARTERIES.compliance;
      arterialFlow =
        (arterialFlow +
          (step * (arteries - SYSTEMIC_VEINS)) / ARTERIES.inertance) /
        (1 + (step * ARTERIES.resistance) / ARTERIES.inertance);
    }
  }
  return MutableList.toArray(recorded);
}
