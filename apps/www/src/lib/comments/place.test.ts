import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { readCommentAddress } from "@/lib/comments/place";

const query = vi.hoisted(() => vi.fn());

vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.map(HttpClient.HttpClient, (client) => ({ ...client, query }))
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});

describe("the address of a comment", () => {
  it.effect("opens the comment in the comments of the page that shows it", () =>
    Effect.gen(function* () {
      query.mockReturnValueOnce(
        Effect.succeed({
          appLocale: "id",
          publicPath: "materi/matematika/bilangan-kompleks/argumen",
        })
      );

      expect(yield* readCommentAddress("id", "comment-1")).toEqual(
        Option.some(
          "/id/materi/matematika/bilangan-kompleks/argumen?comment=comment-1#comments"
        )
      );
    })
  );

  it.effect("finds no address for a comment that no page shows", () =>
    Effect.gen(function* () {
      query.mockReturnValueOnce(Effect.succeed(null));

      expect(yield* readCommentAddress("id", "comment-1")).toEqual(
        Option.none()
      );
    })
  );
});
