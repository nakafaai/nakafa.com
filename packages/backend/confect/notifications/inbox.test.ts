import { describe, expect, it } from "@effect/vitest";
import { invitedInboxSends } from "@repo/backend/confect/notifications/inbox";

describe("notifications/inbox invitedInboxSends", () => {
  it("gives an invitee exactly the inbox send of the rules, due at the change", () => {
    // A send on another channel, or no filter at all, would fail here: the
    // invitation's email send is also due at once, so only this check tells them apart.
    expect(invitedInboxSends).toEqual([
      { channel: "inbox", timing: { _tag: "Now" } },
    ]);
  });
});
