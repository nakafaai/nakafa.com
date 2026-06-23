"use client";

import type { DataPart } from "@repo/ai/schema/data";
import { api } from "@repo/backend/convex/_generated/api";
import { CoordinateArtifactRenderer } from "@repo/design-system/components/learning-artifacts/coordinate-system/renderer";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { CoordinateSystemArtifact } from "@repo/math/schema/artifact/schema";
import { useQuery } from "convex/react";
import { Option, Schema } from "effect";

/**
 * Loads the full artifact payload only when its transcript manifest is visible.
 */
export const ArtifactPart = ({
  message,
}: {
  message: DataPart["artifact"];
}) => {
  const artifact = useQuery(api.chats.artifacts.queries.loadVisible, {
    artifactId: message.artifactId,
  });

  const decodedArtifact = artifact
    ? Schema.decodeUnknownOption(CoordinateSystemArtifact)({
        ...(artifact.description ? { description: artifact.description } : {}),
        id: artifact.artifactId,
        kind: artifact.kind,
        payload: artifact.payload,
        proofAnchors: artifact.proofAnchors,
        title: artifact.title,
      })
    : Option.none();

  if (Option.isNone(decodedArtifact)) {
    return (
      <div className="not-prose flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
        <Spinner aria-hidden="true" className="size-4" />
        <span className="truncate">{message.title}</span>
      </div>
    );
  }

  return <CoordinateArtifactRenderer artifact={decodedArtifact.value} />;
};
ArtifactPart.displayName = "ArtifactPart";
