import { FunctionImpl } from "@confect/server";
import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import {
  classAuthority,
  placeClass,
} from "@repo/backend/confect/classroom/authority";
import { classView } from "@repo/backend/confect/classroom/class";
import { holdersOf } from "@repo/backend/confect/classroom/classes/address";
import spec from "@repo/backend/confect/classroom/classes.spec";
import { ClassAmbiguous } from "@repo/backend/confect/classroom/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Effect, Option } from "effect";

/**
 * How one holder of an address stands. A class that an archive locks, whatever its
 * period, is archived and stays readable. A class that no archive locks is live
 * when its period is active, and a class of a period that is still planned is not
 * named yet, so it is left out, as `None`.
 */
const standingOf = Effect.fnUntraced(function* (row: ClassesDoc) {
  const { locked } = yield* placeClass(row);
  if (locked) {
    return Option.some({ live: false, row });
  }
  const period = yield* (yield* DatabaseReader)
    .table("tenantPeriods")
    .get(row.periodId)
    .pipe(Effect.orDie);
  if (period.status === "planned") {
    return Option.none();
  }
  return Option.some({ live: true, row });
});

/**
 * The class that an address names among its holders. A live class is named first,
 * and two live classes are ambiguous. With no live class, the archived classes name
 * the address, and two of them are ambiguous too.
 */
const namedBy = Effect.fnUntraced(function* (holders: readonly ClassesDoc[]) {
  const standing = Arr.getSomes(
    yield* Effect.forEach(holders, standingOf, { concurrency: "unbounded" })
  );
  const live = Arr.filter(standing, (holder) => holder.live);
  const named = live.length > 0 ? live : standing;
  if (named.length > 1) {
    return yield* new ClassAmbiguous();
  }
  return Arr.head(named).pipe(Option.map((holder) => holder.row));
});

/**
 * One class by its address in the caller's school. A live class, in an active
 * period that no archive locks, is the class an address names. An archived class,
 * or a class of an archived period, cohort, or unit, stays readable and takes no
 * write, so it names its address when no live class holds it, and the class's read
 * rule decides the read. A class of a period not yet open is not named until the
 * period opens. An address that names two or more classes is refused as
 * ambiguous before the access decision, and names no class. An address that no
 * class holds is refused the way a missing object is.
 */
export const resolve = FunctionImpl.make(
  databaseSchema,
  spec,
  "resolve",
  Effect.fn("classroom.classes.resolve")(function* ({ classSlug }) {
    const { tenant } = yield* Member;
    const holders = yield* holdersOf(tenant._id, classSlug);
    const found = yield* namedBy(holders);
    if (Option.isNone(found)) {
      return yield* new AccessDenied({
        action: "class.view",
        reason: "resource",
      });
    }
    yield* classAuthority.check("class.view", found.value);
    return {
      ...classView(found.value),
      can: yield* classAuthority.allowed(found.value),
    };
  })
);
