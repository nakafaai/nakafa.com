// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { answerFailedDocument } from "@/lib/routing/failed.server";

const assets = vi.hoisted(() => ({ fetch: vi.fn<typeof fetch>() }));
const worker = vi.hoisted(() => ({ env: { ASSETS: assets } }));

vi.mock("cloudflare:workers", () => worker);

vi.mock("@/env.public", () => ({
  clientEnv: { VITE_CONVEX_URL: "https://convex.example" },
}));

const SHELL = "<!doctype html><title>Nakafa</title>";

/** A navigation of a browser tab to a page. */
const navigation = new Request("https://nakafa.com/en/home", {
  headers: { "sec-fetch-dest": "document" },
});

/** Start's own answer to an error that escaped the router. */
const startError = () =>
  new Response('{"status":500}', {
    headers: { "content-type": "application/json" },
    status: 500,
  });

beforeEach(() => {
  worker.env.ASSETS = assets;
  assets.fetch.mockReset();
  assets.fetch.mockImplementation(() =>
    Promise.resolve(new Response(SHELL, { headers: { etag: "shell" } }))
  );
});

describe("answerFailedDocument", () => {
  it.effect("answers a page that failed with the browser shell", () =>
    Effect.gen(function* () {
      const response = yield* answerFailedDocument(navigation, startError());

      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(yield* Effect.promise(() => response.text())).toBe(SHELL);
    })
  );

  it.effect("keeps a page that rendered", () =>
    Effect.gen(function* () {
      const page = new Response("page");

      expect(yield* answerFailedDocument(navigation, page)).toBe(page);
    })
  );

  it.effect("keeps the router's own error page, which is HTML", () =>
    Effect.gen(function* () {
      const page = new Response("error page", {
        headers: { "content-type": "text/html" },
        status: 500,
      });

      expect(yield* answerFailedDocument(navigation, page)).toBe(page);
    })
  );

  it.effect("keeps Start's answer for a call that no tab navigates to", () =>
    Effect.gen(function* () {
      const call = new Request("https://nakafa.com/_serverFn/read");
      const failure = startError();

      expect(yield* answerFailedDocument(call, failure)).toBe(failure);
    })
  );

  it.effect("keeps Start's answer where no release binds a shell", () =>
    Effect.gen(function* () {
      Reflect.deleteProperty(worker.env, "ASSETS");
      const failure = startError();

      expect(yield* answerFailedDocument(navigation, failure)).toBe(failure);
    })
  );
});
