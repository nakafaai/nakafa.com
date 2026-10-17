import { describe, expect, it } from "@effect/vitest";
import {
  UnitZone,
  zoneOfNotice,
} from "@repo/backend/confect/notifications/zone";
import type { UnitStatus } from "@repo/backend/confect/tenancy/schema";
import { DateTime, Effect, Option, Schema } from "effect";

/** A unit row as the caller reads it from the tenant's units. */
const unit = (fields: {
  readonly created: number;
  readonly id: string;
  readonly status: typeof UnitStatus.Type;
  readonly timeZone: string;
}) =>
  Schema.decodeUnknownSync(UnitZone)({
    _creationTime: fields.created,
    _id: fields.id,
    status: fields.status,
    timeZone: fields.timeZone,
  });

const archivedBerlin = unit({
  created: 1,
  id: "unit-archived",
  status: "archived",
  timeZone: "Europe/Berlin",
});
const newestJakarta = unit({
  created: 9,
  id: "unit-newest",
  status: "active",
  timeZone: "Asia/Jakarta",
});
const oldestActiveBerlin = unit({
  created: 5,
  id: "unit-oldest",
  status: "active",
  timeZone: "Europe/Berlin",
});
const units = [archivedBerlin, newestJakarta, oldestActiveBerlin];

describe("notifications/zone zoneOfNotice", () => {
  it.effect("gives a notice of a unit the zone of that unit", () =>
    Effect.gen(function* () {
      const zone = yield* zoneOfNotice(Option.some(newestJakarta._id), units);
      expect(zone.id).toBe("Asia/Jakarta");
    })
  );

  it.effect(
    "gives a tenant-level notice the zone of the oldest active unit, whatever order the units are in",
    () =>
      Effect.gen(function* () {
        const zone = yield* zoneOfNotice(Option.none(), units);
        expect(zone.id).toBe("Europe/Berlin");
      })
  );

  it.effect(
    "gives a tenant-level notice the same zone whatever order units created in one moment are listed in, and the smaller id wins the tie",
    () =>
      Effect.gen(function* () {
        const jakartaUnit = unit({
          created: 4,
          id: "unit-b",
          status: "active",
          timeZone: "Asia/Jakarta",
        });
        const berlinUnit = unit({
          created: 4,
          id: "unit-a",
          status: "active",
          timeZone: "Europe/Berlin",
        });
        const listedJakartaFirst = yield* zoneOfNotice(Option.none(), [
          jakartaUnit,
          berlinUnit,
        ]);
        const listedBerlinFirst = yield* zoneOfNotice(Option.none(), [
          berlinUnit,
          jakartaUnit,
        ]);
        expect(listedJakartaFirst.id).toBe("Europe/Berlin");
        expect(listedBerlinFirst.id).toBe("Europe/Berlin");
      })
  );

  it.effect(
    "fails when the unit of a notice is not among the units given",
    () =>
      Effect.gen(function* () {
        const missing = unit({
          created: 2,
          id: "unit-missing",
          status: "active",
          timeZone: "Asia/Jakarta",
        });
        const error = yield* Effect.flip(
          zoneOfNotice(Option.some(missing._id), units)
        );
        expect(error.reason).toBe("UNIT_NOT_FOUND");
      })
  );

  it.effect(
    "fails when a tenant-level notice has no active unit to take a zone from",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          zoneOfNotice(Option.none(), [archivedBerlin])
        );
        expect(error.reason).toBe("NO_ACTIVE_UNIT");
      })
  );

  it.effect("gives a notice of a unit in GMT the zero offset of GMT", () =>
    Effect.gen(function* () {
      const gmtUnit = unit({
        created: 6,
        id: "unit-gmt",
        status: "active",
        timeZone: "GMT",
      });
      const zone = yield* zoneOfNotice(Option.some(gmtUnit._id), [gmtUnit]);
      const instant = DateTime.setZone(
        DateTime.makeUnsafe("2026-10-16T18:30:00Z"),
        zone
      );
      expect(DateTime.zonedOffset(instant)).toBe(0);
    })
  );

  it.effect("fails when the stored zone of the unit is not an IANA zone", () =>
    Effect.gen(function* () {
      const offsetOnly = unit({
        created: 3,
        id: "unit-offset",
        status: "active",
        timeZone: "+07:00",
      });
      const error = yield* Effect.flip(
        zoneOfNotice(Option.some(offsetOnly._id), [offsetOnly])
      );
      expect(error.reason).toBe("ZONE_INVALID");
    })
  );
});
