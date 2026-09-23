// @vitest-environment node
import { beforeEach, expect, it } from "@effect/vitest";
import { openNinaLearningSession } from "@repo/ai/nina/memory/pack";
import { Effect } from "effect";
import { ChatAdmissionError, ChatMutationError } from "@/app/api/chat/errors";
import { POST } from "@/app/api/chat/route";

const mocks = vi.hoisted(() => ({
  allow: vi.fn(),
  token: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
  verified: vi.fn(),
  user: vi.fn(),
  curriculum: vi.fn(),
  pinned: vi.fn(),
  session: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  translate: vi.fn(),
  stream: vi.fn(),
  report: vi.fn(),
  store: vi.fn(),
  geo: vi.fn(),
}));
vi.mock("@/lib/security/cors", () => ({
  isCorsRequestAllowed: mocks.allow,
  createCorsForbiddenResponse: () => new Response("FORBIDDEN", { status: 403 }),
}));
vi.mock("@/lib/auth/server", () => ({ getToken: mocks.token }));
vi.mock("@/app/api/chat/utils", () => ({
  getVerified: mocks.verified,
  getUserInfo: mocks.user,
  getCurriculumPreference: mocks.curriculum,
}));
vi.mock("@/app/api/chat/persistence", () => ({
  reserveChatTurn: mocks.reserve,
  releaseChatTurn: mocks.release,
  createChatWithMessage: mocks.create,
  saveChatMessage: mocks.save,
  loadPinnedNinaContext: mocks.pinned,
}));
vi.mock("@/app/api/chat/context", () => ({
  resolveNinaLearningSession: mocks.session,
}));
vi.mock("@/app/api/chat/nakafa", () => ({ search: {} }));
vi.mock("@/app/api/chat/nakafa-content", () => ({ nakafaContent: {} }));
vi.mock("@/app/api/chat/observability", () => ({
  createChatErrorReporter: () => mocks.report,
}));
vi.mock("@/app/api/chat/store", () => ({ createNinaStore: mocks.store }));
vi.mock("@vercel/functions", () => ({ geolocation: mocks.geo }));
vi.mock("next-intl/server", () => ({ getTranslations: mocks.translate }));
vi.mock("@repo/ai/nina/harness/stream", async () => {
  const { Context, Layer } = await import("effect");
  class NinaHarness extends Context.Service<
    NinaHarness,
    { stream: typeof mocks.stream }
  >()("TestHarness") {
    static readonly layer = Layer.succeed(this, { stream: mocks.stream });
  }
  return { NinaHarness };
});

const body = {
  message: {
    id: "question",
    role: "user",
    parts: [{ type: "text", text: "Explain this" }],
  },
  locale: "id",
  model: "nakafa-lite",
  slug: "articles/test",
  context: {},
};
function request(overrides = {}) {
  return new Request("https://nakafa.com/api/chat", {
    method: "POST",
    body: JSON.stringify({ ...body, ...overrides }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.allow.mockReturnValue(Effect.succeed(true));
  mocks.token.mockResolvedValue("token");
  mocks.reserve.mockReturnValue(Effect.succeed("turn"));
  mocks.release.mockReturnValue(Effect.void);
  mocks.verified.mockReturnValue(Effect.succeed(false));
  // Admission already checked the balance before debiting it to zero.
  mocks.user.mockReturnValue(Effect.succeed({ role: "student", credits: 0 }));
  mocks.curriculum.mockReturnValue(Effect.succeed(null));
  mocks.pinned.mockReturnValue(Effect.void);
  mocks.session.mockReturnValue(
    openNinaLearningSession({
      capturedAt: "2026-09-23T00:00:00.000Z",
      source: "current-page",
      learning: {
        locale: "id",
        slug: body.slug,
        url: `https://nakafa.com/id/${body.slug}`,
        verified: false,
      },
    })
  );
  mocks.create.mockReturnValue(Effect.succeed("chat"));
  mocks.save.mockReturnValue(Effect.succeed("chat"));
  mocks.translate.mockResolvedValue((key: string) => key);
  mocks.stream.mockReturnValue(Effect.succeed(new Response("stream")));
  mocks.geo.mockReturnValue({});
  mocks.store.mockReturnValue({});
});

it.each([
  ["INSUFFICIENT_CREDITS", 402],
  ["RATE_LIMITED", 429],
] as const)(
  "rejects %s before any optional preparation",
  async (code, status) => {
    mocks.reserve.mockReturnValue(
      Effect.fail(new ChatAdmissionError({ code, message: code }))
    );
    const response = await POST(request({ id: "existing" }));
    expect(response.status).toBe(status);
    expect(await response.text()).toBe(code);
    for (const prepare of [
      mocks.geo,
      mocks.verified,
      mocks.user,
      mocks.curriculum,
      mocks.pinned,
      mocks.session,
      mocks.create,
      mocks.save,
      mocks.translate,
      mocks.stream,
    ]) {
      expect(prepare).not.toHaveBeenCalled();
    }
    expect(mocks.release).not.toHaveBeenCalled();
  }
);

it.each([
  "verified",
  "user",
  "curriculum",
  "pinned",
  "session",
  "create",
  "save",
  "stream",
] as const)("releases the reserved turn after a %s failure", async (phase) => {
  mocks[phase].mockReturnValue(
    Effect.fail(
      new ChatMutationError({
        cause: phase,
        message: `${phase} unavailable`,
        operation: "create-chat",
      })
    )
  );
  await expect(
    POST(
      request(phase === "pinned" || phase === "save" ? { id: "existing" } : {})
    )
  ).rejects.toThrow(`${phase} unavailable`);
  expect(mocks.release).toHaveBeenCalledExactlyOnceWith("turn", "token");
  expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(
    mocks[phase].mock.invocationCallOrder[0]
  );
});

it("refunds failed translations and keeps the original failure when refund IO fails", async () => {
  const failure = new Error("translations unavailable");
  mocks.translate.mockRejectedValue(failure);
  mocks.release.mockReturnValue(
    Effect.fail(
      new ChatMutationError({
        cause: "offline",
        message: "release offline",
        operation: "release-turn",
      })
    )
  );
  await expect(POST(request())).rejects.toMatchObject({ cause: failure });
  expect(mocks.release).toHaveBeenCalledExactlyOnceWith("turn", "token");
});

it.each([false, true])(
  "transfers hold ownership to the stream for existing=%s",
  async (existing) => {
    const response = await POST(request(existing ? { id: "existing" } : {}));
    expect(await response.text()).toBe("stream");
    expect(existing ? mocks.save : mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.store).toHaveBeenCalledWith(
      expect.objectContaining({ turnId: "turn", chatId: "chat" })
    );
    expect(mocks.release).not.toHaveBeenCalled();
  }
);

it.each([{ locale: "invalid" }, { model: "invalid" }, { message: null }])(
  "validates required fields before admission: %j",
  async (invalid) => {
    expect((await POST(request(invalid))).status).toBe(400);
    expect(mocks.reserve).not.toHaveBeenCalled();
  }
);
it("checks origin and authentication before admission", async () => {
  mocks.allow.mockReturnValueOnce(Effect.succeed(false));
  expect((await POST(request())).status).toBe(403);
  mocks.token.mockResolvedValueOnce(null);
  expect((await POST(request())).status).toBe(401);
  expect(mocks.reserve).not.toHaveBeenCalled();
});
it("rejects malformed JSON before admission", async () => {
  await expect(
    POST(
      new Request("https://nakafa.com/api/chat", { method: "POST", body: "{" })
    )
  ).rejects.toThrow();
  expect(mocks.reserve).not.toHaveBeenCalled();
});

it("carries admitted context and reports stream failures through the bound reporter", async () => {
  const { NinaReporter } = await import("@repo/ai/nina/runtime/report");
  const session = openNinaLearningSession({
    capturedAt: "2026-09-23T00:00:00.000Z",
    source: "pinned-chat",
    learning: {
      locale: "id",
      slug: body.slug,
      url: `https://nakafa.com/id/${body.slug}`,
      verified: false,
    },
  });
  mocks.pinned.mockReturnValue(
    session.pipe(Effect.map((value) => value.context.snapshot))
  );
  mocks.user.mockReturnValue(Effect.succeed({ credits: 0 }));
  mocks.curriculum.mockReturnValue(Effect.succeed({ program: "national" }));
  mocks.geo.mockReturnValue({
    latitude: "1",
    longitude: "2",
    city: "City",
    countryRegion: "Region",
    country: "Country",
  });
  mocks.stream.mockReturnValue(
    Effect.gen(function* () {
      const reporter = yield* NinaReporter;
      yield* reporter.report({ error: "provider", source: "stream" });
      return new Response("reported");
    })
  );
  expect(
    await (await POST(request({ id: "existing", slug: "settings" }))).text()
  ).toBe("reported");
  expect(mocks.verified).not.toHaveBeenCalled();
  expect(mocks.session).toHaveBeenCalledWith(
    expect.objectContaining({ pinnedContext: expect.anything() })
  );
  expect(mocks.stream).toHaveBeenCalledWith(
    expect.objectContaining({
      user: expect.objectContaining({
        curriculumPreference: { program: "national" },
      }),
    }),
    expect.any(AbortSignal),
    expect.any(AbortSignal)
  );
  expect(mocks.report).toHaveBeenCalledWith("provider", "stream");
});

it.each([false, true])(
  "settles an interrupted hold with client cancellation=%s",
  async (clientCancelled) => {
    const deadline = new AbortController();
    const client = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(deadline.signal);
    let started: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    mocks.stream.mockReturnValue(
      Effect.sync(() => started?.()).pipe(Effect.andThen(Effect.never))
    );
    const pending = POST(new Request(request(), { signal: client.signal }));
    await ready;
    if (clientCancelled) {
      client.abort();
    }
    deadline.abort();
    if (clientCancelled) {
      await expect(pending).rejects.toThrow();
    } else {
      expect((await pending).status).toBe(504);
    }
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith("turn", "token");
    timeout.mockRestore();
  }
);
