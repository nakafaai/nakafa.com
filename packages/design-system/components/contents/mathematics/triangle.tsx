"use client";

import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Triangle as Triangle3D } from "@repo/design-system/components/three/triangle";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  getCos,
  getRadians,
  getSin,
  getTan,
} from "@repo/design-system/lib/geometry/angles";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
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
  labels?: {
    opposite: ReactNode;
    adjacent: ReactNode;
    hypotenuse: ReactNode;
  };
  size?: number;
  title: ReactNode;
}

export function Triangle({
  title,
  description,
  angle = 45,
  size = 2,
  labels,
}: Props) {
  const locale = useLocale();

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <I18nProvider locale={locale}>
        <Content angle={angle} labels={labels} size={size} />
      </I18nProvider>
    </Card>
  );
}

function Content({
  angle,
  size,
  labels,
}: {
  angle: number;
  size: number;
  labels?: Props["labels"];
}) {
  const t = useTranslations("Common");
  const [angleOverride, setAngleOverride] = useState<number | null>(null);
  const angleValue = angleOverride ?? angle;

  return (
    <>
      <CardContent>
        <CoordinateSystem
          cameraPosition={[0, 0, CAMERA_Z_POSITION]}
          showOrigin={false}
          showZAxis={false}
        >
          <Triangle3D angle={angleValue} labels={labels} size={size} />
        </CoordinateSystem>
      </CardContent>
      <CardFooter className="border-t px-0">
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2 px-6">
            <Badge className="font-mono" variant="outline">
              Sin ({angleValue}°) = {getSin(angleValue).toFixed(2)}
            </Badge>
            <Badge className="font-mono" variant="outline">
              Cos ({angleValue}°) = {getCos(angleValue).toFixed(2)}
            </Badge>
            <Badge className="font-mono" variant="outline">
              Tan ({angleValue}°) ={" "}
              {Number.isFinite(getTan(angleValue))
                ? getTan(angleValue).toFixed(2)
                : t("undefined")}
            </Badge>
          </div>

          <Separator />

          <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-6">
            <div className="flex items-center gap-2">
              <Badge className="font-mono" variant="outline">
                {angleValue}°
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
      </CardFooter>
    </>
  );
}
