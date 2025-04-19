import {
  CoordinateSystem,
  Equation as Equation3D,
  type EquationProps,
} from "@/components/ui/3d-coordinate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  data: EquationProps[];
  cameraPosition?: [number, number, number];
};

export function Equation({
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
            <Equation3D key={`equation-${index}`} {...item} />
          ))}
        </CoordinateSystem>
      </CardContent>
    </Card>
  );
}
