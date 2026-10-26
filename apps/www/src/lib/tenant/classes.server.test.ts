// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { isNotFound } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import {
  classDiscussionHandler,
  classForumHandler,
  shellClassesHandler,
} from "@/lib/tenant/classes.server";

/** A read that Convex could not answer: a real failure, which the screen fails with. */
class PreloadFailed extends Schema.TaggedError<PreloadFailed>()(
  "PreloadFailed",
  { cause: Schema.Unknown }
) {}

/** A refusal that the query declares for a viewer without access to the class. */
const refused = () =>
  new AccessDenied({ action: "class.view", reason: "resource" });

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

  it("ends the class as not found when the viewer is refused it", async () => {
    mocks.preloadConfectQuery.mockReturnValue(Effect.fail(refused()));

    await expect(
      classForumHandler({
        data: { classSlug: CLASS, numItems: 20, slug: SLUG },
      })
    ).rejects.toSatisfy(isNotFound);
    expect(mocks.preloadConfectQuery).toHaveBeenCalledTimes(1);
  });

  it("fails the forum when its channels read fails", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      ref === classroom.classes.resolve
        ? Effect.succeed({
            id: Schema.decodeUnknownSync(Id("classes"))("class-1"),
            name: "Fisika",
          })
        : Effect.fail(new PreloadFailed({ cause: "offline" }))
    );

    await expect(
      classForumHandler({
        data: { classSlug: CLASS, numItems: 20, slug: SLUG },
      })
    ).rejects.toMatchObject({ _tag: "PreloadFailed" });
  });
});

describe("discussion first screen", () => {
  it("reads the class, its channels, and the discussion of the class by its number", async () => {
    const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
    const answers = new Map<unknown, unknown>([
      [classroom.classes.resolve, { id: classId, name: "Fisika X-1" }],
      [classroom.forum.channels.list, { isDone: true, page: [] }],
      [classroom.forum.threads.get, { discussion: { number: 12 } }],
    ]);
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      Effect.succeed(answers.get(ref))
    );

    const screen = await classDiscussionHandler({
      data: { classSlug: CLASS, number: 12, numItems: 20, slug: SLUG },
    });

    expect(screen).toStrictEqual({
      channels: { isDone: true, page: [] },
      resolved: { id: classId, name: "Fisika X-1" },
      thread: { discussion: { number: 12 } },
    });
    expect(mocks.preloadConfectQuery).toHaveBeenLastCalledWith(
      classroom.forum.threads.get,
      { classId, number: 12, slug: SLUG },
      "token-class"
    );
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
