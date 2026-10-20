// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { appendResponseHeader, getRequest } from "@tanstack/react-start/server";
import { Effect, Option } from "effect";
import { createRequestSession } from "@/lib/auth/session.server";
import { ClientSession } from "@/lib/auth/visitor";
import { readCurrentSession } from "@/lib/tenant/session";

vi.mock("@tanstack/react-start/server", () => ({
  appendResponseHeader: vi.fn(),
  getRequest: vi.fn(),
}));

vi.mock("@/lib/auth/session.server", () => ({
  createRequestSession: vi.fn(),
}));

const SESSION = {
  client: ClientSession.cases.SignedOut.make({}),
  convexToken: Option.none(),
  setCookies: ["better-auth.session_token=next; Path=/", "convex_jwt=next"],
};

describe("readCurrentSession", () => {
  it.effect("reads the session once per request and appends its cookies", () =>
    Effect.gen(function* () {
      const request = new Request("https://harapan.nakafa.com/");
      vi.mocked(getRequest).mockReturnValue(request);
      vi.mocked(createRequestSession).mockReturnValue(
        Effect.succeed(Effect.succeed(SESSION))
      );

      const first = yield* readCurrentSession();
      const second = yield* readCurrentSession();

      expect(first).toEqual(SESSION);
      expect(second).toEqual(SESSION);
      expect(createRequestSession).toHaveBeenCalledTimes(1);
      expect(appendResponseHeader).toHaveBeenCalledTimes(2);
      expect(appendResponseHeader).toHaveBeenCalledWith(
        "set-cookie",
        "convex_jwt=next"
      );
    })
  );

  it.effect(
    "gives another request its own read, so a session never crosses visitors",
    () =>
      Effect.gen(function* () {
        vi.mocked(createRequestSession).mockClear();
        vi.mocked(getRequest).mockReturnValue(
          new Request("https://harapan.nakafa.com/exams")
        );
        vi.mocked(createRequestSession).mockReturnValue(
          Effect.succeed(Effect.succeed({ ...SESSION, setCookies: [] }))
        );

        yield* readCurrentSession();

        expect(createRequestSession).toHaveBeenCalledTimes(1);
      })
  );
});
