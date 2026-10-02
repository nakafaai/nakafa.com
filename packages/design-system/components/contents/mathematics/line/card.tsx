"use client";

import { DeferredLineScene } from "@repo/design-system/components/contents/mathematics/line/deferred";
import {
  type PackedLine,
  unpackLines,
} from "@repo/design-system/components/contents/mathematics/line/pack";
import { resolveAuthoredLines } from "@repo/design-system/components/contents/mathematics/line/resolve";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { ReactNode } from "react";

interface LineCardProps {
  readonly cameraPosition: [number, number, number];
  readonly cameraTarget?: [number, number, number];
  readonly description: ReactNode;
  readonly lines: readonly PackedLine[];
  readonly showZAxis: boolean;
  readonly title: ReactNode;
}

/** Renders one interactive line-equation card from its packed lines. */
export function LineCard({
  cameraPosition,
  cameraTarget,
  description,
  lines,
  showZAxis,
  title,
}: LineCardProps) {
  const resolved = resolveAuthoredLines(unpackLines(lines));

  return (
    <CoordinateProvider>
      <Card className="content-auto-card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeferredLineScene
            cameraPosition={cameraPosition}
            {...(cameraTarget === undefined ? {} : { cameraTarget })}
            lines={resolved}
            showZAxis={showZAxis}
          />
        </CardContent>
        <CoordinateControls />
      </Card>
    </CoordinateProvider>
  );
}
