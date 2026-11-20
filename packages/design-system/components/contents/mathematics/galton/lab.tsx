import { useThree } from "@react-three/fiber";
import {
  binomialMean,
  binomialMode,
  binomialProbability,
  binomialSpread,
} from "@repo/design-system/components/contents/mathematics/galton/binomial";
import { MAX_ROWS } from "@repo/design-system/components/contents/mathematics/galton/board";
import { BALLS } from "@repo/design-system/components/contents/mathematics/galton/run";
import { GaltonScene } from "@repo/design-system/components/contents/mathematics/galton/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import { type ReactNode, Suspense, useState } from "react";

/** The biases the learner can give the board: leaning left, upright, leaning right. */
const BIASES = [0.3, 0.5, 0.7] as const;

/** The fewest rows of pins the learner can set. */
const MIN_ROWS = 4;

/**
 * A Galton board: steel balls drop from a hopper through rows of brass pins.
 * At each pin a ball goes right with probability p, so the bin it lands in
 * counts its rights, k, and the bins fill toward the binomial counts,
 * balls × C(n, k) p^k (1 - p)^(n - k), which marks printed on the glass show
 * as the balls land. The learner sets the rows and leans the board to bias
 * every bounce, and reads the mean np and the spread of the square root of
 * np(1 - p). Without `showExpected`, as in a question that asks for them,
 * the glass carries no marks and the footer counts the balls landed only.
 */
export function GaltonBoardLab({
  description,
  labels,
  probability,
  rows: startRows,
  showExpected = false,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly balls: ReactNode;
    readonly expected: ReactNode;
    readonly mean: ReactNode;
    readonly rows: string;
    readonly spread: ReactNode;
    readonly tilt: string;
    readonly viewLabel: string;
  };
  readonly probability: number;
  readonly rows: number;
  readonly showExpected?: boolean;
  readonly title: NonNullable<ReactNode>;
}) {
  const quantity = useQuantity();
  const [rows, setRows] = useState(startRows);
  const [p, setP] = useState(probability);
  const [landed, setLanded] = useState(BALLS);
  const mode = binomialMode(rows, p);
  const share = quantity(p, "", 1);
  const rest = quantity(1 - p, "", 1);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 items-center">
          <Slider
            aria-label={labels.rows}
            max={MAX_ROWS}
            min={MIN_ROWS}
            onValueChange={(value: number) => setRows(value)}
            step={1}
            value={rows}
          />
        </div>
        <ToggleGroup
          aria-label={labels.tilt}
          onValueChange={(value: string) => {
            Option.map(
              Arr.findFirst(BIASES, (each) => String(each) === value),
              setP
            );
          }}
          type="single"
          value={String(p)}
          variant="outline"
        >
          {Arr.map(BIASES, (each) => (
            <ToggleGroupItem key={each} value={String(each)}>
              <InlineMath math={`p = ${quantity(each, "", 1)}`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.5} setting="studio">
          <GaltonCamera />
          <Suspense fallback={null}>
            <GaltonScene
              onLanded={setLanded}
              p={p}
              rows={rows}
              showExpected={showExpected}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.rows}
            value={<InlineMath math={`n = ${rows}`} />}
          />
          <VisualFactTabular
            label={labels.balls}
            value={<InlineMath math={quantity(landed, "", 0)} />}
          />
          {showExpected ? (
            <>
              <VisualFactTabular
                label={labels.mean}
                value={
                  <InlineMath
                    math={`np = ${rows} \\times ${share} = ${quantity(binomialMean(rows, p), "", 1)}`}
                  />
                }
              />
              <VisualFactTabular
                label={labels.spread}
                value={
                  <InlineMath
                    math={`\\sqrt{np(1-p)} = ${quantity(binomialSpread(rows, p), "", 2)}`}
                  />
                }
              />
              <VisualFactTabular
                label={labels.expected}
                value={
                  <InlineMath
                    math={`\\binom{${rows}}{${mode}} (${share})^{${mode}} (${rest})^{${rows - mode}} \\approx ${quantity(binomialProbability(rows, p, mode), "", 3)}`}
                  />
                }
              />
            </>
          ) : null}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Looks at the board's face from a little right of and above its middle, farther back on a narrow card. */
function GaltonCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 1.38 : 1.3;
  return (
    <CameraControls
      cameraPosition={[distance * 0.16, 0.38, distance]}
      cameraTarget={[0, 0.33, 0]}
      fov={32}
      maxDistance={distance * 1.8}
      minDistance={0.25}
    />
  );
}
