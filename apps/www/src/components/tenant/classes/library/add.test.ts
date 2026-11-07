import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Exit, Option, Result, Schema } from "effect";
import {
  addLibraryLink,
  pickFromDrive,
  sendLibraryFile,
  uploadLibraryFile,
} from "@/components/tenant/classes/library/add";
import { pickDriveFile } from "@/components/tenant/classes/library/drive";
import type { LibraryItem } from "@/components/tenant/classes/library/optimistic";
import { putLibraryFile } from "@/components/tenant/classes/library/send";

vi.mock("@/components/tenant/classes/library/drive", () => ({
  pickDriveFile: vi.fn(),
}));

vi.mock("@/components/tenant/classes/library/send", () => ({
  putLibraryFile: vi.fn(),
}));

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const args = {
  address: "https://youtu.be/gerak-lurus",
  classId,
  clientKey: "0b5c9d1e-4f3a-4c2b-9a8d-7e6f5a4b3c2d",
  folderId: null,
  slug,
  title: "Video gerak lurus",
};

/** The link the server answers with, under the ID it gave. */
const stored: LibraryItem = {
  address: args.address,
  author: "Bu Rina",
  byteSize: null,
  clientKey: args.clientKey,
  createdAt: 1000,
  folderId: null,
  id: Schema.decodeUnknownSync(Id("classroomLibrary"))("item-1"),
  kind: "link",
  starred: false,
  title: args.title,
  trashedAt: null,
};

const uploadId = Schema.decodeUnknownSync(Id("classroomLibraryUploads"))(
  "upload-1"
);

/** What `classroom.library.reserve` answers with: the presigned address and the reservation. */
const reserve = () =>
  Promise.resolve(
    Result.succeed({ address: "https://r2.test/files/a", uploadId })
  );

describe("addLibraryLink", () => {
  it.effect(
    "adds with an update that shows the link at once under its client key, and answers the stored one",
    () =>
      Effect.gen(function* () {
        const add = vi.fn((_update: unknown, _args: unknown) =>
          Promise.resolve(Result.succeed(stored))
        );
        expect(yield* addLibraryLink(add, "Bu Rina", args)).toEqual(stored);
        const setQuery = vi.fn();
        const update = add.mock.calls[0]?.[0];
        if (typeof update === "function") {
          update(
            {
              getAllQueries: () => [
                {
                  args: {
                    classId,
                    folderId: null,
                    paginationOpts: { cursor: null },
                  },
                  value: Option.some({ isDone: true, page: [] }),
                },
              ],
              setQuery,
            },
            args
          );
        }
        expect(setQuery.mock.calls[0]?.[2]).toEqual(
          Option.some({
            isDone: true,
            page: [{ ...stored, createdAt: 0, id: args.clientKey }],
          })
        );
      })
  );

  it.effect("fails with the refusal the server answers", () =>
    Effect.gen(function* () {
      const add = () => Promise.resolve(Result.fail("refused"));
      const exit = yield* Effect.exit(addLibraryLink(add, "Bu Rina", args));
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});

describe("uploadLibraryFile", () => {
  it.effect(
    "reserves the file's bytes, sends it to the presigned address with its progress, registers it, and fails with the server's refusal",
    () =>
      Effect.gen(function* () {
        vi.mocked(putLibraryFile).mockImplementation(
          (_address, _file, progress) => Effect.sync(() => progress(1))
        );
        const file = new File(["%PDF-1.7"], "modul.pdf", {
          type: "application/pdf",
        });
        const register = vi.fn((_uploadId: unknown) =>
          Promise.resolve(Result.succeed({ id: stored.id }))
        );
        const progress = vi.fn();
        const kept = yield* uploadLibraryFile(
          file,
          reserve,
          register,
          progress
        );
        expect(kept).toEqual({ id: stored.id });
        expect(putLibraryFile).toHaveBeenCalledWith(
          "https://r2.test/files/a",
          file,
          progress
        );
        expect(progress).toHaveBeenCalledWith(1);
        expect(register).toHaveBeenCalledWith(uploadId);
        const refusal = yield* uploadLibraryFile(
          file,
          reserve,
          () => Promise.resolve(Result.fail({ _tag: "FileTypeRefused" })),
          progress
        ).pipe(Effect.flip);
        expect(refusal).toEqual({ _tag: "FileTypeRefused" });
      })
  );
});

describe("sendLibraryFile", () => {
  it.effect(
    "shows the row under a new client key, keeps it once the server kept the file, and takes it away on a refusal",
    () =>
      Effect.gen(function* () {
        const uploads = { end: vi.fn(), settle: vi.fn(), start: vi.fn() };
        const shown = {
          author: "Bu Rina",
          kind: "pdf" as const,
          title: "Modul",
        };
        const kept = yield* sendLibraryFile(uploads, shown, (clientKey) =>
          Effect.succeed(clientKey)
        );
        expect(uploads.start).toHaveBeenCalledWith(
          expect.objectContaining({
            ...shown,
            clientKey: kept,
            progress: 0,
            sent: false,
          })
        );
        expect(uploads.settle).toHaveBeenCalledWith(kept);
        const refused = yield* sendLibraryFile(uploads, shown, () =>
          Effect.fail("FileTypeRefused" as const)
        ).pipe(Effect.flip);
        expect(refused).toBe("FileTypeRefused");
        expect(uploads.end).toHaveBeenCalledTimes(1);
        expect(uploads.settle).toHaveBeenCalledTimes(1);
      })
  );
});

describe("pickFromDrive", () => {
  const keys = { accessToken: "access", apiKey: "key", appId: "972685787969" };

  it.effect(
    "tells an account without Drive before anything opens, and otherwise hands the Picker the way to hide the dialog",
    () =>
      Effect.gen(function* () {
        const hide = vi.fn();
        const missing = yield* pickFromDrive(
          () => Promise.resolve(Result.succeed(null)),
          "id",
          hide
        ).pipe(Effect.flip);
        expect(missing._tag).toBe("DriveMissing");
        expect(hide).not.toHaveBeenCalled();
        const picked = {
          id: "file-1",
          mimeType: "application/pdf",
          name: "Modul.pdf",
        };
        vi.mocked(pickDriveFile).mockReturnValueOnce(
          Effect.succeedSome(picked)
        );
        expect(
          yield* pickFromDrive(
            () => Promise.resolve(Result.succeed(keys)),
            "id",
            hide
          )
        ).toEqual(Option.some(picked));
        expect(pickDriveFile).toHaveBeenCalledWith(keys, "id", hide, undefined);
      })
  );
});
