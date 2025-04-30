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
  /** Whether to render the lines as smooth curves */
  smooth?: boolean;
};

export function LineEquation({
  title,
  description,
  data,
  cameraPosition = [10, 6, 10],
  smooth = false,
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
            <LineEquation3D
              key={`line-equation-${index}`}
              {...item}
              smooth={item.smooth !== undefined ? item.smooth : smooth}
            />
          ))}
        </CoordinateSystem>
      </CardContent>
    </Card>
  );
}
