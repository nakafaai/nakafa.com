"use client";

import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { UnitCircle as UnitCircle3D } from "@repo/design-system/components/three/unit-circle";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { Slider } from "@repo/design-system/components/ui/slider";
import { getRadians } from "@repo/design-system/lib/math";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

type Props = {
  title: ReactNode;
  description: ReactNode;
  angle?: number;
};

export function UnitCircle({ title, description, angle = 45 }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <Content angle={angle} />
    </Card>
  );
}

function Content({ angle }: { angle: number }) {
  const t = useTranslations("Common");
  const [angleValue, setAngleValue] = useState(angle);

  return (
    <>
      <CardContent>
        <CoordinateSystem
          cameraPosition={[0, 0, 4]}
          showOrigin={false}
          showZAxis={false}
        >
          <UnitCircle3D angle={angleValue} />
        </CoordinateSystem>
      </CardContent>
      <CardFooter className="border-t">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="angle">
              <Badge className="font-mono" variant="outline">
                {angleValue}°
              </Badge>
            </Label>
            <Badge className="font-mono" variant="outline">
              {getRadians(angleValue).toFixed(2)} {t("radian")}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground text-sm">0°</span>
            <Slider
              id="angle"
              max={360}
              min={0}
              onValueChange={(values) => setAngleValue(values[0])}
              step={1}
              value={[angleValue]}
            />
            <span className="font-mono text-muted-foreground text-sm">
              360°
            </span>
          </div>
        </div>
      </CardFooter>
    </>
  );
}
