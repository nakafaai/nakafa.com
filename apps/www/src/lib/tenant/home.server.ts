import exams from "@repo/backend/confect/_generated/refs/exams";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Clock, Effect, Schema } from "effect";
import { readRequired } from "@/lib/data/read.server";
import { memberHandler } from "@/lib/tenant/member.server";

/** The school whose home a staff member opens. */
export const StaffHomeInput = Schema.Struct({ slug: TenantSlug });

/** The school whose home a student opens. */
export const StudentHomeInput = Schema.Struct({ slug: TenantSlug });

/**
 * The first screen of a staff home: the exams and rooms the home lists, read in
 * one bounded call. That call also carries the school's setup for a viewer whom the
 * server lets manage the school, so the staff home makes no second read. The
 * viewer's own view comes from the school layout, and no second read of the viewer
 * happens here. The server's time comes with it, so the home's countdowns and bars
 * start from the same moment on the server and in the browser.
 */
export const staffHomeHandler = memberHandler(
  ({ slug }: typeof StaffHomeInput.Type, token: string) =>
    Effect.gen(function* () {
      const home = yield* readRequired(exams.exams.home, { slug }, token);
      const serverNow = yield* Clock.currentTimeMillis;
      return { home, serverNow };
    })
);

/**
 * The first screen of a student home: the sittings the student may take part in,
 * with the server's time, which the home's countdowns start from.
 */
export const studentHomeHandler = memberHandler(
  ({ slug }: typeof StudentHomeInput.Type, token: string) =>
    Effect.gen(function* () {
      const sittings = yield* readRequired(
        exams.sittings.mine,
        { slug },
        token
      );
      const serverNow = yield* Clock.currentTimeMillis;
      return { serverNow, sittings };
    })
);
