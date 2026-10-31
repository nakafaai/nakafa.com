import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { THUMBNAIL_BYTE_LIMIT } from "@repo/backend/confect/classroom/forum/attachment";
import { SCHOOL_BYTE_LIMIT } from "@repo/backend/confect/classroom/forum/use";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { otherSchoolTeacher } from "@repo/backend/test/editor";
import { png } from "@repo/backend/test/exams";
import { storeFile } from "@repo/backend/test/logo";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Option } from "effect";

const { register, uploadUrl, withdraw } = refs.public.classroom.forum.files;
const { sweep } = refs.internal.classroom.forum.files;
const { hide, page, send } = refs.public.classroom.forum.messages;
const channels = refs.public.classroom.forum.channels;

/** The leading bytes of a PDF. */
const pdf = () =>
  new Blob(["%PDF-1.7\n1 0 obj\n"], { type: "application/pdf" });

/** The leading bytes of a Word file of today, which is a ZIP file. */
const docx = () => new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])]);

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
  });

  it.effect(
    "sends a photo with its small copy, shows its sealed name to the class, and counts its bytes for the school",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const storageId = yield* storeFile(fixture.convex, png());
        const thumbnailId = yield* storeFile(fixture.convex, png());
        const teacher = fixture.as("teacher");
        const upload = yield* teacher.action(register, {
          classId: forum.classId,
          height: 600,
          name: "papan tulis.png",
          slug: nf,
          storageId,
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
        expect(Option.getOrNull(rows.use)?.bytes).toBe(upload.byteSize);
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
          storageId: yield* storeFile(fixture.convex, pdf()),
        });
        const word = yield* teacher.action(register, {
          ...args,
          name: "Rencana.DOCX",
          storageId: yield* storeFile(fixture.convex, docx()),
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
            byteSize: pdf().size,
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

  it.effect("shows a file the storage no longer holds without an address", () =>
    Effect.gen(function* () {
      const { fixture, forum } = yield* classForum;
      const storageId = yield* storeFile(fixture.convex, pdf());
      const teacher = fixture.as("teacher");
      const upload = yield* teacher.action(register, {
        classId: forum.classId,
        height: null,
        name: "soal.pdf",
        slug: nf,
        storageId,
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
      yield* Effect.promise(() =>
        fixture.convex.run((ctx) => ctx.storage.delete(storageId))
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
    "gives whoever writes in the class an upload address, and refuses an outsider",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const args = { classId: forum.classId, slug: nf };
        const url = yield* fixture.as("teacher").mutation(uploadUrl, args);
        expect(url.href.startsWith("http")).toBe(true);
        const outsider = yield* otherSchoolTeacher(fixture);
        const refused = yield* outsider
          .action(register, {
            ...args,
            height: null,
            name: "soal.pdf",
            storageId: yield* storeFile(fixture.convex, pdf()),
            thumbnailId: null,
            width: null,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AccessDenied" });
      })
  );

  it.effect(
    "refuses and deletes what is no photo, PDF or office document, a name it does not match included",
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
        const script = yield* storeFile(fixture.convex, new Blob(["hello"]));
        const disguised = yield* storeFile(fixture.convex, new Blob(["hello"]));
        const failures = yield* Effect.all([
          teacher
            .action(register, { ...args, name: "virus.exe", storageId: script })
            .pipe(Effect.flip),
          teacher
            .action(register, {
              ...args,
              name: "tugas.docx",
              storageId: disguised,
            })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          { _tag: "AttachmentRefused" },
          { _tag: "AttachmentRefused" },
        ]);
        const left = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("_storage").index("by_creation_time").take(4)
          )
        );
        expect(left).toEqual([]);
      })
  );

  it.effect(
    "refuses a file past the limit, and a small copy that is no image or too large",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const teacher = fixture.as("teacher");
        const args = {
          classId: forum.classId,
          height: 1,
          name: "foto.png",
          slug: nf,
          width: 1,
        };
        const failures = yield* Effect.all([
          teacher
            .action(register, {
              ...args,
              storageId: yield* storeFile(
                fixture.convex,
                new Blob([new Uint8Array(LIBRARY_BYTE_LIMIT + 1)])
              ),
              thumbnailId: null,
            })
            .pipe(Effect.flip),
          teacher
            .action(register, {
              ...args,
              storageId: yield* storeFile(fixture.convex, png()),
              thumbnailId: yield* storeFile(
                fixture.convex,
                new Blob([new Uint8Array(THUMBNAIL_BYTE_LIMIT + 1)])
              ),
            })
            .pipe(Effect.flip),
          teacher
            .action(register, {
              ...args,
              storageId: yield* storeFile(fixture.convex, png()),
              thumbnailId: yield* storeFile(fixture.convex, pdf()),
            })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          { _tag: "FileSizeRefused" },
          { _tag: "FileSizeRefused" },
          { _tag: "AttachmentRefused" },
        ]);
      })
  );

  it.effect(
    "refuses a file past what the school's chats hold, and deletes it",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("classroomFileUse").insert({
              bytes: SCHOOL_BYTE_LIMIT,
              tenantId: fixture.tenants.nf,
            })
          )
        );
        const refused = yield* fixture
          .as("teacher")
          .action(register, {
            classId: forum.classId,
            height: null,
            name: "soal.pdf",
            slug: nf,
            storageId: yield* storeFile(fixture.convex, pdf()),
            thumbnailId: null,
            width: null,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "FileQuotaReached" });
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
          storageId: yield* storeFile(fixture.convex, pdf()),
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
        storageId: yield* storeFile(fixture.convex, pdf()),
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
              storageId: yield* storeFile(fixture.convex, png()),
              thumbnailId: yield* storeFile(fixture.convex, png()),
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
          storageId: yield* storeFile(fixture.convex, png()),
          thumbnailId: yield* storeFile(fixture.convex, png()),
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
        const left = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("_storage").index("by_creation_time").take(4)
          )
        );
        expect(left).toEqual([]);
      })
  );
});
