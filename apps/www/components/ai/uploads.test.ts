import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Effect, Logger, MutableList, References, Schema } from "effect";
import { releaseUploads } from "@/components/ai/uploads";

const first = Schema.decodeUnknownSync(Id("ninaUploads"))("upload_1");
const second = Schema.decodeUnknownSync(Id("ninaUploads"))("upload_2");

describe("uploads the learner will not send", () => {
  it.effect("gives back each upload once", () =>
    Effect.gen(function* () {
      const release = vi.fn(() => Promise.resolve(null));

      yield* releaseUploads([first, second], release);

      expect(release).toHaveBeenCalledTimes(2);
      expect(release).toHaveBeenCalledWith({ uploadId: first });
      expect(release).toHaveBeenCalledWith({ uploadId: second });
    })
  );

  it.effect("asks for nothing when no file held an upload", () =>
    Effect.gen(function* () {
      const release = vi.fn(() => Promise.resolve(null));

      yield* releaseUploads([], release);

      expect(release).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "lets a failed release go with a warning, so it neither blocks the learner nor stops the others",
    () =>
      Effect.gen(function* () {
        const release = vi
          .fn<(args: { uploadId: typeof first }) => Promise<unknown>>()
          .mockRejectedValueOnce(new Error("offline"))
          .mockResolvedValue(null);
        const warnings = MutableList.make<{
          annotations: Readonly<Record<string, unknown>>;
          level: string;
        }>();

        yield* releaseUploads([first, second], release).pipe(
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

        expect(release).toHaveBeenCalledTimes(2);
        expect(release).toHaveBeenLastCalledWith({ uploadId: second });
        // The release that failed leaves one warning that names its upload,
        // and the one that worked leaves none.
        expect(MutableList.toArray(warnings)).toEqual([
          { annotations: { uploadId: first }, level: "Warn" },
        ]);
      })
  );
});
