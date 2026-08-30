import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import {
  type ReleaseEvidence,
  validateReleaseTree,
} from "#scripts/github/queue/release";

const releaseEvidence = {
  changes: [
    {
      afterMode: "000000",
      beforeMode: "100644",
      path: ".changeset/cli.md",
      status: "D",
    },
    {
      afterMode: "100644",
      beforeMode: "100644",
      path: "packages/cli/CHANGELOG.md",
      status: "M",
    },
    {
      afterMode: "100644",
      beforeMode: "100644",
      path: "packages/cli/package.json",
      status: "M",
    },
  ],
} satisfies ReleaseEvidence;

const expectFailure = (evidence: ReleaseEvidence) =>
  validateReleaseTree(evidence).pipe(
    Effect.result,
    Effect.tap((result) =>
      Effect.sync(() => {
        expect(Result.isFailure(result)).toBe(true);
      })
    )
  );

describe("generated release queue", () => {
  it.effect("accepts paired Changesets release paths", () =>
    validateReleaseTree(releaseEvidence)
  );

  it.effect("rejects executable source changes", () =>
    expectFailure({
      ...releaseEvidence,
      changes: [
        ...releaseEvidence.changes,
        {
          afterMode: "100644",
          beforeMode: "100644",
          path: "packages/cli/main.ts",
          status: "M",
        },
      ],
    })
  );

  it.effect("rejects an unpaired package changelog", () =>
    expectFailure({
      ...releaseEvidence,
      changes: releaseEvidence.changes.filter(
        (change) => change.path !== "packages/cli/CHANGELOG.md"
      ),
    })
  );
});
