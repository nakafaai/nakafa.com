import type { GenericId } from "@confect/core";
import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { placeClass } from "@repo/backend/confect/classroom/authority";
import { CLASS_ADDRESS_LIMIT } from "@repo/backend/confect/classroom/class";
import { ClassAmbiguous } from "@repo/backend/confect/classroom/errors";
import { Effect, Option } from "effect";

/** The period and unit a new class is written into, and the school it belongs to. */
type Place = Pick<ClassesDoc, "periodId" | "tenantId" | "unitId">;

/**
 * The classes of one school that hold one address, archived ones included, read
 * through the school's address index. A period holds one class at each address, so
 * the school holds one class per period that has used it. The read takes one more
 * than CLASS_ADDRESS_LIMIT, and a larger set is refused as ambiguous, never truncated.
 */
export const holdersOf = Effect.fn("classroom.classes.holders")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  classSlug: string
) {
  const holders = yield* (yield* DatabaseReader)
    .table("classes")
    .index("by_tenantId_and_slug", (query) =>
      query.eq("tenantId", tenantId).eq("slug", classSlug)
    )
    .take(CLASS_ADDRESS_LIMIT + 1)
    .pipe(Effect.orDie);
  if (holders.length > CLASS_ADDRESS_LIMIT) {
    return yield* new ClassAmbiguous();
  }
  return holders;
});

/**
 * Whether a holder of an address blocks a class of another unit: the holder is not
 * archived, and no archive locks it. A class of the same unit never blocks, because a
 * unit runs one active period at a time, so two of its classes that are live together
 * sit in one period, where that period's check keeps them apart.
 */
const blocks = Effect.fnUntraced(function* (
  holder: ClassesDoc,
  unitId: GenericId.GenericId<"tenantUnits">
) {
  if (holder.unitId === unitId || holder.status === "archived") {
    return false;
  }
  const { locked } = yield* placeClass(holder);
  return !locked;
});

/**
 * Whether a new class of the place may take the address. No class of its period
 * holds the address, archived ones included, and no class of another unit that no
 * archive locks holds it. A class of a planned period counts too, so opening that
 * period never brings two classes of one school to one address.
 */
const isFree = Effect.fnUntraced(function* (place: Place, slug: string) {
  const taken = yield* (yield* DatabaseReader)
    .table("classes")
    .index("by_periodId_and_slug", (query) =>
      query.eq("periodId", place.periodId).eq("slug", slug)
    )
    .first()
    .pipe(Effect.map(Option.isSome), Effect.orDie);
  if (taken) {
    return false;
  }
  const holders = yield* holdersOf(place.tenantId, slug);
  const blocking = yield* Effect.filter(holders, (holder) =>
    blocks(holder, place.unitId)
  );
  return blocking.length === 0;
});

/** The address at one step of the walk: the base, then the base with -2, -3, and so on. */
const addressAt = (base: string, suffix: number) =>
  suffix === 1 ? base : `${base}-${suffix}`;

/**
 * The first address from the base that a new class of the place may take. Each step
 * reads the period and the school's holders of one address, and the walk ends at the
 * first free address, so it visits only the taken ones.
 */
export const freeAddress = Effect.fn("classroom.classes.freeAddress")(
  function* (place: Place, base: string) {
    let suffix = 1;
    while (!(yield* isFree(place, addressAt(base, suffix)))) {
      suffix += 1;
    }
    return addressAt(base, suffix);
  }
);
