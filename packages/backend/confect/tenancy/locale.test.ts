import { describe, expect, it } from "@effect/vitest";
import {
  Currency,
  NewCurrency,
  NewTimeZone,
  TimeZone,
} from "@repo/backend/confect/tenancy/locale";
import { Array as Arr, Schema } from "effect";

describe("tenancy/locale", () => {
  it("gives a school a currency that the platform lists", () => {
    const accepted = Arr.map(["IDR", "EUR", "SAR", "USD"], (code) =>
      Schema.is(NewCurrency)(code)
    );
    expect(accepted).toEqual([true, true, true, true]);
  });

  it("refuses a code that is no currency, however it is written", () => {
    const accepted = Arr.map(["IRD", "idr", "ID", "IDRR", ""], (code) =>
      Schema.is(NewCurrency)(code)
    );
    expect(accepted).toEqual([false, false, false, false, false]);
  });

  it("gives a school the IANA zone of any region", () => {
    const accepted = Arr.map(
      [
        "Asia/Jakarta",
        "Europe/Berlin",
        "Asia/Riyadh",
        "America/Argentina/Buenos_Aires",
        "UTC",
      ],
      (id) => Schema.is(NewTimeZone)(id)
    );
    expect(accepted).toEqual([true, true, true, true, true]);
  });

  it("gives a school the GMT names, which the platform keeps as zones", () => {
    const accepted = Arr.map(["GMT", "GMT0", "GMT+0", "GMT-0"], (id) =>
      Schema.is(NewTimeZone)(id)
    );
    expect(accepted).toEqual([true, true, true, true]);
  });

  it("refuses a fixed offset, an abbreviation, and a region that does not exist", () => {
    const accepted = Arr.map(
      [
        "+07:00",
        "+0700",
        "-07",
        "GMT+7",
        "WIB",
        "Mars/Base",
        "Asia/Nowhere",
        "",
      ],
      (id) => Schema.is(NewTimeZone)(id)
    );
    expect(accepted).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("keeps a stored value to the rules that never change", () => {
    expect(Schema.is(Currency)("XYZ")).toBe(true);
    expect(Schema.is(Currency)("xyz")).toBe(false);
    expect(Schema.is(TimeZone)("Asia/Jakarta")).toBe(true);
    expect(Schema.is(TimeZone)(" Asia/Jakarta")).toBe(false);
    expect(Schema.is(TimeZone)("")).toBe(false);
  });
});
