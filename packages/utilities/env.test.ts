import { describe, expect, it } from "@effect/vitest";
import { InvalidEnvironmentError } from "@repo/utilities/env";

describe("InvalidEnvironmentError", () => {
  it("keeps the invalid environment phrase and the failure details", () => {
    const error = new InvalidEnvironmentError({
      details: 'SchemaError(Expected string at ["SITE_URL"])',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      'Invalid environment variables: SchemaError(Expected string at ["SITE_URL"])'
    );
  });
});
