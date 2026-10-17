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
  TRIG_NUMBER_OPTIONS,
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
import { Badge } from "@repo/design-system/components/ui/badge";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import {
  VisualFact,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { COLORS } from "@repo/design-system/lib/color";
import { getCos, getRadians, getSin, getTan } from "@repo/math/angles";
import { Array as Arr } from "effect";

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
      <VisualCardBody className="flex flex-col gap-4">
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
        <VisualCardScene
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
          render={<section />}
        />
      </VisualCardBody>
      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {Arr.map(facts, (fact) => (
            <VisualFactTabular
              key={fact.id}
              label={fact.label}
              value={<InlineMath math={fact.math} />}
            />
          ))}
        </dl>
        <VisualCardFullscreen inert />
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
  formatNumber: (value: number, options: Intl.NumberFormatOptions) => string;
  labels: { radian: string };
}) {
  const formatApproximation = (value: number) =>
    formatNumber(value, TRIG_NUMBER_OPTIONS);
  const sin = formatTrigRatioMath(
    getSin(UNIT_CIRCLE_DEFAULT_ANGLE),
    formatApproximation
  );
  const cos = formatTrigRatioMath(
    getCos(UNIT_CIRCLE_DEFAULT_ANGLE),
    formatApproximation
  );
  const tan = formatTrigRatioMath(
    getTan(UNIT_CIRCLE_DEFAULT_ANGLE),
    formatApproximation
  );

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardBody>
          <div aria-hidden="true" className={threeSceneFrameVariants()} />
        </VisualCardBody>
        <CoordinateControls inert>
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-center gap-2 px-6">
              <Badge variant="outline">
                <InlineMath math={`\\sin\\theta ${sin}`} />
              </Badge>
              <Badge variant="outline">
                <InlineMath math={`\\cos\\theta ${cos}`} />
              </Badge>
              <Badge variant="outline">
                <InlineMath math={`\\tan\\theta ${tan}`} />
              </Badge>
            </div>

            <Separator />

            <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-6">
              <div className="flex items-center gap-2">
                <Badge style={{ color: COLORS.VIOLET }} variant="outline">
                  <InlineMath
                    math={`\\theta = ${UNIT_CIRCLE_DEFAULT_ANGLE}^\\circ`}
                  />
                </Badge>
                <Badge className="font-mono" variant="outline">
                  {formatNumber(
                    getRadians(UNIT_CIRCLE_DEFAULT_ANGLE),
                    TRIG_NUMBER_OPTIONS
                  )}{" "}
                  {labels.radian}
                </Badge>
              </div>
              <div aria-hidden="true" className={stepperVariants()} />
            </div>
          </div>
        </CoordinateControls>
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
      <VisualCardBody className="flex flex-col gap-4">
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
        <VisualCardScene
          aria-label={`${sample.symbol}, ${labels.electronTotal} ${sample.atomicNumber}`}
          className={threeSceneFrameVariants()}
          render={<section />}
        />
      </VisualCardBody>
      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
        </dl>
        <VisualCardFullscreen inert />
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
      <VisualCardBody className="flex flex-col gap-4">
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
        <VisualCardScene
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
          render={<section />}
        />
      </VisualCardBody>
      <VisualCardFooter>
        <VisualCardFullscreen inert />
      </VisualCardFooter>
    </VisualCard>
  );
}
