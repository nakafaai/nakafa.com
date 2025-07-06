import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Vector } from "@repo/design-system/components/three/vector";
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
  vectors: ComponentProps<typeof Vector>[];
  cameraPosition?: [number, number, number];
};

export function Vector3d({
  title,
  description,
  vectors,
  cameraPosition = [10, 6, 10],
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <CoordinateSystem cameraPosition={cameraPosition}>
          {vectors.map((vector) => (
            <Vector
              key={`vector-${vector.from?.join(",")}-${vector.to.join(",")}`}
              {...vector}
            />
          ))}
        </CoordinateSystem>
      </CardContent>
    </Card>
  );
}
