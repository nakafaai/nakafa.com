import { describe, expect, it } from "@effect/vitest";
import {
  canSwitchOff,
  deliveryInstant,
  Relation,
  recipientsOf,
  type Timing,
} from "@repo/backend/confect/notifications/rules";
import { Array as Arr, DateTime, Schema } from "effect";

const jakarta = Schema.decodeSync(Schema.TimeZoneNamedFromString)(
  "Asia/Jakarta"
);
const berlin = Schema.decodeSync(Schema.TimeZoneNamedFromString)(
  "Europe/Berlin"
);

/** A wall-clock time read on the clock of a zone, as the anchor of a notice. */
const anchorAt = (text: string, zone: DateTime.TimeZone.Named) =>
  DateTime.toUtc(
    DateTime.makeZonedUnsafe(text, { timeZone: zone, adjustForTimeZone: true })
  );

/** A delivery instant written on the clock of its zone, with its offset and zone name. */
const show = (instant: DateTime.Utc, zone: DateTime.TimeZone.Named) =>
  DateTime.formatIsoZoned(DateTime.setZone(instant, zone));

const NOW: typeof Timing.Type = { _tag: "Now" };
const CHOSEN: typeof Timing.Type = { _tag: "Chosen" };
const DIGEST: typeof Timing.Type = { _tag: "Digest" };
const ONE_HOUR_BEFORE: typeof Timing.Type = { _tag: "Before", minutes: 60 };
const FIFTEEN_MINUTES_BEFORE: typeof Timing.Type = {
  _tag: "Before",
  minutes: 15,
};
const DAY_BEFORE_AT_16: typeof Timing.Type = {
  _tag: "Clock",
  dayOffset: -1,
  hour: 16,
  minute: 0,
};
const EXAM_DAY_AT_0630: typeof Timing.Type = {
  _tag: "Clock",
  dayOffset: 0,
  hour: 6,
  minute: 30,
};

const Member = Schema.Struct({ name: Schema.String, relation: Relation });

const members: readonly (typeof Member.Type)[] = [
  { name: "Ayu", relation: "student" },
  { name: "Budi", relation: "guardian" },
  { name: "Citra", relation: "teacher" },
];

const namesOf = (people: readonly (typeof Member.Type)[]) =>
  Arr.map(people, (person) => person.name);

describe("notifications/rules recipientsOf", () => {
  it("sends a forum mention to the student or teacher it names, never to a guardian", () => {
    expect(namesOf(recipientsOf("forumMention", members))).toEqual([
      "Ayu",
      "Citra",
    ]);
  });

  it("sends a late task only to the guardian of the student", () => {
    expect(namesOf(recipientsOf("taskMissed", members))).toEqual(["Budi"]);
  });

  it("sends a released grade to the student and the guardian, not to the teacher", () => {
    expect(namesOf(recipientsOf("gradeReleased", members))).toEqual([
      "Ayu",
      "Budi",
    ]);
  });

  it("sends an invitation to the Person it names and to no one else", () => {
    const invitee: readonly (typeof Member.Type)[] = [
      { name: "Dewi", relation: "invitee" },
      { name: "Eka", relation: "student" },
    ];
    expect(namesOf(recipientsOf("invitation", invitee))).toEqual(["Dewi"]);
  });
});

describe("notifications/rules canSwitchOff", () => {
  it("keeps the invitation email on, and never switches the inbox off", () => {
    expect(canSwitchOff("invitation", "email")).toBe(false);
    expect(canSwitchOff("invitation", "inbox")).toBe(false);
    expect(canSwitchOff("forumMention", "inbox")).toBe(false);
  });

  it("lets a person switch off the push and the email of the other kinds", () => {
    expect(canSwitchOff("forumMention", "push")).toBe(true);
    expect(canSwitchOff("forumMention", "email")).toBe(true);
    expect(canSwitchOff("gradeReleased", "email")).toBe(true);
    expect(canSwitchOff("examStart", "push")).toBe(true);
  });
});

describe("notifications/rules deliveryInstant", () => {
  it("sends a deadline reminder at 16:00 the day before, when the deadline is just after midnight", () => {
    const deadline = anchorAt("2026-10-15T00:30:00.000", jakarta);
    expect(
      show(deliveryInstant(DAY_BEFORE_AT_16, deadline, jakarta), jakarta)
    ).toBe("2026-10-14T16:00:00.000+07:00[Asia/Jakarta]");
  });

  it("sends the hour-before reminder one hour of elapsed time before the deadline", () => {
    const deadline = anchorAt("2026-10-15T00:30:00.000", jakarta);
    expect(
      show(deliveryInstant(ONE_HOUR_BEFORE, deadline, jakarta), jakarta)
    ).toBe("2026-10-14T23:30:00.000+07:00[Asia/Jakarta]");
  });

  it("reads the day before on the calendar of Berlin, a 23-hour day after the spring change", () => {
    const deadline = anchorAt("2026-03-30T00:30:00.000", berlin);
    expect(
      show(deliveryInstant(DAY_BEFORE_AT_16, deadline, berlin), berlin)
    ).toBe("2026-03-29T16:00:00.000+02:00[Europe/Berlin]");
  });

  it("keeps the 16:00 reminder on the Berlin clock across the autumn change", () => {
    const deadline = anchorAt("2026-10-26T10:00:00.000", berlin);
    expect(
      show(deliveryInstant(DAY_BEFORE_AT_16, deadline, berlin), berlin)
    ).toBe("2026-10-25T16:00:00.000+01:00[Europe/Berlin]");
  });

  it("subtracts elapsed time for the hour-before reminder across the autumn change", () => {
    const deadline = anchorAt("2026-10-25T03:30:00.000", berlin);
    expect(
      show(deliveryInstant(ONE_HOUR_BEFORE, deadline, berlin), berlin)
    ).toBe("2026-10-25T02:30:00.000+01:00[Europe/Berlin]");
  });

  it("sends an exam start fifteen minutes before the sitting opens, in Jakarta", () => {
    const opens = anchorAt("2026-10-15T07:00:00.000", jakarta);
    expect(
      show(deliveryInstant(FIFTEEN_MINUTES_BEFORE, opens, jakarta), jakarta)
    ).toBe("2026-10-15T06:45:00.000+07:00[Asia/Jakarta]");
  });

  it("sends the guardian's exam reminder at 06:30 on the day of the exam, in Jakarta and Berlin", () => {
    const jakartaOpens = anchorAt("2026-10-15T07:00:00.000", jakarta);
    const berlinOpens = anchorAt("2026-10-26T08:00:00.000", berlin);
    expect(
      show(deliveryInstant(EXAM_DAY_AT_0630, jakartaOpens, jakarta), jakarta)
    ).toBe("2026-10-15T06:30:00.000+07:00[Asia/Jakarta]");
    expect(
      show(deliveryInstant(EXAM_DAY_AT_0630, berlinOpens, berlin), berlin)
    ).toBe("2026-10-26T06:30:00.000+01:00[Europe/Berlin]");
  });

  it("sends a digest at the 17:00 of the next day when the notice comes after 17:00", () => {
    const notice = anchorAt("2026-10-25T18:00:00.000", berlin);
    expect(show(deliveryInstant(DIGEST, notice, berlin), berlin)).toBe(
      "2026-10-26T17:00:00.000+01:00[Europe/Berlin]"
    );
  });

  it("sends now, or when the poster chose email, at the moment of the change", () => {
    const change = anchorAt("2026-10-14T09:15:00.000", jakarta);
    expect(show(deliveryInstant(NOW, change, jakarta), jakarta)).toBe(
      "2026-10-14T09:15:00.000+07:00[Asia/Jakarta]"
    );
    expect(show(deliveryInstant(CHOSEN, change, jakarta), jakarta)).toBe(
      "2026-10-14T09:15:00.000+07:00[Asia/Jakarta]"
    );
  });
});
