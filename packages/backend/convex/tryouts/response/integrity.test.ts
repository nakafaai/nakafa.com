import { validateTryoutSectionSnapshots } from "@repo/backend/convex/tryouts/response/integrity";
import { tryoutSectionSnapshot } from "@repo/backend/test/tryout-runtime";
import { makeSignedTryoutSection } from "@repo/backend/test/tryout-section";
import { makeTryoutSection } from "@repo/backend/test/tryouts";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const firstSnapshot = tryoutSectionSnapshot({
  signed: makeSignedTryoutSection(
    makeTryoutSection({ sectionKey: "first-section" })
  ).signed,
});
const secondSnapshot = tryoutSectionSnapshot({
  signed: makeSignedTryoutSection(
    makeTryoutSection({ order: 2, sectionKey: "second-section" })
  ).signed,
});

describe("tryouts/response/integrity", () => {
  it.live.each([
    {
      kind: "identity",
      snapshot: {
        ...secondSnapshot,
        sectionIdentity: firstSnapshot.sectionIdentity,
      },
    },
    {
      kind: "key",
      snapshot: { ...secondSnapshot, sectionKey: firstSnapshot.sectionKey },
    },
    {
      kind: "order",
      snapshot: {
        ...secondSnapshot,
        sectionOrder: firstSnapshot.sectionOrder,
      },
    },
  ])("rejects duplicate snapshot $kind", ({ snapshot }) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        validateTryoutSectionSnapshots([firstSnapshot, snapshot])
      );

      expect(error).toMatchObject({
        _tag: "TryoutResponseIntegrityError",
        code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
      });
    })
  );
});
