// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { runServerEffect, serverHandler } from "@/lib/server/fn";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/"),
}));

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

class Missing extends Schema.TaggedError<Missing>()("Missing", {
  id: Schema.String,
}) {}

describe("server effect boundary", () => {
  it("returns the value of a successful effect", async () => {
    await expect(runServerEffect(Effect.succeed("ok"))).resolves.toBe("ok");
  });

  it("throws a typed failure as it is when no mapping is given", async () => {
    const failure = new Missing({ id: "1" });
    await expect(runServerEffect(Effect.fail(failure))).rejects.toBe(failure);
  });

  it("throws a typed failure as the mapping makes it", async () => {
    await expect(
      runServerEffect(Effect.fail(new Missing({ id: "1" })), {
        mapFailure: (error) => `mapped ${error.id}`,
      })
    ).rejects.toBe("mapped 1");
  });

  it("throws a defect as it was raised, without the mapping", async () => {
    const defect = { status: 404 };
    await expect(
      runServerEffect(Effect.die(defect), {
        mapFailure: () => "mapped",
      })
    ).rejects.toBe(defect);
  });

  it("stops the effect when the request signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runServerEffect(Effect.never, { signal: controller.signal })
    ).rejects.toBeDefined();
  });
});

describe("server handler", () => {
  it("runs the effect on the validated data with the request signal", async () => {
    const handler = serverHandler((data: { readonly slug: string }) =>
      Effect.succeed(data.slug.toUpperCase())
    );
    await expect(handler({ data: { slug: "harapan" } })).resolves.toBe(
      "HARAPAN"
    );
  });

  it("throws the handler's typed failure through its mapping", async () => {
    const handler = serverHandler(() => Effect.fail(new Missing({ id: "2" })), {
      mapFailure: (error: Missing) => `missing ${error.id}`,
    });
    await expect(handler({ data: undefined })).rejects.toBe("missing 2");
  });
});
