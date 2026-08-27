import { describe, expect, it } from "@effect/vitest";
import { CliError } from "effect/unstable/cli";
import { makeInvocationError } from "#cli/error";

describe("Nakafa CLI error mapping", () => {
  it("preserves parser details from help failures", () => {
    const source = new CliError.ShowHelp({
      commandPath: ["nakafa"],
      errors: [
        new CliError.UnknownSubcommand({
          parent: ["nakafa"],
          subcommand: "unknown",
          suggestions: [],
        }),
      ],
    });

    expect(makeInvocationError(source)).toMatchObject({
      _tag: "InvocationError",
      message: expect.stringContaining("unknown"),
    });
  });

  it("preserves direct native CLI error messages", () => {
    const source = new CliError.UnrecognizedOption({
      command: ["nakafa"],
      option: "--unknown",
      suggestions: [],
    });

    expect(makeInvocationError(source).message).toBe(source.message);
  });
});
