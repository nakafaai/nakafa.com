import { describe, expect, it } from "@effect/vitest";
import {
  getUserSettingsSection,
  isUserSettingsPath,
  userSettingsSections,
} from "@/lib/settings/routes";

describe("user settings routes", () => {
  it("declares the account and billing sections in sidebar order", () => {
    expect(
      userSettingsSections.map((section) => [section.href, section.labelKey])
    ).toEqual([
      ["/user/settings", "account"],
      ["/user/settings/subscriptions", "billing"],
    ]);
  });

  it("resolves each declared settings path to its own section", () => {
    expect(
      getUserSettingsSection("/user/settings/subscriptions").labelKey
    ).toBe("billing");
    expect(getUserSettingsSection("/user/settings").labelKey).toBe("account");
  });

  it("keeps the settings root as the owner of any undeclared settings path", () => {
    expect(getUserSettingsSection("/user/settings/unknown").labelKey).toBe(
      "account"
    );
  });

  it("recognizes only the settings surface as a settings path", () => {
    expect(isUserSettingsPath("/user/settings")).toBe(true);
    expect(isUserSettingsPath("/user/settings/subscriptions")).toBe(true);
    expect(isUserSettingsPath("/user/507f1f77bcf86cd799439011")).toBe(false);
    expect(isUserSettingsPath("/user/settings-archive")).toBe(false);
  });
});
