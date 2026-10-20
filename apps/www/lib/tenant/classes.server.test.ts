// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import {
  classForumHandler,
  classHandler,
  shellClassesHandler,
} from "@/lib/tenant/classes.server";

/** A read that the test backend fails with, so a first screen answers no value for it. */
class ReadFailed extends Schema.TaggedError<ReadFailed>()("ReadFailed", {
  cause: Schema.Unknown,
}) {}

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

const SLUG = Schema.decodeSync(TenantSlug)("harapan");
const CLASS = Schema.decodeSync(ClassAddress)("fisika-x-1");

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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readRequestToken.mockReturnValue(Effect.succeed("token-class"));
});

describe("class first screen", () => {
  it("reads the class with no channels for the class home", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.succeed({ id: "class-1", name: "Fisika X-1" })
    );

    const screen = await classHandler({
      data: { classSlug: CLASS, slug: SLUG },
    });

    expect(screen).toStrictEqual({
      channels: undefined,
      resolved: { id: "class-1", name: "Fisika X-1" },
    });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledExactlyOnceWith(
      classroom.classes.resolve,
      { classSlug: CLASS, slug: SLUG },
      "token-class"
    );
  });

  it("reads the class and then the first page of its channels, which belong to the class", async () => {
    const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      Effect.succeed(
        ref === classroom.classes.resolve
          ? { id: classId, name: "Fisika X-1" }
          : { isDone: true, page: [{ id: "channel-1" }] }
      )
    );

    const screen = await classForumHandler({
      data: { classSlug: CLASS, numItems: 20, slug: SLUG },
    });

    expect(screen).toStrictEqual({
      channels: { isDone: true, page: [{ id: "channel-1" }] },
      resolved: { id: classId, name: "Fisika X-1" },
    });
    expect(mocks.preloadConfectQuery).toHaveBeenLastCalledWith(
      classroom.forum.channels.list,
      { classId, paginationOpts: { cursor: null, numItems: 20 }, slug: SLUG },
      "token-class"
    );
  });

  it("reads no channels when the class itself is not readable", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.fail(new ReadFailed({ cause: "denied" }))
    );

    const screen = await classForumHandler({
      data: { classSlug: CLASS, numItems: 20, slug: SLUG },
    });

    expect(screen).toStrictEqual({ channels: undefined, resolved: undefined });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledTimes(1);
  });

  it("answers no channels when the channels read fails and keeps the class", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      ref === classroom.classes.resolve
        ? Effect.succeed({
            id: Schema.decodeUnknownSync(Id("classes"))("class-1"),
            name: "Fisika",
          })
        : Effect.fail(new ReadFailed({ cause: "offline" }))
    );

    const screen = await classForumHandler({
      data: { classSlug: CLASS, numItems: 20, slug: SLUG },
    });

    expect(screen.channels).toBeUndefined();
    expect(screen.resolved?.name).toBe("Fisika");
  });
});

describe("sidebar classes", () => {
  it("reads the viewer's classes in the school's active periods", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.succeed([{ id: "class-1" }])
    );

    const classes = await shellClassesHandler({ data: { slug: SLUG } });

    expect(classes).toStrictEqual([{ id: "class-1" }]);
    expect(mocks.preloadConfectQuery).toHaveBeenCalledExactlyOnceWith(
      classroom.classes.mine,
      { slug: SLUG },
      "token-class"
    );
  });
});
