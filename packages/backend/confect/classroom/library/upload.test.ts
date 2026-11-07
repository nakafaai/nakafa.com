import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import { connect } from "@repo/backend/confect/connectors/connection";
import {
  isBucketRequest,
  makeBucket,
  stubBucket,
} from "@repo/backend/test/bucket";
import { firstPage, nf } from "@repo/backend/test/classroom";
import { libraryClass } from "@repo/backend/test/library";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Record as Rec } from "effect";

/** The fetch that R2 and the Drive import call, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const library = refs.public.classroom.library;

/** Every row of the class libraries, so a test reads what the server stored. */
const libraryRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("classroomLibrary").index("by_creation_time").take(100)
);

/** The one R2 the file's tests share, emptied before each test. */
const bucket = makeBucket();

/**
 * Google as the Drive import meets it: a refreshed token, the picked file's
 * metadata `file`, and its bytes `bytes`. Every request to R2 goes to the bucket.
 */
const driveAnswers = (file: object, bytes: string) =>
  fetcher.mockImplementation((input, init) => {
    if (isBucketRequest(input)) {
      return bucket.answer(input, init);
    }
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return Promise.resolve(
        new Response(
          encodeJsonText({
            access_token: "access",
            expires_in: 3599,
            scope: "",
          })
        )
      );
    }
    return Promise.resolve(
      new Response(url.includes("alt=media") ? bytes : encodeJsonText(file))
    );
  });

/** The Drive reads the import sent, by whether each asked for the bytes. */
const driveReads = () =>
  Arr.filter(
    Arr.map(fetcher.mock.calls, ([input]) => String(input)),
    (url) => url.startsWith("https://www.googleapis.com/drive/v3/files/")
  );

/** A personal Drive connection of the fixture's teacher. */
const teacherDrive = (fixture: Effect.Success<typeof tenancyFixture>) =>
  fixture.run(
    Effect.gen(function* () {
      const person = yield* (yield* DatabaseReader)
        .table("tenantPeople")
        .get(fixture.people.teacher.personId);
      if (person.account.state !== "claimed") {
        return yield* Effect.die("The teacher holds an account.");
      }
      const userId = person.account.userId;
      return yield* connect(
        { id: userId, kind: "user" },
        { kind: "personal", userId },
        {
          connector: "drive",
          googleSubject: "teacher-subject",
          refreshToken: "refresh-drive",
          scopes: ["openid"],
        }
      );
    }).pipe(Effect.orDie)
  );

describe("classroom/library Drive import", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    fetcher.mockReset();
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    bucket.state.objects = {};
    bucket.state.failing = false;
    stubBucket();
    vi.stubEnv("GOOGLE_CONNECTORS", "drive");
    vi.stubEnv("GOOGLE_PICKER_API_KEY", "picker-key");
    vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_SECRET", "secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "imports a picked Drive PDF through the teacher's own Drive, once for a client key, and lists it as a file of the class",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        yield* teacherDrive(fixture);
        const bytes = "%PDF-1.7\n1 0 obj\n";
        driveAnswers(
          { mimeType: "application/pdf", name: "Modul.pdf", size: "17" },
          bytes
        );
        const importDrive = (clientKey: string) =>
          fixture.as("teacher").action(library.importDrive, {
            folderId: null,
            classId,
            clientKey,
            fileId: "drive-file-1",
            slug: nf,
            title: "Modul dari Drive",
          });
        const imported = yield* importDrive("drive-module");
        expect((yield* importDrive("drive-module")).id).toBe(imported.id);
        expect(driveReads()).toHaveLength(4);
        yield* fixture.finishScheduled();
        expect(Rec.values(bucket.state.objects)).toHaveLength(1);
        const listed = yield* fixture.as("student").query(library.list, {
          folderId: null,
          ...firstPage,
          classId,
          slug: nf,
        });
        expect(listed.page).toMatchObject([
          {
            byteSize: bytes.length,
            id: imported.id,
            kind: "pdf",
            title: "Modul dari Drive",
          },
        ]);
      })
  );

  it.effect(
    "refuses a Google document, a file over the limit before reading its bytes, and bytes that are no PDF or image, storing nothing",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        yield* teacherDrive(fixture);
        const refused = (file: object, bytes: string) => {
          fetcher.mockReset();
          driveAnswers(file, bytes);
          return fixture
            .as("teacher")
            .action(library.importDrive, {
              folderId: null,
              classId,
              clientKey: "drive-refused",
              fileId: "drive-file-2",
              slug: nf,
              title: "Berkas",
            })
            .pipe(Effect.flip);
        };
        const document = "application/vnd.google-apps.document";
        expect(
          yield* refused({ mimeType: document, name: "Catatan" }, "")
        ).toMatchObject({ _tag: "FileTypeRefused" });
        expect(
          yield* refused(
            {
              mimeType: "application/pdf",
              name: "Besar.pdf",
              size: String(LIBRARY_BYTE_LIMIT + 1),
            },
            "%PDF-"
          )
        ).toMatchObject({ _tag: "FileSizeRefused" });
        expect(driveReads()).toHaveLength(1);
        expect(
          yield* refused(
            { mimeType: "application/pdf", name: "Palsu.pdf", size: "6" },
            "<html>"
          )
        ).toMatchObject({ _tag: "FileTypeRefused" });
        expect(yield* fixture.run(libraryRows)).toHaveLength(0);
      })
  );

  it.effect(
    "refuses a Drive import to a teacher without Drive as a connector that is off, and to a student as an access denial",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const args = {
          classId,
          clientKey: "drive-outside",
          folderId: null,
          fileId: "drive-file-3",
          slug: nf,
          title: "Modul",
        };
        expect(
          yield* fixture
            .as("teacher")
            .action(library.importDrive, args)
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectorOff" });
        expect(
          yield* fixture
            .as("student")
            .action(library.importDrive, args)
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
        expect(fetcher).not.toHaveBeenCalled();
      })
  );
});
