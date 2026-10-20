// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import {
  examListHandler,
  examOpenHandler,
  examRoomsHandler,
  resultsHandler,
  sittingDashboardHandler,
  studentSittingHandler,
} from "@/lib/tenant/exams.server";

/** A read that the test backend fails with, so a first screen answers no value for it. */
class ReadFailed extends Schema.TaggedError<ReadFailed>()("ReadFailed", {
  cause: Schema.Unknown,
}) {}

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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readRequestToken.mockReturnValue(Effect.succeed("token-exam"));
  mocks.preloadConfectQuery.mockImplementation(() => Effect.void);
});

describe("exam list first screen", () => {
  it("reads the first page of the exams and answers its page and end", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.succeed({
        isDone: false,
        page: [{ id: "exam-1" }],
        continueCursor: "c",
      })
    );

    const page = await examListHandler({
      data: { numItems: 20, slug: SLUG },
    });

    expect(page).toStrictEqual({ isDone: false, page: [{ id: "exam-1" }] });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledExactlyOnceWith(
      exams.exams.list,
      { paginationOpts: { cursor: null, numItems: 20 }, slug: SLUG },
      "token-exam"
    );
  });
});

describe("first screens of a failed read", () => {
  it("answers no page for a failed exam list, so the live query decides", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.fail(new ReadFailed({ cause: "offline" }))
    );

    await expect(
      examListHandler({ data: { numItems: 20, slug: SLUG } })
    ).resolves.toBeUndefined();
  });

  it("answers no rooms for a failed rooms read and keeps the summary", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      ref === exams.rooms.exam
        ? Effect.succeed({ title: "Ujian" })
        : Effect.fail(new ReadFailed({ cause: "offline" }))
    );

    await expect(
      examRoomsHandler({
        data: { examId: examIdOf("exam-1"), numItems: 20, slug: SLUG },
      })
    ).resolves.toStrictEqual({ rooms: undefined, summary: { title: "Ujian" } });
  });

  it("answers no students for a failed student page and keeps the overview", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      ref === exams.results.results.overview
        ? Effect.succeed({ questions: [] })
        : Effect.fail(new ReadFailed({ cause: "offline" }))
    );

    await expect(
      resultsHandler({
        data: { numItems: 50, sittingId: sittingIdOf("sitting-1"), slug: SLUG },
      })
    ).resolves.toStrictEqual({
      overview: { questions: [] },
      students: undefined,
    });
  });
});

describe("exam rooms first screen", () => {
  it("reads the summary and the first page of rooms", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      Effect.succeed(
        ref === exams.rooms.exam
          ? { title: "Ujian" }
          : { isDone: true, page: [] }
      )
    );

    const screen = await examRoomsHandler({
      data: { examId: examIdOf("exam-1"), numItems: 20, slug: SLUG },
    });

    expect(screen).toStrictEqual({
      rooms: { isDone: true, page: [] },
      summary: { title: "Ujian" },
    });
  });
});

describe("exam and sitting first screens", () => {
  it("reads one exam as its editor and its try open it", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.succeed({ title: "Ujian" })
    );

    const exam = await examOpenHandler({
      data: { examId: examIdOf("exam-1"), slug: SLUG },
    });

    expect(exam).toStrictEqual({ title: "Ujian" });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledWith(
      exams.exams.open,
      { examId: examIdOf("exam-1"), slug: SLUG },
      "token-exam"
    );
  });

  it("reads the proctor's dashboard of one sitting from its first page of seats", async () => {
    await sittingDashboardHandler({
      data: { sittingId: sittingIdOf("sitting-1"), slug: SLUG },
    });

    expect(mocks.preloadConfectQuery).toHaveBeenCalledWith(
      exams.sittings.dashboard,
      expect.objectContaining({
        sittingId: sittingIdOf("sitting-1"),
        slug: SLUG,
      }),
      "token-exam"
    );
  });

  it("reads the student's screen of one sitting", async () => {
    await studentSittingHandler({
      data: { sittingId: sittingIdOf("sitting-1"), slug: SLUG },
    });

    expect(mocks.preloadConfectQuery).toHaveBeenCalledWith(
      exams.sittings.student,
      { sittingId: sittingIdOf("sitting-1"), slug: SLUG },
      "token-exam"
    );
  });
});

describe("sitting results first screen", () => {
  it("reads the overview and the first page of students", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      Effect.succeed(
        ref === exams.results.results.overview
          ? { questions: [] }
          : { isDone: false, page: [] }
      )
    );

    const screen = await resultsHandler({
      data: { numItems: 50, sittingId: sittingIdOf("sitting-1"), slug: SLUG },
    });

    expect(screen).toStrictEqual({
      overview: { questions: [] },
      students: { isDone: false, page: [] },
    });
  });
});

/** The exam id that the handlers receive, decoded the way the route decodes it. */
function examIdOf(value: string) {
  return Schema.decodeUnknownSync(Id("exams"))(value);
}

/** The sitting id that the handlers receive, decoded the way the route decodes it. */
function sittingIdOf(value: string) {
  return Schema.decodeUnknownSync(Id("examSittings"))(value);
}
