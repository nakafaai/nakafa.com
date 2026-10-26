// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  answerSchoolShell,
  isSchoolPageRequest,
} from "@/lib/routing/school/shell.server";

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which holds the release's school shell. */
  env: { ASSETS: assets },
}));

/** A request to a school host, or to another host, as the platform passes it on. */
function request(address: string, method = "GET") {
  const url = new URL(address);
  return new Request(url, { headers: { host: url.host }, method });
}

describe("isSchoolPageRequest", () => {
  it("reads a page of a school host", () => {
    expect(isSchoolPageRequest(request("https://harapan.nakafa.com/"))).toBe(
      true
    );
    expect(
      isSchoolPageRequest(request("https://harapan.nakafa.com/exams", "HEAD"))
    ).toBe(true);
  });

  it("leaves a write, a shared route, a file and another host to their own answers", () => {
    expect(
      isSchoolPageRequest(request("https://harapan.nakafa.com/exams", "POST"))
    ).toBe(false);
    expect(
      isSchoolPageRequest(
        request("https://harapan.nakafa.com/api/auth/get-session")
      )
    ).toBe(false);
    expect(
      isSchoolPageRequest(request("https://harapan.nakafa.com/assets/old.js"))
    ).toBe(false);
    expect(isSchoolPageRequest(request("https://nakafa.com/en/exams"))).toBe(
      false
    );
  });
});

describe("answerSchoolShell", () => {
  it.effect(
    "answers the release's shell at the visitor's address, with its headers and the given status",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValueOnce(
          new Response("<html>shell</html>", {
            headers: { etag: '"shell"' },
          })
        );

        const response = yield* answerSchoolShell(
          request("https://harapan.nakafa.com/exams"),
          404
        );

        const [shell] = assets.fetch.mock.calls[0] ?? [];
        expect(shell?.url).toBe("https://harapan.nakafa.com/_school");
        expect(response.status).toBe(404);
        expect(response.headers.get("etag")).toBe('"shell"');
        expect(response.headers.get("content-type")).toBe(
          "text/html; charset=utf-8"
        );
        expect(yield* Effect.promise(() => response.text())).toBe(
          "<html>shell</html>"
        );
      })
  );

  it.effect("answers a HEAD request with no body", () =>
    Effect.gen(function* () {
      assets.fetch.mockResolvedValueOnce(new Response("<html>shell</html>"));

      const response = yield* answerSchoolShell(
        request("https://harapan.nakafa.com/", "HEAD"),
        200
      );

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    })
  );
});
