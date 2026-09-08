"use client";

import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { UnitCircle as UnitCircle3D } from "@repo/design-system/components/three/unit-circle";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Separator } from "@repo/design-system/components/ui/separator";
import { getCos, getRadians, getSin, getTan } from "@repo/math/angles";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import {
  Button,
  Group,
  I18nProvider,
  Input,
  Label,
  NumberField,
} from "react-aria-components";

const CAMERA_Z_POSITION = 4;

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

export function UnitCircle({
  title,
  description,
  angle = 45,
  trigValues,
}: Props) {
  const locale = useLocale();

  return (
    <CoordinateProvider>
      <Card className="content-auto-card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <I18nProvider locale={locale}>
          <Content angle={angle} trigValues={trigValues} />
        </I18nProvider>
      </Card>
    </CoordinateProvider>
  );
}

function Content({
  angle,
  trigValues,
}: {
  angle: number;
  trigValues?: {
    sin?: string;
    cos?: string;
    tan?: string;
  };
}) {
  const t = useTranslations("Common");
  const [angleOverride, setAngleOverride] = useState<number | null>(null);
  const angleValue = angleOverride ?? angle;
  const exactValues = angleValue === angle ? trigValues : undefined;

  return (
    <>
      <CardContent>
        <CoordinateSystem
          cameraPosition={[0, 0, CAMERA_Z_POSITION]}
          cameraProjection={{ kind: "orthographic" }}
          showOrigin={false}
        >
          <UnitCircle3D angle={angleValue} />
        </CoordinateSystem>
      </CardContent>
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
              <Badge className="font-mono" variant="outline">
                <InlineMath math={`\\theta = ${angleValue}^\\circ`} />
              </Badge>
              <Badge className="font-mono" variant="outline">
                {getRadians(angleValue).toFixed(2)} {t("radian")}
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
              <Group className="relative inline-flex h-9 w-full items-center overflow-hidden whitespace-nowrap rounded-md border border-input text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-[3px] data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:border-destructive data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40">
                <Button
                  className="-ms-px flex aspect-square h-full cursor-pointer items-center justify-center rounded-s-md border border-input bg-background text-muted-foreground text-sm transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="-me-px flex aspect-square h-full cursor-pointer items-center justify-center rounded-e-md border border-input bg-background text-muted-foreground text-sm transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
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
  const exact = commonValues.find(
    (candidate) => Math.abs(Math.abs(value) - candidate.value) < 1e-10
  );
  if (exact) {
    return `= ${value < 0 ? "-" : ""}${exact.display}`;
  }
  return `\\approx ${value.toFixed(2)}`;
}
