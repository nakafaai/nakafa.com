"use client";

import {
  CoordinateSystem,
  Triangle as Triangle3D,
} from "@/components/ui/3d-coordinate";
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
import { Slider } from "@/components/ui/slider";
import { getRadians } from "@/lib/utils/math";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = {
  title: string;
  description: string;
  angle?: number;
  labels?: {
    opposite: string;
    adjacent: string;
    hypotenuse: string;
  };
};

export function Triangle({ title, description, angle = 45, labels }: Props) {
  const t = useTranslations("Common");
  const [angleValue, setAngleValue] = useState(angle);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <CoordinateSystem
          showZAxis={false}
          showOrigin={false}
          cameraPosition={[0, 0, 4]}
        >
          <Triangle3D angle={angleValue} size={2} labels={labels} />
        </CoordinateSystem>
      </CardContent>
      <CardFooter className="border-t">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
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
            <span className="font-mono text-muted-foreground text-sm">0°</span>
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
      </CardFooter>
    </Card>
  );
}
