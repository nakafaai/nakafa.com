import { describe, expect, it } from "@effect/vitest";
import { namedTimeZone } from "@repo/utilities/timezone";
import { Option } from "effect";

describe("namedTimeZone", () => {
  it.each(["Asia/Jakarta", "Europe/Berlin", "Etc/GMT+7", "UTC"])(
    "gives the named zone of the IANA name %s",
    (id) => {
      expect(Option.map(namedTimeZone(id), (zone) => zone.id)).toEqual(
        Option.some(id)
      );
    }
  );

  it.each(["GMT", "GMT0", "GMT+0", "GMT-0"])(
    "gives the named zone of the GMT name %s",
    (id) => {
      expect(Option.isSome(namedTimeZone(id))).toBe(true);
    }
  );

  it.each(["+07:00", "+0700", "+07", "-07", "+00:00"])(
    "refuses the fixed offset %s, which the platform accepts as a zone",
    (id) => {
      expect(Option.isNone(namedTimeZone(id))).toBe(true);
    }
  );

  it.each([
    "GMT+7",
    "UTC+07:00",
    "WIB",
    "Mars/Olympus",
    "Asia/Nowhere",
    "",
    " Asia/Jakarta",
  ])("refuses %j, which the platform does not know as a zone", (id) => {
    expect(Option.isNone(namedTimeZone(id))).toBe(true);
  });
});
