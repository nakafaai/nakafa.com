import { describe, expect, it } from "@effect/vitest";
import {
  digestInstant,
  quietHoursEnd,
} from "@repo/backend/confect/notifications/clock";
import { DateTime, Option, Schema } from "effect";

const jakarta = Schema.decodeSync(Schema.TimeZoneNamedFromString)(
  "Asia/Jakarta"
);
const berlin = Schema.decodeSync(Schema.TimeZoneNamedFromString)(
  "Europe/Berlin"
);

/** A wall-clock time read on the clock of a zone. */
const local = (text: string, zone: DateTime.TimeZone.Named) =>
  DateTime.makeZonedUnsafe(text, { timeZone: zone, adjustForTimeZone: true });

/** An instant written on the clock of a zone, with its offset and zone name. */
const show = (instant: DateTime.Utc, zone: DateTime.TimeZone.Named) =>
  DateTime.formatIsoZoned(DateTime.setZone(instant, zone));

/** When quiet hours end for a local time, on the clock of its zone, or null outside them. */
const quietEndOn = (text: string, zone: DateTime.TimeZone.Named) =>
  Option.getOrNull(
    Option.map(quietHoursEnd(local(text, zone), zone), (end) => show(end, zone))
  );

/** The 17:00 digest for a local time, written on the clock of its zone. */
const digestOn = (text: string, zone: DateTime.TimeZone.Named) =>
  show(digestInstant(local(text, zone), zone), zone);

describe("notifications/clock quietHoursEnd", () => {
  it("holds Jakarta from 21:00 and ends at 06:00 the next morning", () => {
    expect(quietEndOn("2026-10-14T20:59:59.999", jakarta)).toBeNull();
    expect(quietEndOn("2026-10-14T21:00:00.000", jakarta)).toBe(
      "2026-10-15T06:00:00.000+07:00[Asia/Jakarta]"
    );
    expect(quietEndOn("2026-10-15T05:59:59.999", jakarta)).toBe(
      "2026-10-15T06:00:00.000+07:00[Asia/Jakarta]"
    );
    expect(quietEndOn("2026-10-15T06:00:00.000", jakarta)).toBeNull();
  });

  it("counts midnight as inside quiet hours, ending at 06:00 that morning", () => {
    expect(quietEndOn("2026-10-15T00:00:00.000", jakarta)).toBe(
      "2026-10-15T06:00:00.000+07:00[Asia/Jakarta]"
    );
  });

  it("ends the night across the autumn change in Berlin at 06:00 on the clock", () => {
    expect(quietEndOn("2026-10-24T21:00:00.000", berlin)).toBe(
      "2026-10-25T06:00:00.000+01:00[Europe/Berlin]"
    );
    expect(quietEndOn("2026-10-25T05:59:59.999", berlin)).toBe(
      "2026-10-25T06:00:00.000+01:00[Europe/Berlin]"
    );
  });

  it("ends the night across the spring change in Berlin at 06:00 on the clock", () => {
    expect(quietEndOn("2026-03-28T21:00:00.000", berlin)).toBe(
      "2026-03-29T06:00:00.000+02:00[Europe/Berlin]"
    );
    expect(quietEndOn("2026-03-28T20:59:59.999", berlin)).toBeNull();
  });
});

describe("notifications/clock digestInstant", () => {
  it("sends the same day's digest before 17:00, in Jakarta", () => {
    expect(digestOn("2026-10-14T16:59:59.999", jakarta)).toBe(
      "2026-10-14T17:00:00.000+07:00[Asia/Jakarta]"
    );
  });

  it("sends the next day's digest from 17:00 on, in Jakarta", () => {
    expect(digestOn("2026-10-14T17:00:00.000", jakarta)).toBe(
      "2026-10-15T17:00:00.000+07:00[Asia/Jakarta]"
    );
  });

  it("reads midnight as the start of the day whose digest it carries", () => {
    expect(digestOn("2026-10-15T00:00:00.000", jakarta)).toBe(
      "2026-10-15T17:00:00.000+07:00[Asia/Jakarta]"
    );
  });

  it("keeps 17:00 on the clock on the day the Berlin offset changes", () => {
    expect(digestOn("2026-10-25T16:59:59.999", berlin)).toBe(
      "2026-10-25T17:00:00.000+01:00[Europe/Berlin]"
    );
    expect(digestOn("2026-10-25T17:00:00.000", berlin)).toBe(
      "2026-10-26T17:00:00.000+01:00[Europe/Berlin]"
    );
  });
});
