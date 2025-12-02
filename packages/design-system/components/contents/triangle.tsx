"use client";

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
import { Label as LabelUi } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  getCos,
  getRadians,
  getSin,
  getTan,
} from "@repo/design-system/lib/math";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Button,
  Group,
  Input,
  Label,
  NumberField,
} from "react-aria-components";

const CAMERA_Z_POSITION = 4;

type Props = {
  title: ReactNode;
  description: ReactNode;
  angle?: number;
  size?: number;
  labels?: {
    opposite: string;
    adjacent: string;
    hypotenuse: string;
  };
};

export function Triangle({
  title,
  description,
  angle = 45,
  size = 2,
  labels,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <Content angle={angle} labels={labels} size={size} />
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
  const [angleValue, setAngleValue] = useState(angle);

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
              <LabelUi htmlFor="angle">
                <Badge className="font-mono" variant="outline">
                  {angleValue}°
                </Badge>
              </LabelUi>
              <Badge className="font-mono" variant="outline">
                {getRadians(angleValue).toFixed(2)} {t("radian")}
              </Badge>
            </div>

            <NumberField
              formatOptions={{
                localeMatcher: "best fit",
              }}
              onChange={setAngleValue}
              value={angleValue}
            >
              <Label className="sr-only">Angle</Label>
              <Group className="relative inline-flex h-9 w-full items-center overflow-hidden whitespace-nowrap rounded-md border border-[color-mix(in_oklch,var(--input)_5%,var(--border))] text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-[3px] data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:border-destructive data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40">
                <Button
                  className="-ms-px flex aspect-square h-[inherit] cursor-pointer items-center justify-center rounded-s-md border border-[color-mix(in_oklch,var(--input)_5%,var(--border))] bg-background text-muted-foreground/80 text-sm transition-[color,box-shadow] hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  slot="decrement"
                >
                  <MinusIcon aria-hidden="true" className="size-4" />
                </Button>
                <Input className="w-full grow bg-background px-3 py-2 text-center font-mono text-foreground tabular-nums" />
                <Button
                  className="-me-px flex aspect-square h-[inherit] cursor-pointer items-center justify-center rounded-e-md border border-[color-mix(in_oklch,var(--input)_5%,var(--border))] bg-background text-muted-foreground/80 text-sm transition-[color,box-shadow] hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  slot="increment"
                >
                  <PlusIcon aria-hidden="true" className="size-4" />
                </Button>
              </Group>
            </NumberField>
          </div>
        </div>
      </CardFooter>
    </>
  );
}
