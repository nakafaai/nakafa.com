import { CoordinateArtifactClient } from "@repo/design-system/components/learning-artifacts/coordinate-system/client";
import { readCoordinateView } from "@repo/design-system/components/learning-artifacts/coordinate-system/model/view";
import type { CoordinateSystemArtifact } from "@repo/math/schema/artifact/schema";

/**
 * Public renderer boundary that turns schema-class artifacts into plain data.
 */
export function CoordinateArtifactRenderer({
  artifact,
  className,
}: {
  artifact: CoordinateSystemArtifact;
  className?: string;
}) {
  return (
    <CoordinateArtifactClient
      className={className}
      view={readCoordinateView(artifact)}
    />
  );
}
