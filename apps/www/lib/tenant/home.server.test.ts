// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import exams from "@repo/backend/confect/_generated/refs/exams";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { staffHomeHandler, studentHomeHandler } from "@/lib/tenant/home.server";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

const SLUG = Schema.decodeSync(TenantSlug)("harapan");

const mocks = vi.hoisted(() => ({
  preloadConfectQuery:
    vi.fn<
      (
        ref: unknown,
        args: unknown,
        token: unknown
      ) => Effect.Effect<unknown, unknown>
    >(),
  readRequestToken: vi.fn<() => Effect.Effect<string | undefined, never>>(),
  setResponseHeader: vi.fn<(name: string, value: string) => void>(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://harapan.nakafa.com/"),
  setResponseHeader: mocks.setResponseHeader,
}));

vi.mock("@/lib/auth/session.server", () => ({
  readRequestToken: mocks.readRequestToken,
}));

vi.mock("@/lib/data/preload.server", () => ({
  preloadConfectQuery: mocks.preloadConfectQuery,
}));

/** Answers each preloaded read with the value that the test gives its ref. */
function answer(values: ReadonlyArray<readonly [unknown, unknown]>) {
  mocks.preloadConfectQuery.mockImplementation((ref) =>
    Effect.succeed(
      Option.getOrUndefined(Arr.findFirst(values, ([key]) => key === ref))?.[1]
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readRequestToken.mockReturnValue(Effect.succeed("token-home"));
});

describe("staff home first screen", () => {
  it("reads the home's exams and rooms, and no setup, for a viewer who does not manage the school", async () => {
    answer([
      [exams.exams.home, { closed: [], drafts: [], live: [], next: [] }],
    ]);

    const screen = await staffHomeHandler({
      data: { canManage: false, slug: SLUG },
    });

    expect(screen).toStrictEqual({
      home: { closed: [], drafts: [], live: [], next: [] },
      setup: undefined,
    });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledExactlyOnceWith(
      exams.exams.home,
      { slug: SLUG },
      "token-home"
    );
  });

  it("also reads the school's setup for a viewer who manages the school", async () => {
    answer([
      [exams.exams.home, { closed: [], drafts: [], live: [], next: [] }],
      [tenancy.home.setup, { steps: [] }],
    ]);

    const screen = await staffHomeHandler({
      data: { canManage: true, slug: SLUG },
    });

    expect(screen.setup).toStrictEqual({ steps: [] });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledWith(
      tenancy.home.setup,
      { slug: SLUG },
      "token-home"
    );
  });
});

describe("student home first screen", () => {
  it("reads the sittings the student may take part in", async () => {
    answer([[exams.sittings.mine, [{ id: "sitting-1" }]]]);

    const sittings = await studentHomeHandler({ data: { slug: SLUG } });

    expect(sittings).toStrictEqual([{ id: "sitting-1" }]);
    expect(mocks.preloadConfectQuery).toHaveBeenCalledExactlyOnceWith(
      exams.sittings.mine,
      { slug: SLUG },
      "token-home"
    );
  });
});
