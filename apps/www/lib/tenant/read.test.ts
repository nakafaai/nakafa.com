// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  TenantProfile,
  TenantSettings,
  ViewerAccount,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Layer, Option, Result, Schema } from "effect";
import type { SchoolViewer } from "@/lib/tenant/frame";
import {
  readSchoolFrame,
  SchoolReadFailed,
  SchoolReads,
} from "@/lib/tenant/read";

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
