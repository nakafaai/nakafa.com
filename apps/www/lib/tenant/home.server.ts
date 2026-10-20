import "@tanstack/react-start/server-only";
import exams from "@repo/backend/confect/_generated/refs/exams";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import { readOptional, readRequired } from "@/lib/data/read.server";
import { memberHandler } from "@/lib/tenant/member.server";

/** The school whose home a staff member opens. */
export const StaffHomeInput = Schema.Struct({ slug: TenantSlug });

/** The school whose home a student opens. */
export const StudentHomeInput = Schema.Struct({ slug: TenantSlug });

/**
 * The first screen of a staff home: the exams and rooms the home lists, read in
 * one bounded call. That call also says whether the viewer manages the school, as
 * the server decides it, so only a manager's first screen reads the school's
 * setup, which the setup tile shows. The viewer's own view comes from the school
 * layout, and no second read of the viewer happens here.
 */
export const staffHomeHandler = memberHandler(
  ({ slug }: typeof StaffHomeInput.Type, token: string) =>
    Effect.gen(function* () {
      const home = yield* readRequired(exams.exams.home, { slug }, token);
      if (!home.canManageSetup) {
        return { home, setup: undefined };
      }
      const setup = yield* readOptional(tenancy.home.setup, { slug }, token);
      return { home, setup };
    })
);

/** The first screen of a student home: the sittings the student may take part in. */
export const studentHomeHandler = memberHandler(
  ({ slug }: typeof StudentHomeInput.Type, token: string) =>
    Effect.gen(function* () {
      const sittings = yield* readRequired(
        exams.sittings.mine,
        { slug },
        token
      );
      return { sittings };
    })
);
