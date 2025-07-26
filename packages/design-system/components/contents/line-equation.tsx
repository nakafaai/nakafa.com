import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { LineEquation as LineEquation3D } from "@repo/design-system/components/three/line-equation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ComponentProps, ReactNode } from "react";

type Props = {
  title: ReactNode;
  description: ReactNode;
  data: ComponentProps<typeof LineEquation3D>[];
  cameraPosition?: [number, number, number];
  showZAxis?: boolean;
};

export function LineEquation({
  title,
  description,
  data,
  cameraPosition = [10, 6, 10],
  showZAxis = true,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <CoordinateSystem cameraPosition={cameraPosition} showZAxis={showZAxis}>
          {data.map((item, index) => (
            <LineEquation3D
              key={`line-${index}-${item.points.map((p) => `${p.x},${p.y},${p.z}`).join(";")}`}
              {...item}
            />
          ))}
        </CoordinateSystem>
      </CardContent>
    </Card>
  );
}
