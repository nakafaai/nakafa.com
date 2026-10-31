import { afterEach, describe, expect, it } from "@effect/vitest";
import { standsOnPublicAddresses } from "@repo/backend/confect/integrations/receiver";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

/** The fetch that the resolver is reached through, for the whole file. */
const fetcher = vi.fn<typeof fetch>();

afterEach(() => {
  fetcher.mockReset();
});

/** Answers each record type of a name with its own records. */
const resolves = (answers: Record<string, readonly unknown[] | undefined>) =>
  fetcher.mockImplementation((input) => {
    const type = new URL(String(input)).searchParams.get("type") ?? "";
    return Promise.resolve(
      new Response(encodeJsonText({ Answer: answers[type], Status: 0 }), {
        headers: { "content-type": "application/dns-json" },
      })
    );
  });

const judge = (url: string) =>
  standsOnPublicAddresses(url).pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

describe("standsOnPublicAddresses", () => {
  it.effect("judges an address literal without asking the resolver", () =>
    Effect.gen(function* () {
      expect(yield* judge("https://93.184.216.34/hook")).toBe(true);
      expect(yield* judge("https://[fd00::1]/hook")).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("accepts a name that resolves to public addresses only", () =>
    Effect.gen(function* () {
      resolves({
        "1": [
          { data: "sekolah.example.net.", type: 5 },
          { data: "93.184.216.34", type: 1 },
        ],
        "28": [{ data: "2606:2800:220:1::1946", type: 28 }],
      });
      expect(yield* judge("https://sekolah.example/hook")).toBe(true);
    })
  );

  it.effect("refuses a name when any of its addresses is private", () =>
    Effect.gen(function* () {
      resolves({
        "1": [
          { data: "93.184.216.34", type: 1 },
          { data: "10.0.0.8", type: 1 },
        ],
      });
      expect(yield* judge("https://sekolah.example/hook")).toBe(false);
    })
  );

  it.effect("refuses a name that resolves to nothing", () =>
    Effect.gen(function* () {
      resolves({});
      expect(yield* judge("https://sekolah.example/hook")).toBe(false);
    })
  );
});
