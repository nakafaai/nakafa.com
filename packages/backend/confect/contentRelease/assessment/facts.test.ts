import { assert, describe, expect, it } from "@effect/vitest";
import { hashStimulusVersion } from "@nakafa/aksara-contracts/assessment/hash";
import {
  StimulusVersionBodySchema,
  StimulusVersionSchema,
} from "@nakafa/aksara-contracts/assessment/stimulus";
import {
  assessmentRowFacts,
  catalogSetIdentity,
} from "@repo/backend/confect/contentRelease/assessment/facts";
import { makeAssessmentSnapshot } from "@repo/backend/test/assessment/snapshot";
import { Array as Arr, Effect, Schema } from "effect";

describe("contentRelease/assessment/facts", () => {
  it.effect("indexes every catalog row by its locale, route and set", () =>
    Effect.gen(function* () {
      const { catalog, setIdentity } = yield* makeAssessmentSnapshot();
      const english = Arr.filter(catalog, (row) => row.appLocale === "en");
      expect(
        Arr.map(english, (row) => assessmentRowFacts({ kind: "catalog", row }))
      ).toEqual([
        expect.objectContaining({
          appLocale: "en",
          assetId: "asset:country",
          kind: "catalog",
          order: 1,
          publicPath: "try-out/indonesia-en",
        }),
        expect.not.objectContaining({ setIdentity }),
        expect.not.objectContaining({ setIdentity }),
        expect.objectContaining({
          publicPath: "try-out/indonesia/snbt/2027/set-1-en",
          setIdentity,
        }),
        expect.objectContaining({ order: 1, setIdentity }),
        expect.objectContaining({ order: 2, setIdentity }),
      ]);
      expect(
        catalogSetIdentity({
          countryKey: "indonesia",
          examKey: "snbt",
          setKey: "set-1",
          trackKey: "2027",
        })
      ).toBe(setIdentity);
    })
  );

  it.effect(
    "indexes versioned rows by their version hash and explanations by language",
    () =>
      Effect.gen(function* () {
        const { items, profile, profileHash } = yield* makeAssessmentSnapshot();
        const [item] = items;
        assert(item);
        const [explanation] = item.explanations;
        assert(explanation);
        const hash = item.version.hash;
        expect([
          assessmentRowFacts({ hash: profileHash, kind: "profile", profile }),
          assessmentRowFacts({ family: item.family, kind: "family" }),
          assessmentRowFacts({ kind: "item", version: item.version }),
          assessmentRowFacts({ key: item.key, kind: "key" }),
          assessmentRowFacts({ explanation, kind: "explanation" }),
        ]).toEqual([
          { identity: profile.id, kind: "profile" },
          { identity: item.family.id, kind: "family" },
          {
            identity: `${item.family.id}\0id`,
            kind: "item",
            versionHash: hash,
          },
          { identity: hash, kind: "key", versionHash: hash },
          {
            identity: `${hash}\0${explanation.language}`,
            kind: "explanation",
            language: explanation.language,
            versionHash: hash,
          },
        ]);
      })
  );

  it.effect("indexes a reading by its version hash", () =>
    Effect.gen(function* () {
      const body = yield* Schema.decodeEffect(StimulusVersionBodySchema)({
        deliveryLanguage: "id",
        document: {
          content: [
            { content: [{ text: "Bacaan.", type: "text" }], type: "paragraph" },
          ],
          type: "doc",
        },
        id: "indonesia/snbt/2027/set-1/passage-1",
      });
      const stimulus = StimulusVersionSchema.make({
        ...body,
        hash: yield* hashStimulusVersion(body),
      });
      expect(
        assessmentRowFacts({ kind: "stimulus", version: stimulus })
      ).toEqual({
        identity: `${stimulus.id}\0id`,
        kind: "stimulus",
        versionHash: stimulus.hash,
      });
    })
  );

  it.effect("leaves the route off an internal-entry section", () =>
    Effect.gen(function* () {
      const { catalog } = yield* makeAssessmentSnapshot({ entry: true });
      const section = yield* Effect.fromOption(
        Arr.findFirst(catalog, (row) => row.kind === "section")
      );
      const facts = assessmentRowFacts({ kind: "catalog", row: section });
      expect(facts).not.toHaveProperty("publicPath");
      expect(facts).toHaveProperty("setIdentity", "indonesia/snbt/2027/set-1");
    })
  );
});
