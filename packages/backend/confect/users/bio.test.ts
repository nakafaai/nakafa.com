import { describe, expect, it } from "@effect/vitest";
import {
  BIO_MAX_LENGTH,
  BioTooLong,
  readBio,
} from "@repo/backend/confect/users/bio";
import { Result } from "effect";

describe("users/bio", () => {
  it.each([
    ["Belajar fisika sambil minum teh.", "Belajar fisika sambil minum teh."],
    ["  Satu kalimat.  ", "Satu kalimat."],
    [
      "Baris satu\nbaris dua\r\n\r\nbaris tiga",
      "Baris satu baris dua baris tiga",
    ],
    ["tab\tdan   spasi", "tab dan spasi"],
    ["", ""],
    [" \n\t ", ""],
    ["a".repeat(BIO_MAX_LENGTH), "a".repeat(BIO_MAX_LENGTH)],
  ])("reads %j as the bio %j", (input, bio) => {
    expect(readBio(input)).toEqual(Result.succeed(bio));
  });

  it("refuses a bio of more than the limit once white space is gone", () => {
    expect(readBio("a".repeat(BIO_MAX_LENGTH + 1))).toEqual(
      Result.fail(new BioTooLong())
    );
    expect(readBio(`  ${"a".repeat(BIO_MAX_LENGTH)}  `)).toEqual(
      Result.succeed("a".repeat(BIO_MAX_LENGTH))
    );
  });
});
