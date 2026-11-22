// @vitest-environment node

import { NodeServices } from "@effect/platform-node";
import { assert, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { readLedger } from "@/scripts/urls/ledger";
import { checkLedger, recordLedger } from "@/scripts/urls/run";

const ORIGIN = "https://nakafa.com";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/** Answers each requested path with the status the table gives it, else 404. */
function serve(table: Record<string, Response>) {
  fetcher.mockImplementation((input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    return Promise.resolve(
      table[url.pathname]?.clone() ?? new Response(null, { status: 404 })
    );
  });
}

/** A temporary ledger file path for one test, in a folder not made yet. */
const ledgerIn = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return path.join(yield* fs.makeTempDirectoryScoped(), "urls", "ledger.txt");
});

/** A temporary ledger file that holds the given paths. */
const ledgerOf = Effect.fn(function* (text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ledger = path.join(yield* fs.makeTempDirectoryScoped(), "ledger.txt");
  yield* fs.writeFileString(ledger, text);
  return ledger;
});

describe("recordLedger", () => {
  it.effect(
    "keeps the committed seed, the last ledger and the live sitemap",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const ledger = yield* ledgerIn;
        serve({
          "/sitemap.xml": new Response(`<loc>${ORIGIN}/sitemap/base.xml</loc>`),
          "/sitemap/base.xml": new Response(
            `<loc>${ORIGIN}/en/brand-new-lesson</loc>`
          ),
        });

        yield* recordLedger({ ledger, origin: ORIGIN });
        const first = readLedger(yield* fs.readFileString(ledger));
        yield* fs.writeFileString(
          ledger,
          `${yield* fs.readFileString(ledger)}/en/once-published\n`
        );
        yield* recordLedger({ ledger, origin: ORIGIN });
        const second = readLedger(yield* fs.readFileString(ledger));

        expect(first).toContain("/en/brand-new-lesson");
        expect(first).toContain("/en/about");
        expect(second).toContain("/en/once-published");
        expect(second).toHaveLength(first.length + 1);
      }).pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetcher),
        Effect.scoped,
        Effect.provide(NodeServices.layer)
      )
  );
});

describe("checkLedger", () => {
  it.effect("passes when every address reaches a page or answers 410", () =>
    Effect.gen(function* () {
      const ledger = yield* ledgerOf("/about\n/en/about\n/id/events\n");
      serve({
        "/about": new Response(null, {
          headers: { location: "/en/about" },
          status: 308,
        }),
        "/en/about": new Response(null, { status: 200 }),
        "/id/events": new Response(null, { status: 410 }),
      });

      yield* checkLedger({ ledger, origin: ORIGIN });

      expect(fetcher).toHaveBeenCalledTimes(4);
    }).pipe(
      Effect.provideService(FetchHttpClient.Fetch, fetcher),
      Effect.scoped,
      Effect.provide(NodeServices.layer)
    )
  );

  // The file reads are real, so the retries of the unanswered address wait real time.
  it.live(
    "fails naming each broken address and the hops it took",
    () =>
      Effect.gen(function* () {
        const ledger = yield* ledgerOf("/legal-notice\n/en/down\n");
        fetcher.mockImplementation((input) => {
          const url = new URL(input instanceof Request ? input.url : input);
          if (url.pathname === "/en/down") {
            return Promise.reject(new TypeError("network"));
          }
          return Promise.resolve(
            url.pathname === "/legal-notice"
              ? new Response(null, {
                  headers: { location: "/id/legal-notice" },
                  status: 307,
                })
              : new Response(null, { status: 404 })
          );
        });

        const result = yield* Effect.result(
          checkLedger({ ledger, origin: ORIGIN })
        );

        assert(Result.isFailure(result));
        assert(result.failure._tag === "BrokenAddressError");
        expect(result.failure.report).toBe(
          "/legal-notice: 307 at /legal-notice, then 404 at /id/legal-notice\n/en/down: no answer at /en/down"
        );
      }).pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetcher),
        Effect.scoped,
        Effect.provide(NodeServices.layer)
      ),
    10_000
  );
});
