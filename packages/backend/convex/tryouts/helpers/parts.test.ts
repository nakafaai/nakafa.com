import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  buildTryoutPartRouteMappings,
  resolveRequestedTryoutPart,
} from "@repo/backend/convex/tryouts/helpers/parts";
import { describe, expect, it } from "vitest";

describe("tryouts/helpers/parts", () => {
  it("keeps current route keys one-to-one when a historical key moves and another key is renamed", () => {
    const currentPartSets = [
      {
        partIndex: 0,
        partKey: "mathematical-reasoning",
      },
      {
        partIndex: 1,
        partKey: "verbal-reasoning",
      },
    ];
    const partSetSnapshots = [
      {
        partIndex: 0,
        partKey: "quantitative-knowledge",
        questionCount: 10,
        setId: "set-0" as Id<"exerciseSets">,
      },
      {
        partIndex: 1,
        partKey: "mathematical-reasoning",
        questionCount: 10,
        setId: "set-1" as Id<"exerciseSets">,
      },
    ];
    const { currentPartKeyBySnapshotIndex } = buildTryoutPartRouteMappings({
      currentPartSets,
      partSetSnapshots,
    });

    expect(currentPartKeyBySnapshotIndex.get(0)).toBe("verbal-reasoning");
    expect(currentPartKeyBySnapshotIndex.get(1)).toBe("mathematical-reasoning");
    expect(
      resolveRequestedTryoutPart({
        currentPartSets,
        partSetSnapshots,
        requestedPartKey: "verbal-reasoning",
      })?.snapshot.partIndex
    ).toBe(0);
    expect(
      resolveRequestedTryoutPart({
        currentPartSets,
        partSetSnapshots,
        requestedPartKey: "mathematical-reasoning",
      })?.snapshot.partIndex
    ).toBe(1);
    expect(
      resolveRequestedTryoutPart({
        currentPartSets,
        partSetSnapshots,
        requestedPartKey: "quantitative-knowledge",
      })
    ).toBeNull();
  });
});
