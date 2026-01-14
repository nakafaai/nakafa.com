import { describe, expect, it } from "vitest";

const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;

describe("Environment Variables", () => {
  describe("INTERNAL_CONTENT_API_KEY", () => {
    const apiKey = process.env.INTERNAL_CONTENT_API_KEY;

    it("should be defined", () => {
      expect(apiKey).toBeDefined();
      expect(apiKey).toBeTruthy();
    });

    it("should be base64url encoded (alphanumeric + hyphen + underscore)", () => {
      expect(apiKey).toMatch(BASE64URL_REGEX);
    });

    it("should be at least 32 characters", () => {
      expect(apiKey?.length).toBeGreaterThanOrEqual(32);
    });

    it("should contain uppercase letters", () => {
      expect(apiKey).toMatch(UPPERCASE_REGEX);
    });

    it("should contain lowercase letters", () => {
      expect(apiKey).toMatch(LOWERCASE_REGEX);
    });

    it("should contain numbers", () => {
      expect(apiKey).toMatch(NUMBER_REGEX);
    });

    it("should not be empty", () => {
      expect(apiKey?.length).toBeGreaterThan(0);
    });
  });
});
