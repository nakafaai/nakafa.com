import { describe, expect, it } from "@effect/vitest";
import { NinaUploadError } from "@repo/backend/client/nina/uploads";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  Effect,
  Logger,
  MutableList,
  References,
  Result,
  Schema,
} from "effect";
import { releaseUploads } from "@/components/ai/uploads";

const first = Schema.decodeUnknownSync(Id("ninaUploads"))("upload_1");
const second = Schema.decodeUnknownSync(Id("ninaUploads"))("upload_2");

/** The call that gives back one upload, as the page makes it. */
type Release = Parameters<typeof releaseUploads>[1];

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

/** Runs a program and returns the warnings it logged, each with the annotations of its log. */
const warningsOf = Effect.fn("test.warningsOf")(function* (
  program: Effect.Effect<void>
) {
  const warnings = MutableList.make<{
    annotations: Readonly<Record<string, unknown>>;
    level: string;
  }>();
  yield* program.pipe(
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
  return MutableList.toArray(warnings);
});

describe("uploads the learner will not send", () => {
  it.effect("gives back each upload once, and logs nothing", () =>
    Effect.gen(function* () {
      const release = vi.fn<Release>(released);

      const warnings = yield* warningsOf(
        releaseUploads([first, second], release)
      );

      expect(release).toHaveBeenCalledTimes(2);
      expect(release).toHaveBeenCalledWith({ uploadId: first });
      expect(release).toHaveBeenCalledWith({ uploadId: second });
      expect(warnings).toEqual([]);
    })
  );

  it.effect("asks for nothing when no file held an upload", () =>
    Effect.gen(function* () {
      const release = vi.fn<Release>(released);

      yield* releaseUploads([], release);

      expect(release).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "lets a call that is rejected go with a warning, so it neither blocks the learner nor stops the others",
    () =>
      Effect.gen(function* () {
        const release = vi
          .fn<Release>(released)
          .mockRejectedValueOnce(new Error("offline"));

        const warnings = yield* warningsOf(
          releaseUploads([first, second], release)
        );

        expect(release).toHaveBeenCalledTimes(2);
        expect(release).toHaveBeenLastCalledWith({ uploadId: second });
        // The release that failed leaves one warning that names its upload,
        // and the one that worked leaves none.
        expect(warnings).toEqual([
          { annotations: { uploadId: first }, level: "Warn" },
        ]);
      })
  );

  it.effect(
    "logs a refusal that leaves the upload held, and still gives back the others",
    () =>
      Effect.gen(function* () {
        const release = vi
          .fn<Release>(released)
          .mockImplementationOnce(() => refused("NINA_UPLOAD_FAILED"));

        const warnings = yield* warningsOf(
          releaseUploads([first, second], release)
        );

        expect(release).toHaveBeenCalledTimes(2);
        expect(release).toHaveBeenLastCalledWith({ uploadId: second });
        expect(warnings).toEqual([
          { annotations: { uploadId: first }, level: "Warn" },
        ]);
      })
  );

  it.effect(
    "does not log a refusal that says the upload is gone, since nothing is held for it",
    () =>
      Effect.gen(function* () {
        const release = vi.fn<Release>(() => refused("NINA_UPLOAD_INVALID"));

        const warnings = yield* warningsOf(
          releaseUploads([first, second], release)
        );

        expect(release).toHaveBeenCalledTimes(2);
        expect(warnings).toEqual([]);
      })
  );
});
