import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { requireConsent } from "@repo/backend/confect/guardians/gate";
import { nf } from "@repo/backend/test/classroom";
import {
  asStaffSchool,
  type Fixture,
  setRoster,
  startLink,
} from "@repo/backend/test/guardians";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** What the gate answers for the school's student: passed, or its refusal's tag. */
const gate = (fixture: Fixture) =>
  fixture.run(
    requireConsent(fixture.people.student.personId).pipe(
      Effect.as("passed"),
      Effect.catchTag("ConsentRequired", (error) => Effect.succeed(error.code))
    )
  );

describe("guardians/gate", () => {
  it.effect(
    "refuses a student without an age flag or under the limit until a link is verified",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        expect(yield* gate(fixture)).toBe("CONSENT_REQUIRED");
        yield* setRoster(fixture, { underAgeLimit: true });
        const link = yield* startLink(fixture);
        expect(yield* gate(fixture)).toBe("CONSENT_REQUIRED");
        yield* fixture
          .as("counselor")
          .mutation(refs.public.guardians.links.verify, { linkId: link.id, slug: nf });
        expect(yield* gate(fixture)).toBe("passed");
        yield* fixture
          .as("counselor")
          .mutation(refs.public.guardians.links.revoke, { linkId: link.id, slug: nf });
        expect(yield* gate(fixture)).toBe("CONSENT_REQUIRED");
      })
  );

  it.effect("passes a student whom the school marks at or above the limit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      yield* setRoster(fixture, { underAgeLimit: false });
      expect(yield* gate(fixture)).toBe("passed");
    })
  );
});
