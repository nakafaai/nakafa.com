import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Npsn } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Schema } from "effect";
import {
  type Client,
  insertPeriod,
  isDraft,
  mapUnit,
  type Period,
  revokeClient,
  setPeriodName,
  setPeriodStatus,
  type Unit,
  withoutItem,
} from "@/components/tenant/settings/state";

const periodId = (id: string) =>
  Schema.decodeUnknownSync(Id("tenantPeriods"))(id);

/** One period as the periods list shows it. */
function period(id: string, overrides: Partial<Period> = {}): Period {
  return {
    end: "2027-06-30",
    id: periodId(id),
    name: id,
    start: "2026-07-01",
    status: "planned",
    ...overrides,
  };
}

/** One integration client as the clients list shows it. */
function client(id: string, overrides: Partial<Client> = {}): Client {
  return {
    actions: ["integration.view"],
    createdAt: 1,
    id: Schema.decodeUnknownSync(Id("integrationClients"))(id),
    name: id,
    revokedAt: null,
    rotatedAt: 1,
    scope: { kind: "tenant" },
    status: "active",
    ...overrides,
  };
}

/** One unit of the school as the units list shows it. */
function unit(id: string, overrides: Partial<Unit> = {}): Unit {
  return {
    contentLanguage: "id",
    id: Schema.decodeUnknownSync(Id("tenantUnits"))(id),
    level: "smp",
    name: id,
    npsn: null,
    status: "active",
    timeZone: "Asia/Jakarta",
    ...overrides,
  };
}

describe("components/tenant/settings/state", () => {
  it("sets the status of only the period with the given id", () => {
    const page = [period("first"), period("second")];
    expect(
      Arr.map(
        setPeriodStatus(page, periodId("second"), "active"),
        (item) => item.status
      )
    ).toEqual(["planned", "active"]);
  });

  it("places a new period by its start, the newest start first", () => {
    const page = [
      period("june", { start: "2027-06-01" }),
      period("august", { start: "2026-08-01" }),
    ];
    expect(
      Arr.map(
        insertPeriod(page, period("april", { start: "2027-04-01" })),
        (item) => item.name
      )
    ).toEqual(["june", "april", "august"]);
  });

  it("takes only the item with the given id off a list", () => {
    expect(withoutItem([{ id: "a" }, { id: "b" }, { id: "c" }], "b")).toEqual([
      { id: "a" },
      { id: "c" },
    ]);
  });

  it("shows only the client with the given id as revoked, at the given time", () => {
    const first = client("first");
    const second = client("second");
    expect(revokeClient([first, second], second.id, 42)).toEqual([
      first,
      client("second", { revokedAt: 42, status: "revoked" }),
    ]);
  });

  it("changes only the unit with the given id", () => {
    const smp = unit("smp");
    const sma = unit("sma");
    const npsn = Schema.decodeSync(Npsn)("20100001");
    expect(
      Arr.map(
        mapUnit([smp, sma], smp.id, (item) => ({ ...item, npsn })),
        (item) => item.npsn
      )
    ).toEqual(["20100001", null]);
  });

  it("sets the name of only the period with the given id", () => {
    const page = [period("first"), period("second")];
    expect(
      Arr.map(
        setPeriodName(page, periodId("second"), "Genap 2027"),
        (item) => item.name
      )
    ).toEqual(["first", "Genap 2027"]);
  });

  it("marks only the IDs that the page made before the server answered", () => {
    expect(isDraft("draft-3f2a")).toBe(true);
    expect(isDraft("kg2m8q3xz0h8w1d6e9r4t7y2u5i0o3p")).toBe(false);
  });
});
