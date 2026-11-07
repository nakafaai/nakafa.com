import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { putFile } from "@/lib/files/put";

const fetcher = vi.fn<typeof fetch>();

describe("putFile", () => {
  it.effect(
    "puts the file with its type at the presigned address, and fails when R2 refuses it",
    () =>
      Effect.gen(function* () {
        const file = new File(["%PDF-"], "a.pdf", { type: "application/pdf" });
        fetcher.mockResolvedValueOnce(new Response(null, { status: 200 }));
        yield* putFile("https://r2.test/files/a", file).pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );
        const [input, init] = fetcher.mock.calls[0] ?? [];
        expect(String(input)).toBe("https://r2.test/files/a");
        expect(init?.method).toBe("PUT");
        fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }));
        const refused = yield* putFile("https://r2.test/files/b", file).pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher),
          Effect.flip
        );
        expect(refused._tag).toBeDefined();
      })
  );
});
