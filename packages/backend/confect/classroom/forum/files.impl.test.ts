import type { GenericId } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  fileRows,
  makeBucket,
  stubBucket,
  uploadReserved,
} from "@repo/backend/test/bucket";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { PDF, PNG } from "@repo/backend/test/library";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Option } from "effect";

const { register, reserve, withdraw } = refs.public.classroom.forum.files;
const { sweep } = refs.internal.classroom.forum.files;
const { hide, page, send } = refs.public.classroom.forum.messages;
const channels = refs.public.classroom.forum.channels;

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

/** The leading bytes of a Word file of today, which is a ZIP file. */
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]);

/** Reserves one file of a class as its teacher and uploads its bytes as the browser does, answering the file's ID. */
const uploaded = (
  fixture: Effect.Success<typeof keyedFixture>,
  classId: GenericId.GenericId<"classes">,
  bytes: Uint8Array
) =>
  uploadReserved(
    bucket,
    fixture.as("teacher").mutation(reserve, {
      byteSize: bytes.byteLength,
      classId,
      contentType: "application/octet-stream",
      slug: nf,
    }),
    bytes
  );

/** A class with its general channel, whose teacher and student write in it. */
const classForum = Effect.gen(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  return { fixture, forum };
});

/** The rows of a school's chats that a test reads: its unsent uploads and its use in bytes. */
const stored = Effect.gen(function* () {
  const reader = yield* DatabaseReader;
  return {
    uploads: yield* reader
      .table("classroomUploads")
      .index("by_creation_time")
      .take(16),
    use: yield* reader
      .table("classroomFileUse")
      .index("by_creation_time")
      .first(),
  };
});

describe("classroom/forum files", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    bucket.state.objects = {};
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    stubBucket();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "sends a photo with its small copy, shows its sealed name to the class, and counts its bytes for the school",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const fileId = yield* uploaded(fixture, forum.classId, PNG);
        const thumbnailId = yield* uploaded(fixture, forum.classId, PNG);
        const teacher = fixture.as("teacher");
        const upload = yield* teacher.action(register, {
          classId: forum.classId,
          height: 600,
          name: "papan tulis.png",
          slug: nf,
          fileId,
          thumbnailId,
          width: 800,
        });
        expect(upload.kind).toBe("image");
        const sent = yield* teacher.mutation(send, {
          ...forum,
          attachments: [upload.id],
          clientKey: "photo-message",
          mentions: [],
          poll: null,
          slug: nf,
          text: "",
        });
        expect(sent.attachments).toEqual([
          {
            address: expect.any(String),
            byteSize: upload.byteSize,
            height: 600,
            kind: "image",
            name: "papan tulis.png",
            thumbnail: expect.any(String),
            width: 800,
          },
        ]);
        const listed = yield* fixture.as("student").query(page, {
          ...firstPage,
          ...forum,
          slug: nf,
        });
        expect(listed.page[0]?.attachments[0]?.name).toBe("papan tulis.png");
        const chats = yield* fixture.as("student").query(channels.list, {
          ...firstPage,
          classId: forum.classId,
          slug: nf,
        });
        expect(chats.page[0]?.last).toMatchObject({ media: "image", text: "" });
        const rows = yield* fixture.run(stored);
        expect(rows.uploads).toEqual([]);
        // The small copy is the school's too, so both files count.
        expect(Option.getOrNull(rows.use)?.bytes).toBe(
          upload.byteSize + PNG.byteLength
        );
      })
  );

  it.effect(
    "keeps a PDF and an office document as documents, by their bytes",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const args = {
          classId: forum.classId,
          height: null,
          slug: nf,
          thumbnailId: null,
          width: null,
        };
        const teacher = fixture.as("teacher");
        const paper = yield* teacher.action(register, {
          ...args,
          name: "soal.pdf",
          fileId: yield* uploaded(fixture, forum.classId, PDF),
        });
        const word = yield* teacher.action(register, {
          ...args,
          name: "Rencana.DOCX",
          fileId: yield* uploaded(fixture, forum.classId, DOCX),
        });
        expect([paper.kind, word.kind]).toEqual(["document", "document"]);
        const sent = yield* teacher.mutation(send, {
          ...forum,
          attachments: [paper.id],
          clientKey: "paper-message",
          mentions: [],
          poll: null,
          slug: nf,
          text: "",
        });
        expect(sent.attachments).toEqual([
          {
            address: expect.any(String),
            byteSize: PDF.byteLength,
            height: null,
            kind: "document",
            name: "soal.pdf",
            thumbnail: null,
            width: null,
          },
        ]);
        const hidden = yield* teacher.mutation(hide, {
          classId: forum.classId,
          messageId: sent.id,
          slug: nf,
        });
        expect(hidden.attachments).toEqual([]);
      })
  );

  it.effect("shows a file the bucket no longer holds without an address", () =>
    Effect.gen(function* () {
      const { fixture, forum } = yield* classForum;
      const fileId = yield* uploaded(fixture, forum.classId, PDF);
      const teacher = fixture.as("teacher");
      const upload = yield* teacher.action(register, {
        classId: forum.classId,
        height: null,
        name: "soal.pdf",
        slug: nf,
        fileId,
        thumbnailId: null,
        width: null,
      });
      yield* teacher.mutation(send, {
        ...forum,
        attachments: [upload.id],
        clientKey: "gone-file",
        mentions: [],
        poll: null,
        slug: nf,
        text: "",
      });
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("bucketFiles").delete(fileId)
        ).pipe(Effect.orDie)
      );
      const listed = yield* fixture.as("student").query(page, {
        ...firstPage,
        ...forum,
        slug: nf,
      });
      expect(listed.page[0]?.attachments[0]?.address).toBeNull();
    })
  );

  it.effect(
    "refuses another person's upload, and a message with nothing in it",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const upload = yield* fixture.as("teacher").action(register, {
          classId: forum.classId,
          height: null,
          name: "soal.pdf",
          slug: nf,
          fileId: yield* uploaded(fixture, forum.classId, PDF),
          thumbnailId: null,
          width: null,
        });
        const args = { ...forum, mentions: [], poll: null, slug: nf };
        const failures = yield* Effect.all([
          fixture
            .as("student")
            .mutation(send, {
              ...args,
              attachments: [upload.id],
              clientKey: "stolen-upload",
              text: "ini punyaku",
            })
            .pipe(Effect.flip),
          fixture
            .as("student")
            .mutation(send, {
              ...args,
              attachments: [],
              clientKey: "empty-message",
              text: "",
            })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          { _tag: "UploadGone" },
          { _tag: "MessageEmpty" },
        ]);
      })
  );

  it.effect("takes back an unsent file, for its author alone", () =>
    Effect.gen(function* () {
      const { fixture, forum } = yield* classForum;
      const upload = yield* fixture.as("teacher").action(register, {
        classId: forum.classId,
        height: null,
        name: "soal.pdf",
        slug: nf,
        fileId: yield* uploaded(fixture, forum.classId, PDF),
        thumbnailId: null,
        width: null,
      });
      const args = { classId: forum.classId, slug: nf, uploadId: upload.id };
      const refused = yield* fixture
        .as("student")
        .mutation(withdraw, args)
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("resource"));
      yield* fixture.as("teacher").mutation(withdraw, args);
      const rows = yield* fixture.run(stored);
      expect(rows.uploads).toEqual([]);
      expect(Option.getOrNull(rows.use)?.bytes).toBe(0);
    })
  );

  it.effect(
    "deletes a file that stayed unsent past a day, and keeps a newer one",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const add = (name: string) =>
          Effect.gen(function* () {
            return yield* fixture.as("teacher").action(register, {
              classId: forum.classId,
              height: 1,
              name,
              slug: nf,
              fileId: yield* uploaded(fixture, forum.classId, PNG),
              thumbnailId: yield* uploaded(fixture, forum.classId, PNG),
              width: 1,
            });
          });
        yield* add("lama.png");
        vi.setSystemTime(TENANCY_NOW + Duration.toMillis(Duration.hours(25)));
        const newer = yield* add("baru.png");
        const swept = yield* fixture.internal.mutation(sweep, {});
        expect(swept).toEqual({ deleted: 1 });
        const rows = yield* fixture.run(stored);
        expect(Arr.map(rows.uploads, (row) => row._id)).toEqual([newer.id]);
      })
  );

  it.effect(
    "deletes a message's files when a teacher hides it, and gives their bytes back",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const teacher = fixture.as("teacher");
        const upload = yield* teacher.action(register, {
          classId: forum.classId,
          height: 1,
          name: "papan.png",
          slug: nf,
          fileId: yield* uploaded(fixture, forum.classId, PNG),
          thumbnailId: yield* uploaded(fixture, forum.classId, PNG),
          width: 1,
        });
        const sent = yield* teacher.mutation(send, {
          ...forum,
          attachments: [upload.id],
          clientKey: "hidden-photo",
          mentions: [],
          poll: null,
          slug: nf,
          text: "Foto papan",
        });
        const hidden = yield* teacher.mutation(hide, {
          classId: forum.classId,
          messageId: sent.id,
          slug: nf,
        });
        expect(hidden.attachments).toEqual([]);
        const rows = yield* fixture.run(stored);
        expect(Option.getOrNull(rows.use)?.bytes).toBe(0);
        expect(yield* fixture.run(fileRows)).toEqual([]);
      })
  );
});
