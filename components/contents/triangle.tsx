"use client";

import { CoordinateSystem } from "@/components/three/coordinate-system";
import { Triangle as Triangle3D } from "@/components/three/triangle";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { getCos, getRadians, getSin, getTan } from "@/lib/utils/math";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReactNode } from "react";

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
      <Content angle={angle} size={size} labels={labels} />
    </Card>
  );
}

function Content({
  angle,
  size,
  labels,
}: { angle: number; size: number; labels?: Props["labels"] }) {
  const t = useTranslations("Common");
  const [angleValue, setAngleValue] = useState(angle);

  return (
    <>
      <CardContent>
        <CoordinateSystem
          showZAxis={false}
          showOrigin={false}
          cameraPosition={[0, 0, 4]}
        >
          <Triangle3D angle={angleValue} size={size} labels={labels} />
        </CoordinateSystem>
      </CardContent>
      <CardFooter className="border-t px-0">
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2 px-6">
            <Badge variant="outline" className="font-mono">
              Sin ({angleValue}°) = {getSin(angleValue).toFixed(2)}
            </Badge>
            <Badge variant="outline" className="font-mono">
              Cos ({angleValue}°) = {getCos(angleValue).toFixed(2)}
            </Badge>
            <Badge variant="outline" className="font-mono">
              Tan ({angleValue}°) ={" "}
              {Number.isFinite(getTan(angleValue))
                ? getTan(angleValue).toFixed(2)
                : t("undefined")}
            </Badge>
          </div>

          <Separator />

          <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-6">
            <div className="flex items-center gap-2">
              <Label htmlFor="angle">
                <Badge variant="outline" className="font-mono">
                  {angleValue}°
                </Badge>
              </Label>
              <Badge variant="outline" className="font-mono">
                {getRadians(angleValue).toFixed(2)} {t("radian")}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground text-sm">
                0°
              </span>
              <Slider
                id="angle"
                value={[angleValue]}
                onValueChange={(values) => setAngleValue(values[0])}
                min={0}
                max={360}
                step={1}
              />
              <span className="font-mono text-muted-foreground text-sm">
                360°
              </span>
            </div>
          </div>
        </div>
      </CardFooter>
    </>
  );
}
