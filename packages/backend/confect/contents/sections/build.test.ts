import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import type { runStep } from "@repo/backend/confect/contents/sections/build";
import { PRUNE_BATCH_SIZE } from "@repo/backend/confect/contents/sections/limits";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { provider } from "@repo/backend/test/gateway";
import {
  editKnowledgeLesson,
  embedWhileAnotherReleaseActivates,
  embedWithKnowledge,
  embedWithRefusal,
  KNOWLEDGE_RELEASE,
  knowledgeBuild,
  knowledgeSource,
  leaveDocument,
  measuredBuild,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import {
  Array as Arr,
  Number as Num,
  Option,
  Order,
  String as Str,
} from "effect";

beforeEach(() => vi.useFakeTimers());
afterEach(() => provider.embeddingModel.mockReset());

type Input = Parameters<typeof runStep>[0];

/** Makes the record of the finished build name an earlier release, as it does after an activation. */
async function finishedEarlierRelease(ctx: MutationCtx) {
  for (const record of await ctx.db.query("contentSectionState").collect()) {
    await ctx.db.patch("contentSectionState", record._id, {
      releaseId: "release-earlier",
    });
  }
}

function setup() {
  const t = createConvexTestWithBetterAuth();
  const rows = () =>
    t.query((ctx) => ctx.db.query("contentSections").collect());
  const sources = () =>
    t.query((ctx) => ctx.db.query("contentSectionSources").collect());
  return { ...knowledgeBuild(t), rows, sources, t };
}

/** The vector and the place of the Indonesian determinant section of the first lesson, as the index stores them. */
const determinantOf = (
  stored: Awaited<ReturnType<ReturnType<typeof setup>["rows"]>>
) =>
  Option.map(
    Arr.findFirst(
      stored,
      (row) =>
        row.appLocale === "id" &&
        row.anchor === "determinan" &&
        row.contentKey.endsWith("section-1")
    ),
    ({ embedding, ordinal }) => ({ embedding, ordinal })
  );

/** The texts that the steps sent to the embedder. */
const embeddedBy = (
  steps: Awaited<ReturnType<ReturnType<typeof setup>["build"]>>
) => Num.sumAll(Arr.map(steps, ({ embedded }) => embedded));

/** The documents that the steps passed over because the index held them. */
const skippedBy = (
  steps: Awaited<ReturnType<ReturnType<typeof setup>["build"]>>
) => Num.sumAll(Arr.map(steps, ({ skipped }) => skipped));

describe("section build", () => {
  it("indexes the active release: its lessons, then its Quran, then a clean up", async () => {
    const model = embedWithKnowledge();
    const { build, rows, sources, t } = setup();
    await t.mutation(seedKnowledge);
    const steps = await build();
    expect(Arr.map(steps, ({ position }) => position.phase)).toEqual([
      "lessons",
      "lessons",
      "quran",
      "prune",
    ]);
    expect(embeddedBy(steps)).toBe(27);
    expect(skippedBy(steps)).toBe(0);
    expect(
      Arr.flatMap(model.doEmbedCalls, ({ values }) => values)
    ).toHaveLength(27);
    const stored = await rows();
    expect(stored).toHaveLength(27);
    expect(
      Arr.every(stored, (row) => row.embedding.length === embeddingDimensions)
    ).toBe(true);
    expect(await sources()).toHaveLength(9);
    expect(
      Arr.every(await sources(), ({ version }) =>
        Str.startsWith("1:google/gemini-embedding-2:sha256:")(version)
      )
    ).toBe(true);
  });

  it("schedules the step that follows a step", async () => {
    embedWithKnowledge();
    const { run, t } = setup();
    await t.mutation(seedKnowledge);
    const first = await run();
    const jobs = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      args: [first.next],
      name: "contents/sections/build:run",
    });
  });

  it("writes a row for each section it embedded, a record for each document, and the record of the build, and nothing else", async () => {
    embedWithKnowledge();
    const { t } = setup();
    await t.mutation(seedKnowledge);
    const { total } = await measuredBuild(t);
    // 27 sections, 9 documents, and the record that the build finished. The
    // reads are the lessons (40), the state that each of the 9 stores reads
    // (the checks of an empty index read nothing), the Quran (2), the clean up
    // (19), and the record (1).
    expect(total.documentsWritten).toBe(37);
    expect(total.documentsRead).toBe(71);
  });

  it("passes over every document it holds, embeds nothing, and writes nothing", async () => {
    const model = embedWithKnowledge();
    const { build, rows, sources, t } = setup();
    await t.mutation(seedKnowledge);
    await build();
    const before = { rows: await rows(), sources: await sources() };
    model.doEmbedCalls.length = 0;
    const { steps, total } = await measuredBuild(t);
    expect(embeddedBy(steps)).toBe(0);
    expect(skippedBy(steps)).toBe(9);
    expect(model.doEmbedCalls).toHaveLength(0);
    expect(await rows()).toEqual(before.rows);
    expect(await sources()).toEqual(before.sources);
    // Four documents for each lesson it passes over (its search row, its head,
    // its route, and its record), two for each of the two pages that load the
    // active release, two for the Quran, two for each document the clean up
    // checks (its record and its head) and one more, and two for the record.
    expect(total.documentsRead).toBe(63);
    expect(total.documentsWritten).toBe(0);
  });

  it("writes the changed section, the record of its document, and the record of the build, when a new release edits one section", async () => {
    const model = embedWithKnowledge();
    const { t } = setup();
    await t.mutation(seedKnowledge);
    await measuredBuild(t);
    await t.mutation((ctx) =>
      editKnowledgeLesson(
        ctx,
        1,
        "id",
        Arr.join(
          [
            "Matriks menyusun bilangan.",
            "## Bentuk Matriks",
            "Matriks berubah di satu kalimat.",
            "### Matriks Persegi",
            "Matriks persegi memiliki baris dan kolom yang sama banyak.",
            "## Determinan",
            "Determinan matriks dua kali dua adalah ad dikurangi bc.",
          ],
          "\n\n"
        )
      )
    );
    // An edit comes with a new release, so the index was last completed for
    // the release before it.
    await t.mutation(finishedEarlierRelease);
    model.doEmbedCalls.length = 0;
    const { steps, total } = await measuredBuild(t);
    expect(embeddedBy(steps)).toBe(1);
    expect(Arr.flatMap(model.doEmbedCalls, ({ values }) => values)).toEqual([
      expect.stringContaining("Matriks berubah di satu kalimat."),
    ]);
    // The 64 documents that a build of a new release with nothing new reads,
    // and 13 more for the edited lesson: its artifact, the 4 stored sections
    // that the check reads, and the 8 documents that its store reads. It
    // writes the section, the record of its document, and the record of the
    // build.
    expect(total.documentsRead).toBe(77);
    expect(total.documentsWritten).toBe(3);
  });

  it("embeds one text and writes the rows of the lesson when a new release inserts a section", async () => {
    const model = embedWithKnowledge();
    const { t } = setup();
    await t.mutation(seedKnowledge);
    await measuredBuild(t);
    await t.mutation((ctx) =>
      editKnowledgeLesson(
        ctx,
        1,
        "id",
        Arr.join(
          [
            "Matriks menyusun bilangan.",
            "## Bentuk Matriks",
            "Matriks menyusun bilangan dalam baris dan kolom.",
            "### Matriks Persegi",
            "Matriks persegi memiliki baris dan kolom yang sama banyak.",
            "## Bagian Baru",
            "Isi bagian baru.",
            "## Determinan",
            "Determinan matriks dua kali dua adalah ad dikurangi bc.",
          ],
          "\n\n"
        )
      )
    );
    await t.mutation(finishedEarlierRelease);
    model.doEmbedCalls.length = 0;
    const { steps, total } = await measuredBuild(t);
    // The last section stands a place further, with the same text and so the
    // same vector.
    expect(embeddedBy(steps)).toBe(1);
    expect(Arr.flatMap(model.doEmbedCalls, ({ values }) => values)).toEqual([
      expect.stringContaining("Isi bagian baru."),
    ]);
    // Each row of the lesson says how many sections it has, so all 5 are
    // written, with the record of the document and the record of the build.
    expect(total.documentsRead).toBe(80);
    expect(total.documentsWritten).toBe(7);
  });

  it("embeds nothing and writes only the record of the build when the release it finished is a new one", async () => {
    const model = embedWithKnowledge();
    const { build, t } = setup();
    await t.mutation(seedKnowledge);
    await build();
    // The index was last completed for an earlier release, as after an activation.
    await t.mutation(finishedEarlierRelease);
    model.doEmbedCalls.length = 0;
    const { total } = await measuredBuild(t);
    expect(model.doEmbedCalls).toHaveLength(0);
    // The 63 documents that a build of nothing new reads, and the record of the
    // earlier release, which replacing it reads.
    expect(total.documentsRead).toBe(64);
    expect(total.documentsWritten).toBe(1);
    expect(
      await t.query((ctx) => ctx.db.query("contentSectionState").collect())
    ).toMatchObject([{ releaseId: KNOWLEDGE_RELEASE.releaseId }]);
  });

  it("embeds only the sections whose text changed, and removes those that vanished", async () => {
    const model = embedWithKnowledge();
    const { build, rows, sources, t } = setup();
    await t.mutation(seedKnowledge);
    await build();
    const determinant = determinantOf(await rows());
    await t.mutation(async (ctx) => {
      // In the active release one section of the Indonesian lesson is gone,
      // so the one after it moves up a place, and a lesson that no release
      // holds any more still has rows.
      await editKnowledgeLesson(
        ctx,
        1,
        "id",
        Arr.join(
          [
            "Matriks menyusun bilangan.",
            "## Bentuk Matriks",
            "Matriks menyusun bilangan dalam baris dan kolom.",
            "## Determinan",
            "Determinan matriks dua kali dua adalah ad dikurangi bc.",
          ],
          "\n\n"
        )
      );
      await leaveDocument(
        ctx,
        { ...knowledgeSource(1, "id"), contentKey: "material/lesson/removed" },
        [0]
      );
    });
    model.doEmbedCalls.length = 0;
    const steps = await build();
    // No text is new: the section that moved up keeps its vector.
    expect(embeddedBy(steps)).toBe(0);
    expect(skippedBy(steps)).toBe(8);
    expect(model.doEmbedCalls).toHaveLength(0);
    const stored = await rows();
    expect(determinantOf(stored)).toEqual(
      Option.map(determinant, ({ embedding }) => ({ embedding, ordinal: 2 }))
    );
    expect(stored).toHaveLength(26);
    expect(
      Arr.sort(
        Arr.map(
          Arr.filter(
            stored,
            ({ appLocale, contentKey }) =>
              appLocale === "id" && contentKey.endsWith("section-1")
          ),
          ({ anchor, count, ordinal }) => `${ordinal}/${count} ${anchor}`
        ),
        Order.String
      )
    ).toEqual(["0/3 top", "1/3 bentuk-matriks", "2/3 determinan"]);
    expect(
      Arr.some(
        stored,
        ({ contentKey }) => contentKey === "material/lesson/removed"
      )
    ).toBe(false);
    expect(await sources()).toHaveLength(9);
  });

  it("fails at a lesson whose source cannot be split, names it, and stores nothing of its page", async () => {
    embedWithKnowledge();
    const { failure, rows, run, t } = setup();
    await t.mutation(async (ctx) => {
      await seedKnowledge(ctx);
      await editKnowledgeLesson(ctx, 1, "id", "<Broken");
    });
    // The Indonesian lessons come on the second page, after German and English.
    const first = await run();
    assert.ok(first.next, "Expected a second page of lessons.");
    const stored = await rows();
    const failed = await failure(first.next);
    expect(failed._tag).toBe("ReleaseError");
    expect(Str.startsWith("Lesson material/lesson/")(failed.message)).toBe(
      true
    );
    expect(failed.message).toContain(
      "section-1/id cannot be split into sections"
    );
    expect(await rows()).toEqual(stored);
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      )
    ).toHaveLength(1);
  });

  it("records the finished build only when its last step ends", async () => {
    embedWithKnowledge();
    const { run, t } = setup();
    await t.mutation(seedKnowledge);
    const recorded = () =>
      t.query((ctx) => ctx.db.query("contentSectionState").collect());
    let input: Input | null = {};
    while (input !== null) {
      const step = await run(input);
      expect(await recorded()).toHaveLength(step.next === null ? 1 : 0);
      input = step.next;
    }
    expect(await recorded()).toMatchObject([
      {
        key: "primary",
        model: "google/gemini-embedding-2",
        releaseId: KNOWLEDGE_RELEASE.releaseId,
      },
    ]);
  });

  it("stops without a trace when the release changed under the build", async () => {
    const model = embedWithKnowledge();
    const { run, t } = setup();
    await t.mutation(seedKnowledge);
    for (const input of [
      { releaseId: "release-earlier" },
      { position: { phase: "quran", surah: 1 }, releaseId: "release-earlier" },
      {
        position: { cursor: null, phase: "prune" },
        releaseId: "release-earlier",
      },
      { position: { cursor: null, phase: "prune" } },
    ] satisfies Input[]) {
      expect(await run(input)).toMatchObject({ next: null, stale: true });
    }
    expect(model.doEmbedCalls).toHaveLength(0);
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      )
    ).toEqual([]);
  });

  it("stores nothing and stops when another release becomes active while a page is embedded", async () => {
    const { rows, run, sources, t } = setup();
    await t.mutation(seedKnowledge);
    embedWhileAnotherReleaseActivates(t);
    expect(await run()).toMatchObject({
      embedded: expect.any(Number),
      next: null,
      stale: true,
      written: 0,
    });
    expect(await rows()).toEqual([]);
    expect(await sources()).toEqual([]);
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      )
    ).toEqual([]);
  });

  it("fails with the failure of the embedder and stores nothing of the page", async () => {
    const { failure, rows, sources, t } = setup();
    await t.mutation(seedKnowledge);
    embedWithRefusal();
    expect(await failure()).toMatchObject({ _tag: "GatewayFailure" });
    expect(await rows()).toEqual([]);
    expect(await sources()).toEqual([]);
  });

  it("deletes the documents that no release publishes any more in bounded batches, and records the build after the last", async () => {
    embedWithKnowledge();
    const { run, rows, sources, t } = setup();
    // Two documents of a little more than half a batch each: the second does
    // not fit what the first leaves, so it goes with the next step.
    const rowsOfEach = PRUNE_BATCH_SIZE / 2 + 1;
    await t.mutation(async (ctx) => {
      await seedKnowledge(ctx);
      for (const contentKey of [
        "material/lesson/removed",
        "material/lesson/removed-too",
      ]) {
        await leaveDocument(
          ctx,
          { ...knowledgeSource(1, "id"), contentKey },
          Arr.range(1, rowsOfEach)
        );
      }
    });
    const position = { cursor: null, phase: "prune" } as const;
    const releaseId = KNOWLEDGE_RELEASE.releaseId;
    const first = await run({ position, releaseId });
    expect(first).toMatchObject({ removed: rowsOfEach, stale: false });
    expect(first.next).toEqual({ position, releaseId });
    expect(await rows()).toHaveLength(rowsOfEach);
    expect(await sources()).toHaveLength(1);
    expect(
      await t.query((ctx) => ctx.db.query("contentSectionState").collect())
    ).toEqual([]);
    expect(await run({ position, releaseId })).toMatchObject({
      next: null,
      removed: rowsOfEach,
      stale: false,
    });
    expect(await rows()).toHaveLength(0);
    expect(await sources()).toHaveLength(0);
    expect(
      await t.query((ctx) => ctx.db.query("contentSectionState").collect())
    ).toHaveLength(1);
  });
});
