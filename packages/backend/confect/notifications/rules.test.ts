import { describe, expect, it } from "@effect/vitest";
import {
  canSwitchOff,
  NOTICE_RULES,
  NoticeRules,
  Timing,
} from "@repo/backend/confect/notifications/rules";
import { Exit, Schema } from "effect";

describe("notifications/rules channel table", () => {
  it("keeps every row of the table valid under its Schema", () => {
    const decoded = Schema.decodeExit(NoticeRules)(NOTICE_RULES);
    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("refuses a kind with two routes for one relation, so no route is silently ignored", () => {
    const invitation = NOTICE_RULES.invitation;
    const decoded = Schema.decodeExit(NoticeRules)({
      ...NOTICE_RULES,
      invitation: {
        ...invitation,
        routes: [...invitation.routes, ...invitation.routes],
      },
    });
    expect(Exit.isFailure(decoded)).toBe(true);
  });

  it("refuses a Chosen time in the inbox or push, because only email depends on the poster's choice", () => {
    const inboxChosen = Schema.decodeExit(NoticeRules)({
      ...NOTICE_RULES,
      classAnnouncement: {
        routes: [
          {
            relation: "student",
            inbox: [{ _tag: "Chosen" }],
            push: [{ _tag: "Now" }],
          },
        ],
      },
    });
    const pushChosen = Schema.decodeExit(NoticeRules)({
      ...NOTICE_RULES,
      classAnnouncement: {
        routes: [
          {
            relation: "student",
            inbox: [{ _tag: "Now" }],
            push: [{ _tag: "Chosen" }],
          },
        ],
      },
    });
    expect(Exit.isFailure(inboxChosen)).toBe(true);
    expect(Exit.isFailure(pushChosen)).toBe(true);
  });
});

describe("notifications/rules Timing", () => {
  it("rejects a reminder sent a negative number of minutes before its anchor", () => {
    const decoded = Schema.decodeExit(Timing)({ _tag: "Before", minutes: -15 });
    expect(Exit.isFailure(decoded)).toBe(true);
  });

  it("accepts a reminder sent at its anchor, zero minutes before", () => {
    const decoded = Schema.decodeExit(Timing)({ _tag: "Before", minutes: 0 });
    expect(Exit.isSuccess(decoded)).toBe(true);
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
