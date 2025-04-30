import {
  CoordinateSystem,
  Inequality as Inequality3D,
  type InequalityProps,
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
  data: InequalityProps[];
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
