import { DeferredLineScene } from "@repo/design-system/components/contents/mathematics/line/deferred";
import { resolveAuthoredLines } from "@repo/design-system/components/contents/mathematics/line/resolve";
import type { AuthoredLine } from "@repo/design-system/components/contents/mathematics/line/spec";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ReactNode } from "react";

const DEFAULT_CAMERA_POSITION_X = 10;
const DEFAULT_CAMERA_POSITION_Y = 6;
const DEFAULT_CAMERA_POSITION_Z = 10;

interface Props {
  cameraPosition?: [number, number, number];
  data: readonly AuthoredLine[];
  description: ReactNode;
  showZAxis?: boolean;
  title: ReactNode;
}

/** Renders one interactive line-equation card. */
export function LineEquation({
  title,
  description,
  data,
  cameraPosition = [
    DEFAULT_CAMERA_POSITION_X,
    DEFAULT_CAMERA_POSITION_Y,
    DEFAULT_CAMERA_POSITION_Z,
  ],
  showZAxis = true,
}: Props) {
  const lines = resolveAuthoredLines(data);

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <DeferredLineScene
          cameraPosition={cameraPosition}
          lines={lines}
          showZAxis={showZAxis}
        />
      </CardContent>
    </Card>
  );
}
