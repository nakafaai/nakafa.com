// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { isLearnerPage, readVisitorAsset } from "@/lib/routing/learner.server";

const release = vi.hoisted(() => ({ hasStaticRelease: true }));

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which the deployed Worker binds and a prerender does not. */
  env: {
    get ASSETS() {
      return release.hasStaticRelease ? assets : undefined;
    },
  },
}));

const SET = "https://nakafa.com/en/try-out/indonesia/snbt/2027/set-1";

/** The session cookie that the production site reads. */
const SESSION = "__Secure-better-auth.session_token=session-value";

/** A learner's request: it sends the session cookie. */
function signedIn(address: string, init?: RequestInit) {
  return new Request(address, { ...init, headers: { cookie: SESSION } });
}

/** The address of the one asset that the binding was asked for. */
function fetchedAddress() {
  const [request] = assets.fetch.mock.calls[0] ?? [];
  return request?.url;
}

beforeEach(() => {
  release.hasStaticRelease = true;
  assets.fetch.mockReset();
});

describe("learner pages", () => {
  it("renders a learner's track, set and section, and an attempt's address", () => {
    expect(isLearnerPage(signedIn(SET))).toBe(true);
    expect(isLearnerPage(signedIn(`${SET}/general-reasoning`))).toBe(true);
    expect(
      isLearnerPage(
        signedIn("https://nakafa.com/en/try-out/indonesia/snbt/2027")
      )
    ).toBe(true);
    expect(isLearnerPage(new Request(`${SET}?attemptId=attempt-id`))).toBe(
      true
    );
  });

  it("renders no visitor's page, file, catalog page or school page", () => {
    expect(isLearnerPage(new Request(SET))).toBe(false);
    expect(isLearnerPage(signedIn(`${SET}.md`))).toBe(false);
    expect(
      isLearnerPage(signedIn("https://nakafa.com/en/try-out/indonesia/snbt"))
    ).toBe(false);
    expect(
      isLearnerPage(
        signedIn("https://harapan.nakafa.com/en/try-out/indonesia/snbt/2027")
      )
    ).toBe(false);
  });
});

describe("visitor pages", () => {
  it.effect(
    "answers a visitor's set with the page the build wrote for it",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(new Response("<html>set</html>"));

        const answer = yield* readVisitorAsset(
          new Request(`${SET}?view=single`)
        );

        expect(Option.isSome(answer)).toBe(true);
        expect(fetchedAddress()).toBe(
          "https://nakafa.com/_tryout/en/try-out/indonesia/snbt/2027/set-1"
        );
      })
  );

  it.effect(
    "leaves a page that the release does not hold to the Worker's decisions, and drops the not-found body",
    () =>
      Effect.gen(function* () {
        const body = new ReadableStream();
        const cancel = vi.spyOn(body, "cancel");
        assets.fetch.mockResolvedValue(new Response(body, { status: 404 }));

        const answer = yield* readVisitorAsset(
          new Request("https://nakafa.com/de/try-out/indonesia/snbt/2027/set-2")
        );

        expect(Option.isNone(answer)).toBe(true);
        expect(cancel).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "reads no page for a learner, a write, a catalog page, a file, or a prerender",
    () =>
      Effect.gen(function* () {
        const reads = [
          signedIn(SET),
          new Request(`${SET}?attemptId=attempt-id`),
          new Request(SET, { body: "{}", method: "POST" }),
          new Request("https://nakafa.com/en/try-out/indonesia/snbt"),
          new Request(`${SET}.md`),
        ];
        for (const request of reads) {
          expect(Option.isNone(yield* readVisitorAsset(request))).toBe(true);
        }
        release.hasStaticRelease = false;
        expect(Option.isNone(yield* readVisitorAsset(new Request(SET)))).toBe(
          true
        );
        expect(assets.fetch).not.toHaveBeenCalled();
      })
  );
});
