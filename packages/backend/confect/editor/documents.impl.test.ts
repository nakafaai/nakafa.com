import { beforeEach, describe, expect, it } from "@effect/vitest";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import refs from "@repo/backend/confect/_generated/refs";
import {
  CONVEX_DOCUMENT_LIMIT,
  MAX_DOCUMENT_BYTES,
} from "@repo/backend/confect/editor/size";
import {
  batchText,
  denied,
  documentRowOf,
  documentRows,
  IDLE,
  jsonValue,
  nf,
  otherSchoolTeacher,
  paragraphText,
  snapshotRows,
} from "@repo/backend/test/editor";
import {
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { utf8Bytes } from "@repo/utilities/text";
import { Array as Arr, Effect } from "effect";

const { create, open } = refs.public.editor.documents;
const other = slugOf("other");

describe("editor/documents open from a snapshot", () => {
  const { submit } = refs.public.editor.steps;
  const { save } = refs.public.editor.snapshots;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "opens the snapshot with only the steps after it, the head of the log, and the session's record",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          content: paragraphText("Soal"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 2),
          documentId: made.id,
          slug: nf,
        });
        vi.setSystemTime(TENANCY_NOW + IDLE);
        yield* teacher.mutation(save, {
          content: paragraphText("Soal"),
          documentId: made.id,
          slug: nf,
          version: 2,
        });
        yield* teacher.mutation(submit, {
          batch: yield* batchText(2, "rina", 1),
          documentId: made.id,
          slug: nf,
        });
        const opened = yield* teacher.query(open, {
          clientId: "rina",
          documentId: made.id,
          slug: nf,
        });
        expect(opened.head).toBe(3);
        expect(opened.snapshot.version).toBe(2);
        expect(Arr.map(opened.steps, (step) => step.version)).toEqual([3]);
        expect(opened.client).toEqual({ batch: "rina-2-1-1", version: 3 });
      })
  );

  it.effect(
    "answers no session record to a session the caller did not make, and none before the first batch",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          content: paragraphText("Soal"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 1),
          documentId: made.id,
          slug: nf,
        });
        const fresh = yield* teacher.query(open, {
          clientId: "hendra",
          documentId: made.id,
          slug: nf,
        });
        const theirs = yield* fixture.as("admin").query(open, {
          clientId: "rina",
          documentId: made.id,
          slug: nf,
        });
        expect(fresh.client).toBeNull();
        expect(theirs.client).toBeNull();
      })
  );
});

/** `count` blockquotes nested around `inner`, each one a level of the document. */
const nestBlockquotes = (count: number, inner: unknown): unknown =>
  count === 0
    ? inner
    : { content: [nestBlockquotes(count - 1, inner)], type: "blockquote" };

/**
 * A document `levels` levels deep: the `doc`, the blockquotes around it, and a
 * paragraph at the bottom. The paragraph is the deepest node.
 */
const documentLevels = (levels: number) =>
  encodeJsonText({
    content: [nestBlockquotes(levels - 2, { type: "paragraph" })],
    type: "doc",
  });

describe("editor/documents create", () => {
  it.effect(
    "stores a document at the node depth bound and reads it back as the same document",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const content = documentLevels(MAX_DOCUMENT_DEPTH);
        const made = yield* fixture.as("teacher").mutation(create, {
          content,
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        const opened = yield* fixture
          .as("teacher")
          .query(open, { clientId: "rina", documentId: made.id, slug: nf });
        expect(jsonValue(opened.snapshot.content)).toEqual(jsonValue(content));
        expect(opened).toMatchObject({ head: 0, snapshot: { version: 0 } });
      })
  );

  it.effect(
    "refuses a document one level deeper than the bound, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const failure = yield* fixture
          .as("admin")
          .mutation(create, {
            content: documentLevels(MAX_DOCUMENT_DEPTH + 1),
            scope: { kind: "tenant" },
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "DocumentInvalid",
          code: "DOCUMENT_INVALID",
        });
        expect(yield* fixture.run(documentRows)).toEqual([]);
      })
  );

  it.effect(
    "refuses content the contract does not accept, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const failure = yield* fixture
          .as("admin")
          .mutation(create, {
            content: encodeJsonText({
              content: [{ type: "notABlock" }],
              type: "doc",
            }),
            scope: { kind: "tenant" },
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "DocumentInvalid" });
        expect(yield* fixture.run(documentRows)).toEqual([]);
      })
  );

  it.effect(
    "refuses a document whose complete row reaches one MiB, though its text fits, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const overhead = utf8Bytes(paragraphText(""));
        const failure = yield* fixture
          .as("admin")
          .mutation(create, {
            content: paragraphText("a".repeat(MAX_DOCUMENT_BYTES - overhead)),
            scope: { kind: "tenant" },
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "DocumentTooLarge",
          limit: CONVEX_DOCUMENT_LIMIT,
        });
        expect(yield* fixture.run(documentRows)).toEqual([]);
        expect(yield* fixture.run(snapshotRows)).toEqual([]);
      })
  );

  it.effect(
    "starts a document at head 0, with snapshot version 0 on the row the sweep reads",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("teacher").mutation(create, {
          content: paragraphText("Soal"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        const row = yield* fixture.run(documentRowOf(made.id));
        expect(row).toMatchObject({ head: 0, snapshotVersion: 0 });
      })
  );

  it.effect(
    "lets a teacher create in its unit, and refuses a unit it does not teach or an archived unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const content = paragraphText("Soal");
        yield* fixture.as("teacher").mutation(create, {
          content,
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        const otherUnit = yield* fixture
          .as("teacher")
          .mutation(create, {
            content,
            scope: { kind: "unit", unitId: fixture.units.sma },
            slug: nf,
          })
          .pipe(Effect.flip);
        const archived = yield* fixture
          .as("admin")
          .mutation(create, {
            content,
            scope: { kind: "unit", unitId: fixture.units.smk },
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(yield* fixture.run(documentRows)).toHaveLength(1);
        expect([otherUnit, archived]).toMatchObject([
          denied("role"),
          denied("condition"),
        ]);
      })
  );

  it.effect(
    "lets an Admin create a tenant-wide document, and refuses a teacher of one unit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const content = paragraphText("Pengumuman");
        yield* fixture
          .as("admin")
          .mutation(create, { content, scope: { kind: "tenant" }, slug: nf });
        const refused = yield* fixture
          .as("teacher")
          .mutation(create, { content, scope: { kind: "tenant" }, slug: nf })
          .pipe(Effect.flip);
        expect(yield* fixture.run(documentRows)).toHaveLength(1);
        expect(refused).toMatchObject(denied("role"));
      })
  );

  it.effect("refuses a student, and a Person of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const content = paragraphText("Soal");
      const student = yield* fixture
        .as("student")
        .mutation(create, {
          content,
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        })
        .pipe(Effect.flip);
      const foreign = yield* (yield* otherSchoolTeacher(fixture))
        .mutation(create, { content, scope: { kind: "tenant" }, slug: nf })
        .pipe(Effect.flip);
      expect(student).toMatchObject(denied("role"));
      expect(foreign).toMatchObject({ _tag: "NotMember", code: "NOT_MEMBER" });
    })
  );
});

describe("editor/documents open", () => {
  it.effect(
    "opens a document to a teacher of its unit, and refuses a student of it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("teacher").mutation(create, {
          content: paragraphText("Soal"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        const opened = yield* fixture
          .as("teacher")
          .query(open, { clientId: "rina", documentId: made.id, slug: nf });
        const student = yield* fixture
          .as("student")
          .query(open, { clientId: "rina", documentId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(opened.steps).toEqual([]);
        expect(student).toMatchObject(denied("role"));
      })
  );

  it.effect(
    "refuses a document of this school to a teacher of another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("admin").mutation(create, {
          content: paragraphText("Pengumuman"),
          scope: { kind: "tenant" },
          slug: nf,
        });
        const teacher = yield* otherSchoolTeacher(fixture);
        const refused = yield* teacher
          .query(open, { clientId: "rina", documentId: made.id, slug: other })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("resource"));
      })
  );
});
