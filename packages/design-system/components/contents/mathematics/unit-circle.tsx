import {
  formatTrigRatioMath,
  QUADRANT_NUMERALS,
  TRIG_NUMBER_OPTIONS,
  UNIT_CIRCLE_DEFAULT_ANGLE,
} from "@repo/design-system/components/contents/mathematics/trig";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import {
  getCos,
  getQuadrant,
  getRadians,
  getSin,
  getTan,
} from "@repo/math/angles";
import { Option } from "effect";
import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  use,
  useState,
} from "react";
import { useFormatter, useTranslations } from "use-intl";

/** The scene loads once the card asks for it, and its frame holds the place meanwhile. */
const UnitCircleStage = lazy(() =>
  import("@repo/design-system/components/three/unit-circle").then((module) => ({
    default: module.UnitCircleStage,
  }))
);

interface CardProps {
  /** The angle the card shows until the reader picks another. */
  angle?: number | undefined;
  /** The card's header. A lesson page names its unit circle with a title and a description. */
  header?: ReactNode;
  /**
   * Whether the three-dimensional scene is mounted. A card that is not live keeps
   * its whole frame in place, with an empty frame where the scene goes.
   */
  live?: boolean;
  /** Reports each angle the reader picks, so a window can keep it while this card is unmounted. */
  onAngleChange?: (angle: number) => void;
  /** Exact trigonometric values as fractions (e.g., "5/13", "12/13", "5/12") */
  trigValues?:
    | {
        sin?: string;
        cos?: string;
        tan?: string;
      }
    | undefined;
  /** The name of the scene for assistive technology. */
  viewLabel?: string | undefined;
}

interface Props {
  angle?: number | undefined;
  description: ReactNode;
  title: ReactNode;
  /** Exact trigonometric values as fractions (e.g., "5/13", "12/13", "5/12") */
  trigValues?: CardProps["trigValues"];
}

/** The configuration of one unit-circle card, shared by its scene, its controls and its values. */
interface UnitCircleConfig {
  angle: number;
  live: boolean;
  onAngleChange: ((angle: number) => void) | undefined;
  trigValues: CardProps["trigValues"];
  viewLabel: string | undefined;
}

const UnitCircleContext = createContext<UnitCircleConfig | null>(null);

/** Provides one unit-circle card's configuration and its coordinate controls. */
function UnitCircleProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: UnitCircleConfig;
}) {
  return (
    <CoordinateProvider>
      <UnitCircleContext value={config}>{children}</UnitCircleContext>
    </CoordinateProvider>
  );
}

/** Reads the configuration of the surrounding unit-circle card. */
function useUnitCircle() {
  const config = use(UnitCircleContext);
  if (!config) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("useUnitCircle must be used within UnitCircleProvider");
  }
  return config;
}

/** The visual card that holds a unit circle's header, its controls, and its values. */
function UnitCircleFrame({ children }: { children: ReactNode }) {
  return (
    <VisualCard>
      {children}
      <Content />
    </VisualCard>
  );
}

/**
 * The unit circle as a visual card without a header. The scene, its angle
 * controls and the trigonometric values of the angle are all in the card; the
 * page or the window that holds the card names the lesson.
 */
export function UnitCircleCard({
  angle = UNIT_CIRCLE_DEFAULT_ANGLE,
  header,
  live = true,
  onAngleChange,
  trigValues,
  viewLabel,
}: CardProps) {
  const config = { angle, live, onAngleChange, trigValues, viewLabel };

  return (
    <UnitCircleProvider config={config}>
      <UnitCircleFrame>{header}</UnitCircleFrame>
    </UnitCircleProvider>
  );
}

/** The unit circle of a lesson page, with the title and description of its lesson. */
export function UnitCircle({
  title,
  description,
  angle = UNIT_CIRCLE_DEFAULT_ANGLE,
  trigValues,
}: Props) {
  const config = {
    angle,
    live: true,
    onAngleChange: undefined,
    trigValues,
    viewLabel: undefined,
  };

  return (
    <UnitCircleProvider config={config}>
      <UnitCircleFrame>
        <VisualCardHeader description={description} title={title} />
      </UnitCircleFrame>
    </UnitCircleProvider>
  );
}

function Content() {
  const t = useTranslations("Common");
  const format = useFormatter();
  const { angle, live, onAngleChange, trigValues, viewLabel } = useUnitCircle();
  const [angleOverride, setAngleOverride] = useState<number | null>(null);
  const angleValue = angleOverride ?? angle;
  const exactValues = angleValue === angle ? trigValues : undefined;

  function formatRatio(value: number, exactValue?: string) {
    return formatTrigRatioMath(
      value,
      (approximation) => format.number(approximation, TRIG_NUMBER_OPTIONS),
      exactValue
    );
  }

  return (
    <>
      <VisualCardToolbar>
        <div className="mx-auto w-full max-w-md">
          <NumberField
            onValueChange={(value) => {
              if (value !== null) {
                setAngleOverride(value);
                onAngleChange?.(value);
              }
            }}
            value={angleValue}
          >
            <NumberFieldGroup>
              <NumberFieldDecrement aria-label={t("decrease-angle")} />
              <NumberFieldInput
                aria-label={t("angle")}
                className="font-mono"
                placeholder={`${UNIT_CIRCLE_DEFAULT_ANGLE}`}
              />
              <NumberFieldIncrement aria-label={t("increase-angle")} />
            </NumberFieldGroup>
          </NumberField>
        </div>
      </VisualCardToolbar>

      {/* The loading frame and the stage share this band, so nothing moves when the stage mounts. */}
      <VisualCardBody className="group-data-fullscreen/visual:justify-center">
        {live ? (
          <Suspense fallback={<ScenePlaceholder />}>
            <UnitCircleStage angle={angleValue} viewLabel={viewLabel} />
          </Suspense>
        ) : (
          <div aria-hidden="true" className={threeSceneFrameVariants()} />
        )}
      </VisualCardBody>
      <CoordinateControls />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={<InlineMath math="\theta" />}
            value={<InlineMath math={`${angleValue}^\\circ`} />}
          />
          <VisualFact
            label={t("radian")}
            value={format.number(getRadians(angleValue), TRIG_NUMBER_OPTIONS)}
          />
          <VisualFact
            label={<InlineMath math="\sin\theta" />}
            value={
              <InlineMath
                math={formatRatio(getSin(angleValue), exactValues?.sin)}
              />
            }
          />
          <VisualFact
            label={<InlineMath math="\cos\theta" />}
            value={
              <InlineMath
                math={formatRatio(getCos(angleValue), exactValues?.cos)}
              />
            }
          />
          <VisualFact
            label={<InlineMath math="\tan\theta" />}
            value={
              Number.isFinite(getTan(angleValue)) ? (
                <InlineMath
                  math={formatRatio(getTan(angleValue), exactValues?.tan)}
                />
              ) : (
                t("undefined")
              )
            }
          />
          <VisualFact
            label={t("quadrant")}
            value={Option.match(getQuadrant(angleValue), {
              onNone: () => t("on-axis"),
              onSome: (quadrant) => QUADRANT_NUMERALS[quadrant - 1],
            })}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </>
  );
}
