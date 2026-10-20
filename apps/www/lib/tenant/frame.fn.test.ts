// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  getRequest,
  getRequestHeaders,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { Effect, Option, Schema } from "effect";
import { readSessionMemo } from "@/lib/auth/session.server";
import { ClientSession } from "@/lib/auth/visitor";
import { frameHandler } from "@/lib/tenant/frame.fn";
import { readSchoolFrame } from "@/lib/tenant/read";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: vi.fn(),
  getRequestHeaders: vi.fn(),
  setResponseHeader: vi.fn(),
}));

vi.mock("@/lib/auth/session.server", () => ({
  readSessionMemo: vi.fn(),
}));

vi.mock("@/lib/tenant/read", async () => {
  const { Layer } = await import("effect");
  return { readSchoolFrame: vi.fn(), SchoolReadsLive: Layer.empty };
});

const SLUG = Schema.decodeSync(TenantSlug)("harapan");

describe("school frame server function", () => {
  it("answers with no cache, the visitor's locale, and the session's token", async () => {
    vi.mocked(getRequest).mockReturnValue(
      new Request("https://harapan.nakafa.com/")
    );
    vi.mocked(getRequestHeaders).mockReturnValue(
      new Headers({ "accept-language": "id-ID,en;q=0.5" })
    );
    vi.mocked(readSessionMemo).mockReturnValue(
      Effect.succeed(
        Effect.succeed({
          client: ClientSession.cases.SignedOut.make({}),
          convexToken: Option.some("token"),
          setCookies: [],
        })
      )
    );
    vi.mocked(readSchoolFrame).mockReturnValue(
      Effect.succeed({ _tag: "Refused" })
    );

    const answer = await frameHandler({ data: { slug: SLUG } });

    expect(answer).toEqual({ _tag: "Refused" });
    expect(setResponseHeader).toHaveBeenCalledWith(
      "cache-control",
      "private, no-store"
    );
    expect(readSchoolFrame).toHaveBeenCalledWith({
      locale: "id",
      slug: SLUG,
      token: Option.some("token"),
    });
  });
});
