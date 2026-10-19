// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { readAccountName } from "@/lib/tenant/frame";

describe("readAccountName", () => {
  it("names an outsider's page after the account's name", () => {
    expect(readAccountName("Ayu", "ayu.harapan")).toEqual(Option.some("Ayu"));
  });

  it("falls back to the username when the account has no name", () => {
    expect(readAccountName("", "ayu.harapan")).toEqual(
      Option.some("ayu.harapan")
    );
  });

  it("names no one when the account has neither a name nor a username", () => {
    expect(readAccountName("", undefined)).toEqual(Option.none());
  });
});
