import {
  CoordinateSystem,
  LineEquation as LineEquation3D,
  type LineEquationProps,
} from "@/components/ui/3d-coordinate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  description: ReactNode;
  data: LineEquationProps[];
  cameraPosition?: [number, number, number];
};

export function LineEquation({
  title,
  description,
  data,
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
          {data.map((item, index) => (
            <LineEquation3D key={`line-equation-${index}`} {...item} />
          ))}
        </CoordinateSystem>
      </CardContent>
    </Card>
  );
}
