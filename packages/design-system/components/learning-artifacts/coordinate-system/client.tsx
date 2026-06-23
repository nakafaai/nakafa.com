"use client";

import {
  ArtifactDescription,
  ArtifactTitle,
} from "@repo/design-system/components/learning-artifacts/coordinate-system/copy";
import type { CoordinateArtifactView } from "@repo/design-system/components/learning-artifacts/coordinate-system/model/view";
import { CoordinateArtifactScene } from "@repo/design-system/components/learning-artifacts/coordinate-system/scene";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";

/**
 * Client entry that receives only plain serializable artifact view data.
 */
export function CoordinateArtifactClient({
  className,
  view,
}: {
  className?: string;
  view: CoordinateArtifactView;
}) {
  const { artifact, viewport } = view;

  return (
    <Card
      aria-label={artifact.title}
      className={cn("not-prose overflow-hidden content-auto-card", className)}
    >
      <CardHeader>
        <CardTitle>
          <ArtifactTitle artifactId={artifact.id}>
            {artifact.title}
          </ArtifactTitle>
        </CardTitle>
        {artifact.description ? (
          <CardDescription>
            <ArtifactDescription artifactId={artifact.id}>
              {artifact.description}
            </ArtifactDescription>
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CoordinateSystem
          cameraPosition={[
            viewport.cameraX,
            viewport.cameraY,
            viewport.cameraZ,
          ]}
          cameraTarget={[viewport.targetX, viewport.targetY, viewport.targetZ]}
          gridDivisions={viewport.gridDivisions}
          gridSize={viewport.axisSize}
          showGizmo
          size={viewport.axisSize}
        >
          <CoordinateArtifactScene
            payload={artifact.payload}
            size={viewport.axisSize}
          />
        </CoordinateSystem>
      </CardContent>
    </Card>
  );
}
