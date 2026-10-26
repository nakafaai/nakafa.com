// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { isNotFound } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import {
  examEditorHandler,
  examListHandler,
  examOpenHandler,
  examRoomsHandler,
  resultsHandler,
  sittingDashboardHandler,
  studentSittingHandler,
} from "@/lib/tenant/exams.server";

/** A read that Convex could not answer: a real failure, which the screen fails with. */
class PreloadFailed extends Schema.TaggedError<PreloadFailed>()(
  "PreloadFailed",
  { cause: Schema.Unknown }
) {}

/** A refusal that the query declares for a viewer without the grant. */
const refused = () =>
  new AccessDenied({ action: "exam.view", reason: "resource" });

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
  getCookie: () => undefined,
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

describe("first screens of a read the viewer is refused or that fails", () => {
  it("ends the exam list as not found when the viewer is refused it", async () => {
    mocks.preloadConfectQuery.mockReturnValue(Effect.fail(refused()));

    await expect(
      examListHandler({ data: { numItems: 20, slug: SLUG } })
    ).rejects.toSatisfy(isNotFound);
  });

  it("fails the exam list when its read fails", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.fail(new PreloadFailed({ cause: "offline" }))
    );

    await expect(
      examListHandler({ data: { numItems: 20, slug: SLUG } })
    ).rejects.toMatchObject({ _tag: "PreloadFailed" });
  });

  it("ends the exam page as not found when its rooms are refused", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      ref === exams.rooms.exam
        ? Effect.succeed({ title: "Ujian" })
        : Effect.fail(refused())
    );

    await expect(
      examRoomsHandler({
        data: { examId: examIdOf("exam-1"), numItems: 20, slug: SLUG },
      })
    ).rejects.toSatisfy(isNotFound);
  });

  it("ends the results page as not found when its students are refused", async () => {
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      ref === exams.results.results.overview
        ? Effect.succeed({ questions: [] })
        : Effect.fail(refused())
    );

    await expect(
      resultsHandler({
        data: { numItems: 50, sittingId: sittingIdOf("sitting-1"), slug: SLUG },
      })
    ).rejects.toSatisfy(isNotFound);
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

  it("reads one exam as its editor opens it, with the prompt of its first question", async () => {
    const prompt = Schema.decodeUnknownSync(Id("editorDocuments"))("prompt-1");
    const exam = { questions: [{ prompt }, { prompt: "prompt-2" }] };
    const opened = { client: null, snapshot: { content: "{}", version: 0 } };
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      Effect.succeed(ref === exams.exams.open ? exam : opened)
    );

    const read = await examEditorHandler({
      data: { examId: examIdOf("exam-1"), slug: SLUG },
    });

    expect(read).toStrictEqual({
      exam,
      prompt: { documentId: prompt, opened },
    });
    expect(mocks.preloadConfectQuery).toHaveBeenCalledWith(
      editors.documents.open,
      { clientId: "preview", documentId: prompt, slug: SLUG },
      "token-exam"
    );
  });

  it("fails the editor's read as a defect for an exam that holds no question", async () => {
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.succeed({ questions: [] })
    );

    await expect(
      examEditorHandler({ data: { examId: examIdOf("exam-1"), slug: SLUG } })
    ).rejects.toThrow();
    expect(mocks.preloadConfectQuery).toHaveBeenCalledTimes(1);
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

  it("reads the student's screen of one sitting, with the view the server resolves", async () => {
    const reply = await studentSittingHandler({
      data: {
        sittingId: sittingIdOf("sitting-1"),
        slug: SLUG,
        view: { kind: "absent" },
      },
    });

    expect(reply).toMatchObject({ mode: "list" });

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
