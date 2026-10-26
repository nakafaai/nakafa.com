// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import auth from "@repo/backend/confect/_generated/refs/auth";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  TenantProfile,
  TenantSettings,
  ViewerAccount,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Layer, Option, Result, Schema } from "effect";
import { readSchoolSignInTitle } from "@/lib/tenant/copy";
import { outsiderOf, type SchoolViewer } from "@/lib/tenant/frame";
import {
  readSchoolFrame,
  SchoolReadFailed,
  SchoolReads,
  SchoolReadsLive,
} from "@/lib/tenant/read";

/** The Convex answer of every query the live reads make, chosen by each test. */
const queryMock = vi.hoisted(() => vi.fn());
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return { ...client, query: queryMock };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});

/** The title copy, which a test makes fail to reach the failure branch of a visitor's read. */
vi.mock("@/lib/tenant/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant/copy")>();
  return {
    ...actual,
    readSchoolSignInTitle: vi.fn(actual.readSchoolSignInTitle),
  };
});

const SLUG = Schema.decodeSync(TenantSlug)("harapan");

const PROFILE = Schema.decodeSync(TenantProfile)({
  kind: "school",
  mascot: "cat.0.243e66.right.open",
  name: "Harapan",
  slug: "harapan",
  status: "active",
});

const MASCOT = "cat.0.243e66.right.open";

/** The tenant of the viewer: the school profile with its id and its settings. */
const TenantView = Schema.Struct({
  ...TenantProfile.fields,
  id: Id("tenants"),
  ...TenantSettings.fields,
});

/** The viewer of a member of the school, with no grant and no unit, decoded with the backend schemas. */
const VIEWER: SchoolViewer = {
  account: Schema.decodeSync(ViewerAccount)({ mascot: MASCOT, name: "Ayu" }),
  can: [],
  grants: [],
  person: {
    id: Schema.decodeUnknownSync(Id("tenantPeople"))("person-1"),
    kind: "member",
    name: "Ayu",
  },
  tenant: Schema.decodeUnknownSync(TenantView)({
    country: "ID",
    currency: "IDR",
    id: "tenant-1",
    kind: "school",
    mascot: MASCOT,
    name: "Harapan",
    policies: { emailDomains: [], nina: false, studentThreads: false },
    slug: "harapan",
    status: "active",
  }),
  units: [],
};

/** A school read set whose answers the test chooses; any read it does not set dies the test. */
function reads(answers: {
  readonly profile?: Effect.Effect<
    Option.Option<typeof PROFILE>,
    SchoolReadFailed
  >;
  readonly viewer?: Effect.Effect<
    Result.Result<SchoolViewer, "Denied" | "Outsider">,
    SchoolReadFailed
  >;
  readonly account?: Effect.Effect<Option.Option<string>, SchoolReadFailed>;
}) {
  return Layer.succeed(
    SchoolReads,
    SchoolReads.of({
      account: () => answers.account ?? Effect.die("account not expected"),
      profile: () => answers.profile ?? Effect.die("profile not expected"),
      viewer: () => answers.viewer ?? Effect.die("viewer not expected"),
    })
  );
}

const READ = { locale: "en", slug: SLUG } as const;

describe("readSchoolFrame", () => {
  it.effect("refuses every visitor when no school has the address", () =>
    Effect.gen(function* () {
      const read = yield* readSchoolFrame({
        ...READ,
        token: Option.none(),
      }).pipe(Effect.provide(reads({ profile: Effect.succeedNone })));
      expect(read).toEqual({ _tag: "Refused" });
    })
  );

  it.effect(
    "shows a visitor the entry surface with the school's sign-in line",
    () =>
      Effect.gen(function* () {
        const read = yield* readSchoolFrame({
          ...READ,
          token: Option.none(),
        }).pipe(
          Effect.provide(reads({ profile: Effect.succeedSome(PROFILE) }))
        );
        expect(read).toEqual({
          _tag: "Visitor",
          locale: "en",
          profile: PROFILE,
          title: "Sign in to Harapan",
        });
      })
  );

  it.effect(
    "shows a member the shell with the viewer, its greeting and its home access",
    () =>
      Effect.gen(function* () {
        const read = yield* readSchoolFrame({
          ...READ,
          token: Option.some("token"),
        }).pipe(
          Effect.provide(
            reads({
              profile: Effect.succeedSome(PROFILE),
              viewer: Effect.succeed(Result.succeed(VIEWER)),
            })
          )
        );
        expect(read).toMatchObject({
          _tag: "Member",
          locale: "en",
          profile: PROFILE,
          viewer: VIEWER,
        });
      })
  );

  it.effect("refuses a signed-in viewer whom the school denies", () =>
    Effect.gen(function* () {
      const read = yield* readSchoolFrame({
        ...READ,
        token: Option.some("token"),
      }).pipe(
        Effect.provide(
          reads({
            profile: Effect.succeedSome(PROFILE),
            viewer: Effect.succeed(Result.fail("Denied")),
          })
        )
      );
      expect(read).toEqual({ _tag: "Refused" });
    })
  );

  it.effect(
    "shows an account that is not a member the outsider page with its name",
    () =>
      Effect.gen(function* () {
        const read = yield* readSchoolFrame({
          ...READ,
          token: Option.some("token"),
        }).pipe(
          Effect.provide(
            reads({
              account: Effect.succeedSome("Ayu"),
              profile: Effect.succeedSome(PROFILE),
              viewer: Effect.succeed(Result.fail("Outsider")),
            })
          )
        );
        expect(read).toEqual({
          _tag: "Outsider",
          account: "Ayu",
          locale: "en",
          profile: PROFILE,
        });
      })
  );

  it.effect("refuses an outsider whose account names nothing", () =>
    Effect.gen(function* () {
      const read = yield* readSchoolFrame({
        ...READ,
        token: Option.some("token"),
      }).pipe(
        Effect.provide(
          reads({
            account: Effect.succeedNone,
            profile: Effect.succeedSome(PROFILE),
            viewer: Effect.succeed(Result.fail("Outsider")),
          })
        )
      );
      expect(read).toEqual({ _tag: "Refused" });
    })
  );

  it.effect(
    "fails the whole answer when a read fails, so an outage is not a missing school",
    () =>
      Effect.gen(function* () {
        const failure = yield* readSchoolFrame({
          ...READ,
          token: Option.none(),
        }).pipe(
          Effect.provide(
            reads({
              profile: Effect.fail(new SchoolReadFailed({ cause: "offline" })),
            })
          ),
          Effect.flip
        );
        expect(failure._tag).toBe("SchoolReadFailed");
      })
  );
});

describe("readSchoolFrame with a signed-in account that the school does not refuse", () => {
  it.effect("refuses a signed-in account on a school that has no profile", () =>
    Effect.gen(function* () {
      const read = yield* readSchoolFrame({
        ...READ,
        token: Option.some("token"),
      }).pipe(
        Effect.provide(
          reads({
            account: Effect.succeedSome("Ayu"),
            profile: Effect.succeedNone,
            viewer: Effect.succeed(Result.fail("Outsider")),
          })
        )
      );
      expect(read).toEqual({ _tag: "Refused" });
    })
  );

  it.effect("fails the whole answer when the visitor's title cannot load", () =>
    Effect.gen(function* () {
      vi.mocked(readSchoolSignInTitle).mockRejectedValueOnce(
        new Error("messages")
      );
      const failure = yield* readSchoolFrame({
        ...READ,
        token: Option.none(),
      }).pipe(
        Effect.provide(reads({ profile: Effect.succeedSome(PROFILE) })),
        Effect.flip
      );
      expect(failure._tag).toBe("SchoolReadFailed");
    })
  );
});

describe("SchoolReadsLive", () => {
  const liveReads = Effect.fn("test.liveReads")(function* () {
    return yield* SchoolReads;
  });

  it.effect("reads the public profile of a school", () =>
    Effect.gen(function* () {
      queryMock.mockReset();
      queryMock.mockReturnValue(Effect.succeed(PROFILE));
      const reads = yield* liveReads().pipe(Effect.provide(SchoolReadsLive));
      expect(yield* reads.profile(SLUG)).toEqual(Option.some(PROFILE));
      expect(queryMock).toHaveBeenCalledWith(tenancy.profile.get, {
        slug: SLUG,
      });
    })
  );

  it.effect("answers a school with no profile as none", () =>
    Effect.gen(function* () {
      queryMock.mockReset();
      queryMock.mockReturnValue(Effect.fail({ _tag: "TenantNotFound" }));
      const reads = yield* liveReads().pipe(Effect.provide(SchoolReadsLive));
      expect(yield* reads.profile(SLUG)).toEqual(Option.none());
    })
  );

  it.effect("fails a profile read that Convex did not answer", () =>
    Effect.gen(function* () {
      queryMock.mockReset();
      queryMock.mockReturnValue(Effect.fail({ _tag: "Offline" }));
      const reads = yield* liveReads().pipe(Effect.provide(SchoolReadsLive));
      const failure = yield* reads.profile(SLUG).pipe(Effect.flip);
      expect(failure._tag).toBe("SchoolReadFailed");
    })
  );

  it.effect("reads a member's view of the school with the session token", () =>
    Effect.gen(function* () {
      queryMock.mockReset();
      queryMock.mockReturnValue(Effect.succeed(VIEWER));
      const reads = yield* liveReads().pipe(Effect.provide(SchoolReadsLive));
      expect(yield* reads.viewer(SLUG, "token")).toEqual(
        Result.succeed(VIEWER)
      );
      expect(queryMock).toHaveBeenCalledWith(tenancy.viewer.get, {
        slug: SLUG,
      });
    })
  );

  it.effect("answers a denied and a non-member view as refusals", () =>
    Effect.gen(function* () {
      const reads = yield* liveReads().pipe(Effect.provide(SchoolReadsLive));
      queryMock.mockReset();
      queryMock.mockReturnValue(Effect.fail({ _tag: "AccessDenied" }));
      expect(yield* reads.viewer(SLUG, "token")).toEqual(Result.fail("Denied"));
      queryMock.mockReset();
      queryMock.mockReturnValue(Effect.fail({ _tag: "NotMember" }));
      expect(yield* reads.viewer(SLUG, "token")).toEqual(
        Result.fail("Outsider")
      );
    })
  );

  it.effect("fails a viewer read that Convex did not answer", () =>
    Effect.gen(function* () {
      queryMock.mockReset();
      queryMock.mockReturnValue(Effect.fail({ _tag: "SessionRequired" }));
      const reads = yield* liveReads().pipe(Effect.provide(SchoolReadsLive));
      const failure = yield* reads.viewer(SLUG, "token").pipe(Effect.flip);
      expect(failure._tag).toBe("SchoolReadFailed");
    })
  );

  it.effect("names an outsider's account by its name, then its username", () =>
    Effect.gen(function* () {
      const reads = yield* liveReads().pipe(Effect.provide(SchoolReadsLive));
      queryMock.mockReset();
      queryMock.mockReturnValue(
        Effect.succeed({ appUser: { name: "Ayu", username: "ayu" } })
      );
      expect(yield* reads.account("token")).toEqual(Option.some("Ayu"));
      expect(queryMock).toHaveBeenCalledWith(auth.queries.getCurrentUser);
      queryMock.mockReset();
      queryMock.mockReturnValue(
        Effect.succeed({ appUser: { name: "", username: "ayu" } })
      );
      expect(yield* reads.account("token")).toEqual(Option.some("ayu"));
      queryMock.mockReset();
      queryMock.mockReturnValue(Effect.succeed(null));
      expect(yield* reads.account("token")).toEqual(Option.none());
    })
  );

  it.effect("fails an account read that Convex did not answer", () =>
    Effect.gen(function* () {
      queryMock.mockReset();
      queryMock.mockReturnValue(Effect.fail({ _tag: "Offline" }));
      const reads = yield* liveReads().pipe(Effect.provide(SchoolReadsLive));
      const failure = yield* reads.account("token").pipe(Effect.flip);
      expect(failure._tag).toBe("SchoolReadFailed");
    })
  );
});

describe("outsiderOf", () => {
  /** The frame that a member's own visit holds, read with the viewer that the test chooses. */
  const memberFrame = (viewer: SchoolViewer) =>
    readSchoolFrame({ ...READ, token: Option.some("token") }).pipe(
      Effect.provide(reads({ viewer: Effect.succeed(Result.succeed(viewer)) }))
    );

  it.effect(
    "gives a member whom the school stops counting the outsider frame that a reload reads",
    () =>
      Effect.gen(function* () {
        const member = yield* memberFrame(VIEWER);
        const reload = yield* readSchoolFrame({
          ...READ,
          token: Option.some("token"),
        }).pipe(
          Effect.provide(
            reads({
              account: Effect.succeedSome("Ayu"),
              profile: Effect.succeedSome(PROFILE),
              viewer: Effect.succeed(Result.fail("Outsider")),
            })
          )
        );
        expect(Option.getOrThrow(outsiderOf(member))).toMatchObject(reload);
      })
  );

  it.effect(
    "names the outsider by the username when the account has no name, as a reload does",
    () =>
      Effect.gen(function* () {
        const member = yield* memberFrame({
          ...VIEWER,
          account: Schema.decodeSync(ViewerAccount)({
            mascot: MASCOT,
            name: "",
            username: "ayu",
          }),
        });
        expect(
          Option.map(outsiderOf(member), (outsider) => outsider.account)
        ).toEqual(Option.some("ayu"));
      })
  );

  it.effect(
    "gives none for an account that names nothing, where a reload answers not found",
    () =>
      Effect.gen(function* () {
        const member = yield* memberFrame({
          ...VIEWER,
          account: Schema.decodeSync(ViewerAccount)({
            mascot: MASCOT,
            name: "",
          }),
        });
        expect(outsiderOf(member)).toEqual(Option.none());
      })
  );

  it("gives none for a frame that is not a member's", () => {
    expect(outsiderOf({ _tag: "Refused" })).toEqual(Option.none());
  });
});
