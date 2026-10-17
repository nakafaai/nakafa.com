"use client";

import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { stepperVariants } from "@repo/design-system/components/contents/mathematics/stepper";
import {
  formatTrigRatioMath,
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
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  VisualCard,
  VisualCardBody,
  VisualCardControls,
  VisualCardGroup,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { COLORS } from "@repo/design-system/lib/color";
import { getCos, getRadians, getSin, getTan } from "@repo/math/angles";
import dynamic from "next/dynamic";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import {
  Button,
  Group,
  I18nProvider,
  Input,
  Label,
  NumberField,
} from "react-aria-components";

/** The scene loads once the card asks for it, and its frame holds the place meanwhile. */
const UnitCircleStage = dynamic(
  () =>
    import("@repo/design-system/components/three/unit-circle").then(
      ({ UnitCircleStage }) => UnitCircleStage
    ),
  { loading: ScenePlaceholder }
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
  const locale = useLocale();

  return (
    <CoordinateProvider>
      <VisualCard>
        {header}
        <I18nProvider locale={locale}>
          <Content
            angle={angle}
            live={live}
            onAngleChange={onAngleChange}
            trigValues={trigValues}
            viewLabel={viewLabel}
          />
        </I18nProvider>
      </VisualCard>
    </CoordinateProvider>
  );
}

/** The unit circle of a lesson page, with the title and description of its lesson. */
export function UnitCircle({
  title,
  description,
  angle = UNIT_CIRCLE_DEFAULT_ANGLE,
  trigValues,
}: Props) {
  return (
    <UnitCircleCard
      angle={angle}
      header={<VisualCardHeader description={description} title={title} />}
      trigValues={trigValues}
    />
  );
}

function Content({
  angle,
  live,
  onAngleChange,
  trigValues,
  viewLabel,
}: {
  angle: number;
  live: boolean;
  onAngleChange: ((angle: number) => void) | undefined;
  trigValues?: CardProps["trigValues"];
  viewLabel: string | undefined;
}) {
  const t = useTranslations("Common");
  const format = useFormatter();
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
      <VisualCardBody>
        {live ? (
          <UnitCircleStage angle={angleValue} viewLabel={viewLabel} />
        ) : (
          <div aria-hidden="true" className={threeSceneFrameVariants()} />
        )}
        <VisualCardControls>
          <VisualCardGroup>
            <Badge variant="outline">
              <InlineMath
                math={`\\sin\\theta ${formatRatio(getSin(angleValue), exactValues?.sin)}`}
              />
            </Badge>
            <Badge variant="outline">
              <InlineMath
                math={`\\cos\\theta ${formatRatio(getCos(angleValue), exactValues?.cos)}`}
              />
            </Badge>
            <Badge variant="outline">
              {Number.isFinite(getTan(angleValue)) ? (
                <InlineMath
                  math={`\\tan\\theta ${formatRatio(getTan(angleValue), exactValues?.tan)}`}
                />
              ) : (
                <>
                  <InlineMath math="\tan\theta" />: {t("undefined")}
                </>
              )}
            </Badge>
          </VisualCardGroup>

          <Separator />

          <div className="mx-auto flex w-full max-w-md flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge style={{ color: COLORS.VIOLET }} variant="outline">
                <InlineMath math={`\\theta = ${angleValue}^\\circ`} />
              </Badge>
              <Badge className="font-mono" variant="outline">
                {format.number(getRadians(angleValue), TRIG_NUMBER_OPTIONS)}{" "}
                {t("radian")}
              </Badge>
            </div>

            <NumberField
              decrementAriaLabel={t("decrease-angle")}
              incrementAriaLabel={t("increase-angle")}
              onChange={(value) => {
                if (Number.isFinite(value)) {
                  setAngleOverride(value);
                  onAngleChange?.(value);
                }
              }}
              value={angleValue}
            >
              <Label className="sr-only">{t("angle")}</Label>
              <Group className={stepperVariants()}>
                <Button
                  className="flex aspect-square h-full cursor-pointer items-center justify-center border-input border-e bg-background text-muted-foreground text-sm transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  slot="decrement"
                >
                  <HugeIcons
                    aria-hidden="true"
                    className="size-4"
                    icon={MinusSignIcon}
                  />
                </Button>
                <Input
                  aria-roledescription={t("number-field")}
                  className="w-full grow bg-background px-3 py-2 text-center font-mono text-foreground tabular-nums"
                />
                <Button
                  className="flex aspect-square h-full cursor-pointer items-center justify-center border-input border-s bg-background text-muted-foreground text-sm transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  slot="increment"
                >
                  <HugeIcons
                    aria-hidden="true"
                    className="size-4"
                    icon={PlusSignIcon}
                  />
                </Button>
              </Group>
            </NumberField>
          </div>
        </VisualCardControls>
      </VisualCardBody>
      <CoordinateControls />
    </>
  );
}
