"use client";

import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
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
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { COLORS } from "@repo/design-system/lib/color";
import { getCos, getRadians, getSin, getTan } from "@repo/math/angles";
import { Array as Arr, Option } from "effect";
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
    import(
      "@repo/design-system/components/contents/mathematics/unit-circle/stage"
    ).then(({ UnitCircleStage }) => UnitCircleStage),
  { loading: ScenePlaceholder }
);

interface CardProps {
  angle?: number;
  /** The card's header. A lesson page names its unit circle with a title and a description. */
  header?: ReactNode;
  /**
   * Whether the three-dimensional scene is mounted. A card that is not live keeps
   * its whole frame in place, with an empty frame where the scene goes.
   */
  live?: boolean;
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
  angle?: number;
  description: ReactNode;
  title: ReactNode;
  /** Exact trigonometric values as fractions (e.g., "5/13", "12/13", "5/12") */
  trigValues?: {
    sin?: string;
    cos?: string;
    tan?: string;
  };
}

/**
 * The unit circle as a visual card without a header. The scene, its angle
 * controls and the trigonometric values of the angle are all in the card; the
 * page or the window that holds the card names the lesson.
 */
export function UnitCircleCard({
  angle = 45,
  header,
  live = true,
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
  angle = 45,
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
  trigValues,
  viewLabel,
}: {
  angle: number;
  live: boolean;
  trigValues?:
    | {
        sin?: string;
        cos?: string;
        tan?: string;
      }
    | undefined;
  viewLabel: string | undefined;
}) {
  const t = useTranslations("Common");
  const format = useFormatter();
  const [angleOverride, setAngleOverride] = useState<number | null>(null);
  const angleValue = angleOverride ?? angle;
  const exactValues = angleValue === angle ? trigValues : undefined;

  function formatRatio(value: number, exactValue?: string) {
    if (exactValue !== undefined) {
      return `= ${exactValue}`;
    }
    if (Math.abs(value) < 1e-10) {
      return "= 0";
    }
    const commonValues = [
      { value: 0.5, display: "\\frac{1}{2}" },
      { value: Math.SQRT1_2, display: "\\frac{\\sqrt{2}}{2}" },
      { value: Math.sqrt(3) / 2, display: "\\frac{\\sqrt{3}}{2}" },
      { value: 1, display: "1" },
      { value: Math.sqrt(3), display: "\\sqrt{3}" },
      { value: Math.sqrt(3) / 3, display: "\\frac{\\sqrt{3}}{3}" },
    ];
    const exact = Arr.findFirst(
      commonValues,
      (candidate) => Math.abs(Math.abs(value) - candidate.value) < 1e-10
    );
    if (Option.isSome(exact)) {
      return `= ${value < 0 ? "-" : ""}${exact.value.display}`;
    }
    return `\\approx ${format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).replaceAll(",", "{,}")}`;
  }

  return (
    <>
      <VisualCardBody>
        {live ? (
          <UnitCircleStage angle={angleValue} viewLabel={viewLabel} />
        ) : (
          <div aria-hidden="true" className={threeSceneFrameVariants()} />
        )}
      </VisualCardBody>
      <CoordinateControls>
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2 px-6">
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
          </div>

          <Separator />

          <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-6">
            <div className="flex items-center gap-2">
              <Badge style={{ color: COLORS.VIOLET }} variant="outline">
                <InlineMath math={`\\theta = ${angleValue}^\\circ`} />
              </Badge>
              <Badge className="font-mono" variant="outline">
                {format.number(getRadians(angleValue), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                  useGrouping: false,
                })}{" "}
                {t("radian")}
              </Badge>
            </div>

            <NumberField
              decrementAriaLabel={t("decrease-angle")}
              incrementAriaLabel={t("increase-angle")}
              onChange={(value) => {
                if (Number.isFinite(value)) {
                  setAngleOverride(value);
                }
              }}
              value={angleValue}
            >
              <Label className="sr-only">{t("angle")}</Label>
              <Group className="relative inline-flex h-9 w-full items-center overflow-hidden whitespace-nowrap rounded-md border border-input text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-3 data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:border-destructive data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40">
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
        </div>
      </CoordinateControls>
    </>
  );
}
