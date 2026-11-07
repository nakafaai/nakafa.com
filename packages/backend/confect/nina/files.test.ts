import { describe, expect, it } from "@effect/vitest";
import { objectAddress } from "@repo/backend/confect/bucket/sign";
import { freshRow } from "@repo/backend/confect/nina/files";
import {
  answer,
  learnerTurn,
  MESSAGE_IDENTITY,
  storedRow,
} from "@repo/backend/test/nina/message";
import { ConfigProvider, Effect } from "effect";

/** A presigned address of another bucket, which stays as it is. */
const FOREIGN = "https://elsewhere.test/x?X-Amz-Signature=abc";

/** The bucket as a deployment configures it. */
const configured = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    R2_ACCESS_KEY_ID: "key",
    R2_BUCKET: "files",
    R2_ENDPOINT: "https://account.r2.test",
    R2_SECRET_ACCESS_KEY: "secret",
  })
);

describe("nina/files", () => {
  it.effect(
    "signs a learner's bucket file again, and leaves bytes, other addresses, provider references and answers as they are",
    () =>
      Effect.gen(function* () {
        const stale = yield* objectAddress("files/accounts/sent", {
          expiresSeconds: 1,
          method: "GET",
          signedAt: 0,
        });
        const learnerParts =
          typeof learnerTurn.message?.content === "string"
            ? []
            : (learnerTurn.message?.content ?? []);
        const turn = storedRow(
          {
            ...learnerTurn,
            message: {
              content: [
                { image: stale, mediaType: "image/png", type: "image" },
                {
                  data: stale,
                  filename: "soal.pdf",
                  mediaType: "application/pdf",
                  type: "file",
                },
                {
                  data: FOREIGN,
                  mediaType: "application/pdf",
                  type: "file",
                },
                ...learnerParts,
              ],
              role: "user",
            },
          },
          MESSAGE_IDENTITY
        );
        const fresh = yield* freshRow(turn);
        const content = fresh.message?.content;
        if (typeof content === "string" || content === undefined) {
          return yield* Effect.die("The learner's turn has parts.");
        }
        const [image, file, foreign, ...rest] = content;
        expect(image).toMatchObject({ type: "image" });
        expect(image?.type === "image" && image.image).not.toBe(stale);
        expect(image?.type === "image" && String(image.image)).toContain(
          "/files/files/accounts/sent?"
        );
        expect(file?.type === "file" && file.data).not.toBe(stale);
        expect(foreign?.type === "file" && foreign.data).toBe(FOREIGN);
        expect(rest).toEqual(learnerParts);
        const replied = storedRow(answer, MESSAGE_IDENTITY);
        expect(yield* freshRow(replied)).toBe(replied);
        const plain = storedRow(
          { message: { content: "Halo", role: "user" } },
          MESSAGE_IDENTITY
        );
        expect(yield* freshRow(plain)).toBe(plain);
      }).pipe(Effect.provide(configured))
  );
});
