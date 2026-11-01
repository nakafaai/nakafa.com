import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { MAX_READ_BYTES } from "@repo/backend/confect/classroom/passages";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { conceptEmbedder, provider } from "@repo/backend/test/gateway";
import { storeFile } from "@repo/backend/test/logo";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Option, Struct } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

type Fixture = Effect.Success<typeof tenancyFixture>;

const library = refs.public.classroom.library;
const { build, open, source } = refs.internal.classroom.passages;
const { setPolicy } = refs.public.tenancy.settings;

/** The leading bytes of a PDF, which the library keeps. */
const pdf = () =>
  new Blob(["%PDF-1.7\n1 0 obj\n"], { type: "application/pdf" });

/** Turns Nina on for the school. */
const ninaOn = (fixture: Fixture) =>
  fixture.as("admin").mutation(setPolicy, {
    policy: { key: "nina", value: true },
    slug: nf,
  });

/** The model reads every file as `text`, and the embedder knows one meaning. */
const modelReads = (text: string) => {
  provider.languageModel.mockReturnValue(
    new MockLanguageModelV4({
      doGenerate: providerStep([{ text, type: "text" }]),
    })
  );
  provider.embeddingModel.mockReturnValue(conceptEmbedder([["newton"]]));
};

/** A file a teacher published to a class. */
const published = Effect.fn("test.passages.published")(function* (
  fixture: Fixture
) {
  const term = yield* period(fixture, fixture.units.smp);
  const { classId } = yield* forumClass(fixture, term.id, "X-1");
  const storageId = yield* storeFile(fixture.convex, pdf());
  const { id } = yield* fixture.as("teacher").action(library.register, {
    classId,
    clientKey: "modul-newton",
    folderId: null,
    slug: nf,
    storageId,
    title: "Modul Newton",
  });
  return { classId, itemId: id };
});

/** The passages stored in a school, oldest first. */
const passages = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("classroomPassages")
        .index("by_tenantId", (query) =>
          query.eq("tenantId", fixture.tenants.nf)
        )
        .take(300)
    ).pipe(Effect.orDie)
  );

describe("classroom/passages", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  afterEach(() => {
    provider.languageModel.mockReset();
    provider.embeddingModel.mockReset();
  });

  it.effect(
    "reads a published file into sealed passages, and they leave with the file",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* ninaOn(fixture);
        modelReads("Hukum Newton pertama.\n\nHukum Newton kedua.");
        const { classId, itemId } = yield* published(fixture);
        yield* fixture.finishScheduled();

        const rows = yield* passages(fixture);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ classId, itemId, ordinal: 0 });
        expect(rows[0]?.embedding[0]).toBe(2);
        expect(
          yield* fixture.internal.query(open, {
            ids: Arr.map(rows, (row) => row._id),
          })
        ).toEqual([
          {
            text: "Hukum Newton pertama.\n\nHukum Newton kedua.",
            title: "Modul Newton",
          },
        ]);

        yield* fixture.internal.action(build, { itemId });
        expect(yield* passages(fixture)).toHaveLength(1);

        yield* fixture
          .as("teacher")
          .mutation(library.remove, { classId, itemId, slug: nf });
        expect(yield* passages(fixture)).toEqual([]);
      })
  );

  it.effect("leaves a file out while the school keeps Nina off", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      modelReads("Hukum Newton.");
      yield* published(fixture);
      yield* fixture.finishScheduled();
      expect(yield* passages(fixture)).toEqual([]);
    })
  );

  it.effect("reads no link and no file too large to read", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* ninaOn(fixture);
      modelReads("Hukum Newton.");
      const { classId, itemId } = yield* published(fixture);
      yield* fixture.finishScheduled();
      const link = yield* fixture.as("teacher").mutation(library.addLink, {
        address: "https://nakafa.com",
        classId,
        clientKey: "tautan-nakafa",
        folderId: null,
        slug: nf,
        title: "Tautan",
      });
      expect(
        yield* fixture.internal.query(source, { itemId: link.id })
      ).toBeNull();
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("classroomLibrary")
            .patch(itemId, { byteSize: MAX_READ_BYTES + 1 })
        ).pipe(Effect.orDie)
      );
      expect(yield* fixture.internal.query(source, { itemId })).toBeNull();
    })
  );

  it.effect("leaves a file out when the model cannot read it", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* ninaOn(fixture);
      provider.languageModel.mockReturnValue(
        new MockLanguageModelV4({
          doGenerate: () => Promise.reject(new Error("The model is down.")),
        })
      );
      yield* published(fixture);
      yield* fixture.finishScheduled();
      expect(yield* passages(fixture)).toEqual([]);
    })
  );

  it.effect("stores nothing when the embedding fails", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* ninaOn(fixture);
      modelReads("Hukum Newton.");
      provider.embeddingModel.mockReset();
      yield* published(fixture);
      yield* fixture.finishScheduled();
      expect(yield* passages(fixture)).toEqual([]);
    })
  );

  it.effect(
    "deletes a school's passages when it turns Nina off, and builds them again when it turns her on",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* ninaOn(fixture);
        modelReads("Hukum Newton.");
        const { itemId } = yield* published(fixture);
        yield* fixture.finishScheduled();
        yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const item = yield* reader.table("classroomLibrary").get(itemId);
            if (item.kind !== "file") {
              return yield* Effect.die("The published item is a file.");
            }
            const [row] = yield* reader
              .table("classroomPassages")
              .index("by_itemId", (query) => query.eq("itemId", itemId))
              .take(1);
            yield* Effect.forEach(
              Arr.range(1, 100),
              (index) =>
                Effect.all([
                  writer.table("classroomLibrary").insert({
                    ...Struct.omit(item, ["_creationTime", "_id"]),
                    clientKey: `salinan-${index}`,
                  }),
                  writer.table("classroomPassages").insert({
                    ...Struct.omit(
                      Option.getOrThrow(Option.fromNullishOr(row)),
                      ["_creationTime", "_id"]
                    ),
                    ordinal: index,
                  }),
                ]),
              { discard: true }
            );
          }).pipe(Effect.orDie)
        );
        expect(yield* passages(fixture)).toHaveLength(101);

        yield* fixture.as("admin").mutation(setPolicy, {
          policy: { key: "nina", value: false },
          slug: nf,
        });
        yield* fixture.finishScheduled();
        expect(yield* passages(fixture)).toEqual([]);

        yield* ninaOn(fixture);
        yield* fixture.finishScheduled();
        expect(yield* passages(fixture)).toHaveLength(101);
      })
  );
});
