// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import type { NotFoundPage } from "@/lib/routing/not-found";
import { answerRouted, type RouterHandler } from "@/lib/routing/routed.server";

const reporting = vi.hoisted(() => ({
  report: vi.fn(() => Effect.void),
}));

vi.mock("@repo/analytics/server-reporting", () => ({
  reportUncaughtRequestError: reporting.report,
}));

vi.mock("@tanstack/react-start/server", () => ({
  handleStartError: () => new Response("Start error", { status: 500 }),
}));

const request = new Request("https://harapan.nakafa.com/settings");

describe("answerRouted", () => {
  it.effect(
    "gives the router the request and the not-found page that answers it",
    () =>
      Effect.gen(function* () {
        const page: Option.Option<NotFoundPage> = Option.some({
          locale: "id",
          school: true,
        });
        const handle = vi.fn<RouterHandler>(() =>
          Promise.resolve(new Response("page"))
        );

        const response = yield* answerRouted(request, handle, page);

        expect(yield* Effect.promise(() => response.text())).toBe("page");
        expect(handle).toHaveBeenCalledWith(request, page);
      })
  );

  it.effect("reports a router failure with Start's error response", () =>
    Effect.gen(function* () {
      const handle = vi.fn<RouterHandler>(() =>
        Promise.reject(new Error("router failed"))
      );

      const response = yield* answerRouted(request, handle);

      expect(response.status).toBe(500);
      expect(yield* Effect.promise(() => response.text())).toBe("Start error");
      expect(handle).toHaveBeenCalledWith(request, Option.none());
      expect(reporting.report).toHaveBeenCalledWith(expect.any(Error), request);
    })
  );
});
