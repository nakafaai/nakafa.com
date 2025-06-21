import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Inequality as Inequality3D } from "@repo/design-system/components/three/inequality";
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
  data: ComponentProps<typeof Inequality3D>[];
};

export function Inequality({ title, description, data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <CoordinateSystem>
          {data.map((item, index) => (
            <Inequality3D key={`inequality-${index}`} {...item} />
          ))}
        </CoordinateSystem>
      </CardContent>
    </Card>
  );
}
