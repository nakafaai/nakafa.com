import "@tanstack/react-start/server-only";
import exams from "@repo/backend/confect/_generated/refs/exams";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import { preloadConfectQuery } from "@/lib/data/preload.server";
import { orUndefined } from "@/lib/tenant/first.server";
import { memberHandler } from "@/lib/tenant/member.server";

/** The school whose home a staff member opens, and whether the viewer manages the school. */
export const StaffHomeInput = Schema.Struct({
  canManage: Schema.Boolean,
  slug: TenantSlug,
});

/** The school whose home a student opens. */
export const StudentHomeInput = Schema.Struct({ slug: TenantSlug });

/**
 * The first screen of a staff home: the exams and rooms the home lists, read in
 * one bounded call, and, for a manager, the school's setup, which the setup tile
 * shows. The viewer's own view comes from the school layout.
 */
export const staffHomeHandler = memberHandler(
  ({ canManage, slug }: typeof StaffHomeInput.Type, token: string) =>
    Effect.gen(function* () {
      const home = yield* orUndefined(
        preloadConfectQuery(exams.exams.home, { slug }, token)
      );
      if (!canManage) {
        return { home, setup: undefined };
      }
      const setup = yield* orUndefined(
        preloadConfectQuery(tenancy.home.setup, { slug }, token)
      );
      return { home, setup };
    })
);

/** The first screen of a student home: the sittings the student may take part in. */
export const studentHomeHandler = memberHandler(
  ({ slug }: typeof StudentHomeInput.Type, token: string) =>
    Effect.gen(function* () {
      const sittings = yield* orUndefined(
        preloadConfectQuery(exams.sittings.mine, { slug }, token)
      );
      return { sittings };
    })
);
