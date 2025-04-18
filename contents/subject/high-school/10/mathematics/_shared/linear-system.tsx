import {
  type COLORS,
  CoordinateSystem,
  LinearSystem as LinearSystem3D,
  type LinearSystemProps,
  randomColor,
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
  data: {
    points: LinearSystemProps["points"];
    labels: LinearSystemProps["labels"];
    color?: keyof typeof COLORS;
  }[];
  cameraPosition?: [number, number, number];
};

export function LinearSystem({
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
          {data.map(({ points, labels, color }) => (
            <LinearSystem3D
              key={`${points.map((p) => `${p.x},${p.y},${p.z}`).join("-")}-${labels?.map((l) => l.text).join("-")}`}
              points={points}
              labels={labels}
              color={color ?? randomColor(["RED", "GREEN", "BLUE"])}
            />
          ))}
        </CoordinateSystem>
      </CardContent>
    </Card>
  );
}
