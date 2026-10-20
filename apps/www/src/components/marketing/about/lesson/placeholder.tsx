import { BIOLOGY_DEFAULT_ITEM_INDEX } from "@repo/design-system/components/contents/biology/data";
import {
  ATOM_SHELL_SAMPLE_IDS,
  ATOM_SHELL_SAMPLES,
  CALCIUM_ID,
} from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import { getAtomShellReadings } from "@repo/design-system/components/contents/chemistry/atom-shell/readings";
import { stepperVariants } from "@repo/design-system/components/contents/mathematics/stepper";
import {
  formatTrigRatioMath,
  QUADRANT_NUMERALS,
  UNIT_CIRCLE_DEFAULT_ANGLE,
} from "@repo/design-system/components/contents/mathematics/trig";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import {
  DEFAULT_PARABOLIC_LAUNCH_ID,
  formatAngleMath,
  getParabolicMotionState,
  PARABOLIC_LAUNCHES,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import {
  getParabolicFacts,
  type ParabolicFactLabels,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/facts";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import {
  VisualFact,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import {
  getCos,
  getQuadrant,
  getRadians,
  getSin,
  getTan,
} from "@repo/math/angles";
import { Array as Arr, Option } from "effect";

/**
 * The card of the projectile lesson at its default launch, drawn before its lab
 * loads. It has the same parts as the lab, with its controls as static items and
 * an empty frame where the scene goes, so the lab takes over the same box.
 */
export function ProjectilePlaceholder({
  decimalSeparator,
  labels,
}: {
  decimalSeparator: DecimalSeparator;
  labels: {
    chooseLaunch: string;
    factLabels: ParabolicFactLabels;
    viewLabel: string;
  };
}) {
  const motion = getParabolicMotionState(DEFAULT_PARABOLIC_LAUNCH_ID);
  const facts = getParabolicFacts(motion, decimalSeparator, labels.factLabels);

  return (
    <VisualCard>
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseLaunch}
          gridColumns="3"
          inert
          type="single"
          value={DEFAULT_PARABOLIC_LAUNCH_ID}
          variant="outline"
        >
          {Arr.map(PARABOLIC_LAUNCHES, (launch) => (
            <ToggleGroupItem key={launch.id} value={launch.id}>
              <InlineMath math={formatAngleMath(launch.angleDegrees)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      />
      <VisualCardSceneActions inert />
      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(facts, (fact) => (
            <VisualFactTabular
              key={fact.id}
              label={fact.label}
              value={<InlineMath math={fact.math} />}
            />
          ))}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The card of the circle lesson at its default angle, drawn before its lab loads.
 * The number field is a static box of the same frame, and the scene an empty
 * frame, so the lab takes over the same box.
 */
export function CirclePlaceholder({
  formatNumber,
  labels,
}: {
  formatNumber: (value: number) => string;
  labels: { onAxis: string; quadrant: string; radian: string };
}) {
  const sin = formatTrigRatioMath(
    getSin(UNIT_CIRCLE_DEFAULT_ANGLE),
    formatNumber
  );
  const cos = formatTrigRatioMath(
    getCos(UNIT_CIRCLE_DEFAULT_ANGLE),
    formatNumber
  );
  const tan = formatTrigRatioMath(
    getTan(UNIT_CIRCLE_DEFAULT_ANGLE),
    formatNumber
  );

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardToolbar>
          <div className="mx-auto flex w-full max-w-md flex-col">
            <div aria-hidden="true" className={stepperVariants()} />
          </div>
        </VisualCardToolbar>
        {/* The unit circle draws its frame inside its body, as this does. */}
        <VisualCardBody aria-hidden="true">
          <div className={threeSceneFrameVariants()} />
        </VisualCardBody>
        <CoordinateControls inert />
        <VisualCardFooter>
          <VisualCardFacts>
            <VisualFact
              label={<InlineMath math="\theta" />}
              value={
                <InlineMath math={`${UNIT_CIRCLE_DEFAULT_ANGLE}^\\circ`} />
              }
            />
            <VisualFact
              label={labels.radian}
              value={formatNumber(getRadians(UNIT_CIRCLE_DEFAULT_ANGLE))}
            />
            <VisualFact
              label={<InlineMath math="\sin\theta" />}
              value={<InlineMath math={sin} />}
            />
            <VisualFact
              label={<InlineMath math="\cos\theta" />}
              value={<InlineMath math={cos} />}
            />
            <VisualFact
              label={<InlineMath math="\tan\theta" />}
              value={<InlineMath math={tan} />}
            />
            <VisualFact
              label={labels.quadrant}
              value={Option.match(getQuadrant(UNIT_CIRCLE_DEFAULT_ANGLE), {
                onNone: () => labels.onAxis,
                onSome: (quadrant) => QUADRANT_NUMERALS[quadrant - 1],
              })}
            />
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}

/**
 * The card of the atom lesson at its default sample, drawn before its lab loads:
 * the same toggles, frame and facts, with the toggles as static items.
 */
export function AtomPlaceholder({
  labels,
}: {
  labels: {
    atomicNumber: string;
    chooseAtom: string;
    configuration: string;
    electronTotal: string;
    maximumCapacity: string;
    outerShell: string;
  };
}) {
  const sample = ATOM_SHELL_SAMPLES[CALCIUM_ID];
  const { configurationMath, outerShell } = getAtomShellReadings(
    sample.atomicNumber
  );

  return (
    <VisualCard>
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseAtom}
          gridColumns="6"
          inert
          type="single"
          value={CALCIUM_ID}
          variant="outline"
        >
          {Arr.map(ATOM_SHELL_SAMPLE_IDS, (sampleId) => (
            <ToggleGroupItem key={sampleId} value={sampleId}>
              <InlineMath
                math={`\\mathrm{${ATOM_SHELL_SAMPLES[sampleId].symbol}}`}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={`${sample.symbol}, ${labels.electronTotal} ${sample.atomicNumber}`}
        className={threeSceneFrameVariants()}
        render={<section />}
      />
      <VisualCardSceneActions inert />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.atomicNumber}
            value={<InlineMath math={`Z = ${sample.atomicNumber}`} />}
          />
          <VisualFact
            label={labels.configuration}
            value={<InlineMath math={configurationMath} />}
          />
          <VisualFact
            label={labels.outerShell}
            value={<InlineMath math={`\\mathrm{${outerShell.key}}`} />}
          />
          <VisualFact
            label={labels.maximumCapacity}
            value={
              <InlineMath
                math={`2(${outerShell.principalQuantumNumber})^2 = ${outerShell.maximumElectrons}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The card of the cell lesson at its default item, drawn before its lab loads:
 * the same item toggles and frame, with the toggles as static items.
 */
export function CellPlaceholder({
  labels,
}: {
  labels: {
    chooseMode: string;
    items: readonly { tab: string }[];
    viewLabel: string;
  };
}) {
  return (
    <VisualCard>
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseMode}
          gridColumns="auto"
          inert
          type="single"
          value={String(BIOLOGY_DEFAULT_ITEM_INDEX)}
          variant="outline"
        >
          {Arr.map(labels.items, (item, index) => (
            <ToggleGroupItem key={item.tab} value={String(index)}>
              {item.tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      />
      <VisualCardSceneActions inert />
    </VisualCard>
  );
}
