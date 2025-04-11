import { CoordinateSystem, Vector } from "@/components/ui/3d-coordinate";
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
  vectors: {
    from: [number, number, number];
    to: [number, number, number];
    color: string;
    label: string;
  }[];
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
            <Vector key={vector.label} {...vector} />
          ))}
        </CoordinateSystem>
      </CardContent>
    </Card>
  );
}
