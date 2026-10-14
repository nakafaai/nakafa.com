import { describe, expect, it } from "@effect/vitest";
import {
  readUsername,
  USERNAME_MAX_LENGTH,
} from "@repo/backend/confect/users/username";
import { Result } from "effect";

describe("users/username", () => {
  it.each([
    ["nabilfatih", "nabilfatih"],
    ["Nabil_Fatih", "nabil_fatih"],
    ["  Nakafa2026  ", "nakafa2026"],
    ["abc", "abc"],
    ["a_1", "a_1"],
    ["a".repeat(USERNAME_MAX_LENGTH), "a".repeat(USERNAME_MAX_LENGTH)],
    ["NABILFATIH_", "nabilfatih_"],
  ])("reads %j as the username %j", (input, username) => {
    expect(readUsername(input)).toEqual(Result.succeed(username));
  });

  it.each([
    ["", "tooShort"],
    ["   ", "tooShort"],
    ["a", "tooShort"],
    ["ab", "tooShort"],
    ["1abc", "letterFirst"],
    ["_abc", "letterFirst"],
    ["1", "letterFirst"],
    ["nabil fatih", "characters"],
    ["nabil.fatih", "characters"],
    ["profile.md", "characters"],
    ["nabil-fatih", "characters"],
    ["@nabilfatih", "characters"],
    ["wiśniewska", "characters"],
    ["田中さくら", "characters"],
    ["a.", "characters"],
    ["a".repeat(USERNAME_MAX_LENGTH + 1), "notAllowed"],
  ])("refuses %j because %s", (input, reason) => {
    expect(readUsername(input)).toEqual(Result.fail(reason));
  });
});
