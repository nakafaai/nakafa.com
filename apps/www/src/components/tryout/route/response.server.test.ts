// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { keepPersonalResponse } from "@/components/tryout/route/response.server";

const headers = vi.hoisted(() => ({ setResponseHeader: vi.fn() }));

vi.mock("@tanstack/react-start/server", () => ({
  setResponseHeader: headers.setResponseHeader,
}));

describe("keepPersonalResponse", () => {
  it.effect("answers a learner's own document with no cache", () =>
    Effect.gen(function* () {
      yield* keepPersonalResponse;

      expect(headers.setResponseHeader).toHaveBeenCalledExactlyOnceWith(
        "cache-control",
        "private, no-store"
      );
    })
  );
});
