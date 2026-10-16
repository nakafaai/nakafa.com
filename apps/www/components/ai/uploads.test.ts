import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  NINA_DOCUMENT_SIZE,
  NinaUploadError,
} from "@repo/backend/client/nina/uploads";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  Effect,
  Logger,
  MutableHashMap,
  MutableList,
  Option,
  References,
  Result,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";
import {
  giveBackRefusedUploads,
  releaseUploads,
  type UploadStore,
  uploadAttachments,
} from "@/components/ai/uploads";

const first = Schema.decodeUnknownSync(Id("ninaUploads"))("upload_1");
const second = Schema.decodeUnknownSync(Id("ninaUploads"))("upload_2");

/** The call that gives back one upload, as the page makes it. */
type Release = Parameters<typeof releaseUploads>[1];
/** The call that forgets the uploads the server gave back, as the page makes it. */
type Forget = Parameters<typeof giveBackRefusedUploads>[2];
/** The call that stores one file on the server, as the page makes it. */
type Upload = Parameters<typeof uploadAttachments>[1];
/** The files of one send, as the composer holds them. */
type Attachment = Parameters<typeof uploadAttachments>[0][number];
/** The previews of one send, by the upload that holds each file. */
type Previews = Parameters<typeof uploadAttachments>[3];
/** The Convex connection a send reads, as the page passes it. */
type Connection = Parameters<typeof uploadAttachments>[4];

/** The answer of a release that worked. */
const released = () => Promise.resolve(Result.succeed(null));
/**
 * The answer of a release that the server refused with its reason. A confect
 * mutation that declares its errors resolves with the refusal instead of
 * rejecting, so a call that worked and a call that was refused both come back.
 */
const refused = (code: NinaUploadError["code"]) =>
  Promise.resolve(
    Result.fail(new NinaUploadError({ code, message: "Refused by the test." }))
  );

/**
 * Gives back some uploads, and returns the uploads the release names as given
 * back, with the warnings it logged, each with the annotations of its log.
 */
const releasing = Effect.fn("test.releasing")(function* (
  uploadIds: Parameters<typeof releaseUploads>[0],
  release: Release
) {
  const warnings = MutableList.make<{
    annotations: Readonly<Record<string, unknown>>;
    level: string;
  }>();
  const given = yield* releaseUploads(uploadIds, release).pipe(
    Effect.provide(
      Logger.layer([
        Logger.make(({ fiber, logLevel }) => {
          MutableList.append(warnings, {
            annotations: fiber.getRef(References.CurrentLogAnnotations),
            level: logLevel,
          });
        }),
      ])
    )
  );
  return { given, warnings: MutableList.toArray(warnings) };
});

describe("uploads the learner will not send", () => {
  it.effect(
    "gives back each upload once, names each as given back, and logs nothing",
    () =>
      Effect.gen(function* () {
        const release = vi.fn<Release>(released);

        const { given, warnings } = yield* releasing([first, second], release);

        expect(release).toHaveBeenCalledTimes(2);
        expect(release).toHaveBeenCalledWith({ uploadId: first });
        expect(release).toHaveBeenCalledWith({ uploadId: second });
        expect(given).toEqual([first, second]);
        expect(warnings).toEqual([]);
      })
  );

  it.effect(
    "asks for nothing and gives nothing back when no file held an upload",
    () =>
      Effect.gen(function* () {
        const release = vi.fn<Release>(released);

        const { given } = yield* releasing([], release);

        expect(release).not.toHaveBeenCalled();
        expect(given).toEqual([]);
      })
  );

  it.effect(
    "lets a call that is rejected go with a warning, so it neither blocks the learner nor stops the others, and does not name its upload as given back",
    () =>
      Effect.gen(function* () {
        const release = vi
          .fn<Release>(released)
          .mockRejectedValueOnce(new Error("offline"));

        const { given, warnings } = yield* releasing([first, second], release);

        expect(release).toHaveBeenCalledTimes(2);
        expect(release).toHaveBeenLastCalledWith({ uploadId: second });
        // The release that failed leaves one warning that names its upload,
        // and the one that worked leaves none.
        expect(given).toEqual([second]);
        expect(warnings).toEqual([
          { annotations: { uploadId: first }, level: "Warn" },
        ]);
      })
  );

  it.effect(
    "logs a refusal that leaves the upload held, does not name it as given back, and still gives back the others",
    () =>
      Effect.gen(function* () {
        const release = vi
          .fn<Release>(released)
          .mockImplementationOnce(() => refused("NINA_UPLOAD_FAILED"));

        const { given, warnings } = yield* releasing([first, second], release);

        expect(release).toHaveBeenCalledTimes(2);
        expect(release).toHaveBeenLastCalledWith({ uploadId: second });
        expect(given).toEqual([second]);
        expect(warnings).toEqual([
          { annotations: { uploadId: first }, level: "Warn" },
        ]);
      })
  );

  it.effect(
    "does not log a refusal that says the upload is gone, and names it as given back since nothing is held for it",
    () =>
      Effect.gen(function* () {
        const release = vi.fn<Release>(() => refused("NINA_UPLOAD_INVALID"));

        const { given, warnings } = yield* releasing([first, second], release);

        expect(release).toHaveBeenCalledTimes(2);
        expect(given).toEqual([first, second]);
        expect(warnings).toEqual([]);
      })
  );
});

describe("uploads the server refused", () => {
  it.effect(
    "gives back each refused place, and forgets each upload the server gave back",
    () =>
      Effect.gen(function* () {
        const release = vi.fn<Release>(released);
        const forget = vi.fn<Forget>();

        yield* giveBackRefusedUploads([first, second], release, forget);

        expect(release).toHaveBeenCalledWith({ uploadId: first });
        expect(release).toHaveBeenCalledWith({ uploadId: second });
        expect(forget).toHaveBeenCalledWith([first, second]);
      })
  );

  it.effect(
    "forgets only the uploads the server gave back, and fails the send for the others",
    () =>
      Effect.gen(function* () {
        const release = vi
          .fn<Release>(released)
          .mockImplementationOnce(() => refused("NINA_UPLOAD_FAILED"));
        const forget = vi.fn<Forget>();

        const failure = yield* giveBackRefusedUploads(
          [first, second],
          release,
          forget
        ).pipe(Effect.provide(Logger.layer([])), Effect.flip);

        expect(failure).toMatchObject({
          _tag: "NinaUploadError",
          code: "NINA_UPLOAD_FAILED",
        });
        expect(forget).toHaveBeenCalledWith([second]);
      })
  );

  it.effect("asks for nothing when no refused upload is left", () =>
    Effect.gen(function* () {
      const release = vi.fn<Release>(released);

      yield* giveBackRefusedUploads([], release, vi.fn<Forget>());

      expect(release).not.toHaveBeenCalled();
    })
  );
});

const uploadNamed = Schema.decodeUnknownSync(Id("ninaUploads"));
const madeUpload = uploadNamed("upload_3");
const heldUpload = uploadNamed("upload_4");
const refusedUpload = uploadNamed("upload_5");
const strayUpload = uploadNamed("upload_6");

/** The answer of an upload that the server stored under its id. */
const stored = (uploadId: typeof madeUpload) =>
  Promise.resolve(Result.succeed(uploadId));

/** A file of a send: its browser file, its id, and the address of its preview. */
function attachment(id: string, file: File): Attachment {
  return { file, id, mediaType: file.type, type: "file", url: `blob:${id}` };
}

/** The text file a learner chooses in these tests, and the preview a send shows for it. */
const notesPreview = Option.some({
  type: "file",
  url: "blob:notes",
  mediaType: "text/plain",
  filename: "notes.txt",
});

function notes() {
  return attachment(
    "notes",
    new File(["notes"], "notes.txt", { type: "text/plain" })
  );
}

/** A Convex connection whose socket is up, as the client reports it once connected. */
const connected: Connection = {
  connectionState: () => ({
    connectionCount: 1,
    connectionRetries: 0,
    hasEverConnected: true,
    hasInflightRequests: false,
    inflightActions: 0,
    inflightMutations: 0,
    isWebSocketConnected: true,
    timeOfOldestInflightRequest: null,
  }),
  subscribeToConnectionState: () => () => undefined,
};

/**
 * The calls of one send, each a mock a test can read. The status store holds
 * nothing and refuses nothing unless `answers` says so, and the upload stores
 * each file unless `uploadAnswer` says otherwise.
 */
function harness(
  answers: Partial<UploadStore> = {},
  uploadAnswer: Upload = () => stored(madeUpload)
) {
  const previews: Previews = MutableHashMap.empty();
  const release = vi.fn<Release>(released);
  const upload = vi.fn<Upload>(uploadAnswer);
  const status: UploadStore = {
    clearUpload: vi.fn<UploadStore["clearUpload"]>(),
    forgetUploads: vi.fn<UploadStore["forgetUploads"]>(),
    keepUpload: vi.fn<UploadStore["keepUpload"]>(),
    markUpload: vi.fn<UploadStore["markUpload"]>(),
    readRefusedUploads: vi.fn<UploadStore["readRefusedUploads"]>(() => []),
    readUploads: vi.fn<UploadStore["readUploads"]>(() => []),
    strayFiles: vi.fn<UploadStore["strayFiles"]>(() => []),
    uploadOf: vi.fn<UploadStore["uploadOf"]>(() => Option.none()),
    ...answers,
  };
  return {
    previews,
    release,
    status,
    upload,
    send: (files: readonly Attachment[]) =>
      uploadAttachments(files, upload, release, previews, connected, status),
  };
}

/** Sets what the browser reports about the network, which the page reads before it calls Convex. */
function reportNetwork(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

describe("the uploads of one send", () => {
  beforeEach(() => {
    reportNetwork(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect("refuses documents over the limit with NINA_UPLOAD_SIZE", () =>
    Effect.gen(function* () {
      const h = harness();
      const book = new File(
        [new Uint8Array(NINA_DOCUMENT_SIZE + 1)],
        "book.pdf",
        { type: "application/pdf" }
      );

      const failure = yield* Effect.flip(h.send([attachment("book", book)]));

      expect(failure).toMatchObject({
        _tag: "NinaUploadError",
        code: "NINA_UPLOAD_SIZE",
      });
      expect(h.upload).not.toHaveBeenCalled();
      expect(h.status.markUpload).not.toHaveBeenCalled();
    })
  );

  it.effect("gives refused uploads back before it uploads", () =>
    Effect.gen(function* () {
      const order = MutableList.make<string>();
      const h = harness({ readRefusedUploads: () => [refusedUpload] }, () => {
        MutableList.append(order, "upload");
        return stored(madeUpload);
      });
      h.release.mockImplementation(() => {
        MutableList.append(order, "release");
        return released();
      });

      const uploads = yield* h.send([notes()]);

      expect(MutableList.toArray(order)).toEqual(["release", "upload"]);
      expect(h.release).toHaveBeenCalledWith({ uploadId: refusedUpload });
      expect(h.status.forgetUploads).toHaveBeenCalledWith([refusedUpload]);
      expect(uploads).toEqual([madeUpload]);
    })
  );

  it.effect("releases the strays the store names, then forgets them", () =>
    Effect.gen(function* () {
      const h = harness({
        readUploads: vi.fn<UploadStore["readUploads"]>(() => [strayUpload]),
        strayFiles: vi.fn<UploadStore["strayFiles"]>(() => ["gone"]),
      });

      yield* h.send([notes()]);

      expect(h.status.strayFiles).toHaveBeenCalledWith(["notes"], 0);
      expect(h.status.readUploads).toHaveBeenCalledWith(["gone"]);
      expect(h.release).toHaveBeenCalledWith({ uploadId: strayUpload });
      expect(h.status.forgetUploads).toHaveBeenCalledWith([strayUpload]);
    })
  );

  it.effect(
    "uses the upload a file already holds, without uploading it again",
    () =>
      Effect.gen(function* () {
        const h = harness({ uploadOf: () => Option.some(heldUpload) });

        const uploads = yield* h.send([notes()]);

        expect(uploads).toEqual([heldUpload]);
        expect(h.upload).not.toHaveBeenCalled();
        expect(h.status.markUpload).not.toHaveBeenCalled();
        expect(MutableHashMap.get(h.previews, heldUpload)).toEqual(
          notesPreview
        );
      })
  );

  it.effect("refuses an unsupported file type with NINA_UPLOAD_INVALID", () =>
    Effect.gen(function* () {
      const h = harness();
      const page = new File(["<html>"], "page.html", { type: "text/html" });

      const failure = yield* Effect.flip(h.send([attachment("page", page)]));

      expect(failure).toMatchObject({
        _tag: "NinaUploadError",
        code: "NINA_UPLOAD_INVALID",
      });
      expect(h.upload).not.toHaveBeenCalled();
      expect(h.status.markUpload).not.toHaveBeenCalled();
    })
  );

  it.effect("refuses an unreadable file with NINA_UPLOAD_FAILED", () =>
    Effect.gen(function* () {
      const h = harness();
      const file = new File(["notes"], "notes.txt", { type: "text/plain" });
      vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error("unreadable"));

      const failure = yield* Effect.flip(h.send([attachment("notes", file)]));

      expect(failure).toMatchObject({
        _tag: "NinaUploadError",
        code: "NINA_UPLOAD_FAILED",
        message: "Unable to read this attachment.",
      });
      expect(h.upload).not.toHaveBeenCalled();
      expect(h.status.markUpload).not.toHaveBeenCalled();
    })
  );

  it.effect.each([
    {
      reason: "the server refuses the upload",
      answer: () => refused("NINA_UPLOAD_FAILED"),
      tag: "NinaUploadError",
      code: "NINA_UPLOAD_FAILED",
    },
    {
      reason: "the upload is not confirmed",
      answer: () => Promise.reject(new Error("socket closed")),
      tag: "NinaConnectionError",
      code: "NINA_CONNECTION_FAILED",
    },
  ])("marks the chip failed when $reason", ({ answer, tag, code }) =>
    Effect.gen(function* () {
      const h = harness({}, answer);

      const failure = yield* Effect.flip(h.send([notes()]));

      expect(failure).toMatchObject({ _tag: tag, code });
      expect(h.status.markUpload).toHaveBeenNthCalledWith(
        1,
        "notes",
        "uploading"
      );
      expect(h.status.markUpload).toHaveBeenLastCalledWith("notes", "error");
      expect(h.status.keepUpload).not.toHaveBeenCalled();
      expect(h.status.clearUpload).not.toHaveBeenCalled();
    })
  );

  it.effect("keeps a successful upload and previews its current address", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(1000);
      const h = harness();

      const uploads = yield* h.send([notes()]);

      expect(uploads).toEqual([madeUpload]);
      expect(h.status.markUpload).toHaveBeenCalledExactlyOnceWith(
        "notes",
        "uploading"
      );
      expect(h.status.keepUpload).toHaveBeenCalledExactlyOnceWith(
        "notes",
        madeUpload,
        1000
      );
      expect(h.status.clearUpload).toHaveBeenCalledExactlyOnceWith("notes");
      expect(MutableHashMap.get(h.previews, madeUpload)).toEqual(notesPreview);
    })
  );

  it.effect("refuses a send made offline with NINA_OFFLINE", () =>
    Effect.gen(function* () {
      reportNetwork(false);
      const h = harness();

      const failure = yield* Effect.flip(h.send([notes()]));

      expect(failure).toMatchObject({
        _tag: "NinaConnectionError",
        code: "NINA_OFFLINE",
      });
      expect(h.upload).not.toHaveBeenCalled();
      expect(h.status.markUpload).not.toHaveBeenCalled();
    })
  );
});
