"use client";

import { useQuery } from "@confect/react";
import island from "@repo/backend/confect/_generated/refs/island";
import { Array as Arr } from "effect";
import { placeOf } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { layChunk } from "@/lib/island/land/ops";

/**
 * Reads the stored chunks of the regions a world's camera nears, once each
 * (ADR 0050, W3): every region in `wanted` that is not in `loaded` is read,
 * laid over the land and told to `onArrive`, and then nothing stays
 * subscribed to chunks the learner themself keeps writing. `username` names
 * whose world it is, none for the learner's own.
 */
export function IslandRegions({
  land,
  loaded,
  onArrive,
  username,
  wanted,
}: {
  land: Land;
  loaded: readonly number[];
  onArrive: (region: number) => void;
  username: string | null;
  wanted: readonly number[];
}) {
  return Arr.map(
    Arr.filter(wanted, (region) => !Arr.contains(loaded, region)),
    (region) => (
      <RegionRead
        key={region}
        land={land}
        onArrive={onArrive}
        region={region}
        username={username}
      />
    )
  );
}

/** Reads one region's stored chunks and lays them over the land, then tells the reader it arrived. */
function RegionRead({
  land,
  onArrive,
  region,
  username,
}: {
  land: Land;
  onArrive: (region: number) => void;
  region: number;
  username: string | null;
}) {
  const [rx, rz] = placeOf(region);
  const read = useQuery(island.queries.region, { rx, rz, username });
  if (read._tag !== "Success") {
    return null;
  }
  return (
    <span
      hidden
      ref={(node) => {
        if (node === null) {
          return;
        }
        for (const chunk of read.value) {
          layChunk(land, chunk);
        }
        onArrive(region);
      }}
    />
  );
}
