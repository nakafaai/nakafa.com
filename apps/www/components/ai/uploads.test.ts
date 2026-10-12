import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Effect, Schema } from "effect";
import {
  dropUploads,
  keepUpload,
  releaseUpload,
  uploadOf,
} from "@/components/ai/uploads";

const uploadId = Schema.decodeUnknownSync(Id("ninaUploads"))("upload_1");
const choose = (name: string) => new File(["a"], name);

describe("uploads that hold chosen files", () => {
  it("remembers the upload of a file until it is dropped", () => {
    const photo = choose("photo.png");
    expect(uploadOf(photo)).toBeUndefined();

    keepUpload(photo, uploadId);
    expect(uploadOf(photo)).toBe(uploadId);

    dropUploads([photo]);
    expect(uploadOf(photo)).toBeUndefined();
  });

  it.effect("releases the upload of a removed file once", () =>
    Effect.gen(function* () {
      const release = vi.fn(() => Promise.resolve(null));
      const photo = choose("photo.png");
      keepUpload(photo, uploadId);

      yield* releaseUpload(photo, release);
      yield* releaseUpload(photo, release);

      expect(release).toHaveBeenCalledExactlyOnceWith({ uploadId });
      expect(uploadOf(photo)).toBeUndefined();
    })
  );

  it.effect("asks for nothing when the removed file never uploaded", () =>
    Effect.gen(function* () {
      const release = vi.fn(() => Promise.resolve(null));

      yield* releaseUpload(choose("notes.txt"), release);

      expect(release).not.toHaveBeenCalled();
    })
  );

  it.effect("lets a failed release go, so it never blocks the learner", () =>
    Effect.gen(function* () {
      const release = vi.fn(() => Promise.reject(new Error("offline")));
      const photo = choose("photo.png");
      keepUpload(photo, uploadId);

      yield* releaseUpload(photo, release);

      expect(release).toHaveBeenCalledOnce();
      expect(uploadOf(photo)).toBeUndefined();
    })
  );
});
