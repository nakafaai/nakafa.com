import { describe, expect, it } from "@effect/vitest";
import {
  deliveriesOf,
  deliveryInstant,
} from "@repo/backend/confect/notifications/delivery";
import type {
  NoticeKind,
  Relation,
} from "@repo/backend/confect/notifications/rules";
import { Array as Arr, DateTime, Schema } from "effect";

const jakarta = Schema.decodeSync(Schema.TimeZoneNamedFromString)(
  "Asia/Jakarta"
);
const makassar = Schema.decodeSync(Schema.TimeZoneNamedFromString)(
  "Asia/Makassar"
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

/**
 * The sends of one notice to one relation, each written as its channel and the
 * instant it is due on the clock of `zone`, in the order of the channel table.
 */
const sendsOf = (
  kind: typeof NoticeKind.Type,
  relation: typeof Relation.Type,
  anchor: DateTime.Utc,
  zone: DateTime.TimeZone.Named,
  emailChosen = false
) =>
  Arr.map(
    deliveriesOf(kind, relation, emailChosen),
    (send) =>
      `${send.channel} ${show(deliveryInstant(anchor, send.timing, zone), zone)}`
  );

describe("notifications/delivery deliveriesOf", () => {
  it("sends a mention at once in the inbox and push, and by email in the digest of the same day", () => {
    const mention = anchorAt("2026-10-14T09:15:00.000", jakarta);
    expect(sendsOf("forumMention", "student", mention, jakarta)).toEqual([
      "inbox 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "push 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "email 2026-10-14T17:00:00.000+07:00[Asia/Jakarta]",
    ]);
  });

  it("sends a mention after 17:00 by email in the digest of the next day, on the Berlin clock", () => {
    const mention = anchorAt("2026-10-25T18:00:00.000", berlin);
    expect(sendsOf("forumMention", "teacher", mention, berlin)).toEqual([
      "inbox 2026-10-25T18:00:00.000+01:00[Europe/Berlin]",
      "push 2026-10-25T18:00:00.000+01:00[Europe/Berlin]",
      "email 2026-10-26T17:00:00.000+01:00[Europe/Berlin]",
    ]);
  });

  it("sends an announcement by email only when the poster chose email for it", () => {
    const announcement = anchorAt("2026-10-14T09:15:00.000", jakarta);
    expect(
      sendsOf("classAnnouncement", "student", announcement, jakarta)
    ).toEqual([
      "inbox 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "push 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
    ]);
    expect(
      sendsOf("classAnnouncement", "student", announcement, jakarta, true)
    ).toEqual([
      "inbox 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "push 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "email 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
    ]);
  });

  it("sends a new task at once in the inbox and push, and by email in the daily digest", () => {
    const published = anchorAt("2026-10-14T09:15:00.000", jakarta);
    expect(sendsOf("taskPublished", "student", published, jakarta)).toEqual([
      "inbox 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "push 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "email 2026-10-14T17:00:00.000+07:00[Asia/Jakarta]",
    ]);
  });

  it("sends a deadline reminder to the student at 16:00 the day before and one hour before, in the inbox and push, never by email", () => {
    const deadline = anchorAt("2026-10-15T00:30:00.000", jakarta);
    expect(sendsOf("taskDeadline", "student", deadline, jakarta)).toEqual([
      "inbox 2026-10-14T16:00:00.000+07:00[Asia/Jakarta]",
      "inbox 2026-10-14T23:30:00.000+07:00[Asia/Jakarta]",
      "push 2026-10-14T16:00:00.000+07:00[Asia/Jakarta]",
      "push 2026-10-14T23:30:00.000+07:00[Asia/Jakarta]",
    ]);
  });

  it("sends no deadline reminder to a guardian, because the deadline row names the student only", () => {
    const deadline = anchorAt("2026-10-15T00:30:00.000", jakarta);
    expect(sendsOf("taskDeadline", "guardian", deadline, jakarta)).toEqual([]);
  });

  it("reads the day before on the Berlin calendar across the spring change", () => {
    const deadline = anchorAt("2026-03-30T00:30:00.000", berlin);
    expect(sendsOf("taskDeadline", "student", deadline, berlin)).toEqual([
      "inbox 2026-03-29T16:00:00.000+02:00[Europe/Berlin]",
      "inbox 2026-03-29T23:30:00.000+02:00[Europe/Berlin]",
      "push 2026-03-29T16:00:00.000+02:00[Europe/Berlin]",
      "push 2026-03-29T23:30:00.000+02:00[Europe/Berlin]",
    ]);
  });

  it("keeps the 16:00 reminder on the Berlin clock across the autumn change, and subtracts elapsed time for the hour before", () => {
    const deadline = anchorAt("2026-10-25T03:30:00.000", berlin);
    expect(sendsOf("taskDeadline", "student", deadline, berlin)).toEqual([
      "inbox 2026-10-24T16:00:00.000+02:00[Europe/Berlin]",
      "inbox 2026-10-25T02:30:00.000+01:00[Europe/Berlin]",
      "push 2026-10-24T16:00:00.000+02:00[Europe/Berlin]",
      "push 2026-10-25T02:30:00.000+01:00[Europe/Berlin]",
    ]);
  });

  it("sends an exam start fifteen minutes before the sitting opens, in the inbox, push and email", () => {
    const opens = anchorAt("2026-10-15T07:00:00.000", jakarta);
    expect(sendsOf("examStart", "student", opens, jakarta)).toEqual([
      "inbox 2026-10-15T06:45:00.000+07:00[Asia/Jakarta]",
      "push 2026-10-15T06:45:00.000+07:00[Asia/Jakarta]",
      "email 2026-10-15T06:45:00.000+07:00[Asia/Jakarta]",
    ]);
  });

  it("sends a guardian's exam reminder at 06:30 on the day of the exam, in the inbox and by email, never by push", () => {
    const opens = anchorAt("2026-10-15T07:00:00.000", jakarta);
    expect(sendsOf("examGuardianReminder", "guardian", opens, jakarta)).toEqual(
      [
        "inbox 2026-10-15T06:30:00.000+07:00[Asia/Jakarta]",
        "email 2026-10-15T06:30:00.000+07:00[Asia/Jakarta]",
      ]
    );
  });

  it("sends a guardian's exam reminder at 06:30 on the Berlin clock of the exam day", () => {
    const opens = anchorAt("2026-10-26T08:00:00.000", berlin);
    expect(sendsOf("examGuardianReminder", "guardian", opens, berlin)).toEqual([
      "inbox 2026-10-26T06:30:00.000+01:00[Europe/Berlin]",
      "email 2026-10-26T06:30:00.000+01:00[Europe/Berlin]",
    ]);
  });

  it("sends a guardian's exam reminder 30 minutes before a sitting that opens at 06:00, because that is earlier than 06:30", () => {
    const opens = anchorAt("2026-10-15T06:00:00.000", jakarta);
    expect(sendsOf("examGuardianReminder", "guardian", opens, jakarta)).toEqual(
      [
        "inbox 2026-10-15T05:30:00.000+07:00[Asia/Jakarta]",
        "email 2026-10-15T05:30:00.000+07:00[Asia/Jakarta]",
      ]
    );
  });

  it("keeps 06:30 for a sitting that opens at 07:30, because 06:30 is earlier than 30 minutes before it", () => {
    const opens = anchorAt("2026-10-15T07:30:00.000", jakarta);
    expect(sendsOf("examGuardianReminder", "guardian", opens, jakarta)).toEqual(
      [
        "inbox 2026-10-15T06:30:00.000+07:00[Asia/Jakarta]",
        "email 2026-10-15T06:30:00.000+07:00[Asia/Jakarta]",
      ]
    );
  });

  it("sends a guardian's exam reminder 30 minutes before a sitting that opens at 06:45, at 06:15", () => {
    const opens = anchorAt("2026-10-15T06:45:00.000", jakarta);
    expect(sendsOf("examGuardianReminder", "guardian", opens, jakarta)).toEqual(
      [
        "inbox 2026-10-15T06:15:00.000+07:00[Asia/Jakarta]",
        "email 2026-10-15T06:15:00.000+07:00[Asia/Jakarta]",
      ]
    );
  });

  it("sends a released grade at once to the student in the inbox and push, and never by email", () => {
    const released = anchorAt("2026-10-14T09:15:00.000", jakarta);
    expect(sendsOf("gradeReleased", "student", released, jakarta)).toEqual([
      "inbox 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "push 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
    ]);
  });

  it("sends a released grade at once to the guardian in the inbox, push and email", () => {
    const released = anchorAt("2026-10-14T09:15:00.000", jakarta);
    expect(sendsOf("gradeReleased", "guardian", released, jakarta)).toEqual([
      "inbox 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "push 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "email 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
    ]);
  });

  it("sends a late task at once to the guardian in the inbox, push and email", () => {
    const missed = anchorAt("2026-10-14T09:15:00.000", jakarta);
    expect(sendsOf("taskMissed", "guardian", missed, jakarta)).toEqual([
      "inbox 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "push 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "email 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
    ]);
  });

  it("sends an invitation at once in the inbox and by email, and never by push", () => {
    const invited = anchorAt("2026-10-14T09:15:00.000", jakarta);
    expect(sendsOf("invitation", "invitee", invited, jakarta)).toEqual([
      "inbox 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
      "email 2026-10-14T09:15:00.000+07:00[Asia/Jakarta]",
    ]);
  });
});

describe("notifications/delivery deliveryInstant", () => {
  it("derives a reminder's instant from its anchor, its rule and the zone at send time, so a change of zone moves it", () => {
    const anchor = anchorAt("2026-10-15T00:30:00.000", jakarta);
    const [deadlineReminder] = deliveriesOf("taskDeadline", "student", false);
    expect(
      DateTime.formatIso(
        deliveryInstant(anchor, deadlineReminder.timing, jakarta)
      )
    ).toBe("2026-10-14T09:00:00.000Z");
    expect(
      DateTime.formatIso(
        deliveryInstant(anchor, deadlineReminder.timing, makassar)
      )
    ).toBe("2026-10-14T08:00:00.000Z");
  });
});
