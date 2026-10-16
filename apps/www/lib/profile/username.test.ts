import { describe, expect, it } from "@effect/vitest";
import type { UsernameCheck } from "@repo/backend/confect/users/username";
import { usernameReply } from "@/lib/profile/username";

describe("username reply", () => {
  it("says nothing and cannot save while the check for the typed text still runs", () => {
    expect(
      usernameReply({
        asked: "ari",
        check: undefined,
        current: "nabil",
        typed: "ari",
      })
    ).toEqual({ canSave: false, message: undefined });
  });

  it("does not show an answer that was asked for older text", () => {
    expect(
      usernameReply({
        asked: "ar",
        check: "available",
        current: "nabil",
        typed: "ari",
      })
    ).toEqual({ canSave: false, message: undefined });
  });

  it("says the name is available, and lets the account save it", () => {
    expect(
      usernameReply({
        asked: "ari",
        check: "available",
        current: "nabil",
        typed: "ari",
      })
    ).toEqual({ canSave: true, message: "username-available" });
  });

  it("gives the sentence of every refusal, and does not let the account save", () => {
    const refusals: ReadonlyArray<
      readonly [typeof UsernameCheck.Type, string]
    > = [
      ["taken", "username-taken"],
      ["tooShort", "username-too-short"],
      ["letterFirst", "username-letter-first"],
      ["characters", "username-characters"],
      ["notAllowed", "username-not-allowed"],
    ];
    for (const [check, message] of refusals) {
      expect(
        usernameReply({ asked: "ari", check, current: "nabil", typed: "ari" })
      ).toEqual({ canSave: false, message });
    }
  });

  it("says nothing for the account's own name in other capitals, because nothing would change", () => {
    expect(
      usernameReply({
        asked: "NabilFatih",
        check: "available",
        current: "nabilfatih",
        typed: "NabilFatih",
      })
    ).toEqual({ canSave: false, message: undefined });
  });

  it("says nothing for the account's own name with spaces around it", () => {
    expect(
      usernameReply({
        asked: " nabilfatih ",
        check: "available",
        current: "nabilfatih",
        typed: " nabilfatih ",
      })
    ).toEqual({ canSave: false, message: undefined });
  });
});
