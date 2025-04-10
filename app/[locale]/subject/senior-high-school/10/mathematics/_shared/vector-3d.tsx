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
};

export function Vector3d({ title, description, vectors }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <CoordinateSystem>
          {vectors.map((vector) => (
            <Vector key={vector.label} {...vector} />
          ))}
        </CoordinateSystem>
      </CardContent>
    </Card>
  );
}
