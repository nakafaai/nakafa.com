import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { SeedRefused } from "@repo/backend/confect/acceptance/seed";
import { ExamTitle } from "@repo/backend/confect/exams/exam";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The most extra students a seed seats in its sitting: more than one dashboard page of 100,
 * so a browser test reaches the second page, and few enough for one transaction.
 */
const CROWD_MAX = 150;

/** What the acceptance seed answers: the exam, its title, its sitting, and the sitting's token. */
const SittingSeed = Schema.Struct({
  examId: Id("exams"),
  sittingId: Id("examSittings"),
  title: ExamTitle,
  token: Schema.String,
});

/**
 * The acceptance seed of school exams. It is internal, so no browser can call it, and only the
 * acceptance command line calls it with the deployment's key (ADR 0013).
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "sitting",
    args: () => ({
      crowd: Schema.optionalKey(
        Schema.Int.check(Schema.isBetween({ maximum: CROWD_MAX, minimum: 0 }))
      ),
      email: Email,
      /** Whether the seeded exam also holds an essay, which the student writes and the teacher grades. */
      essay: Schema.optionalKey(Schema.Boolean),
      slug: TenantSlug,
      /** Whether the seed also schedules a room for the next day, which a browser test reads as an upcoming room. */
      upcoming: Schema.optionalKey(Schema.Boolean),
    }),
    returns: () => SittingSeed,
    error: () => SeedRefused,
  })
);
