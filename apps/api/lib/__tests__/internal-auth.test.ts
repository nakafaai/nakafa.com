import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  createAuthLayer,
  requireInternalApiKey,
  timingSafeEqual,
} from "../internal-auth";

describe("requireInternalApiKey", () => {
  const TEST_API_KEY = "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3";
  const testLayer = createAuthLayer(TEST_API_KEY);
  describe("valid authentication", () => {
    it("should succeed with correct key", () => {
      const mockReq = new Request(
        "https://api.nakafa.com/contents/en/articles",
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      );

      const program = requireInternalApiKey(mockReq);
      const result = Effect.runSync(program.pipe(Effect.provide(testLayer)));

      expect(result).toEqual(undefined);
    });
  });

  describe("invalid authentication", () => {
    it("should reject missing Authorization header", () => {
      const mockReq = new Request(
        "https://api.nakafa.com/contents/en/articles"
      );

      const program = requireInternalApiKey(mockReq);
      const error = Effect.runSync(
        Effect.flip(program).pipe(Effect.provide(testLayer))
      );

      expect(error._tag).toBe("MissingAuthHeader");
      expect(error.status).toBe(401);
    });

    it("should reject malformed Authorization header", () => {
      const mockReq = new Request(
        "https://api.nakafa.com/contents/en/articles",
        {
          headers: {
            Authorization: "InvalidFormat",
          },
        }
      );

      const program = requireInternalApiKey(mockReq);
      const error = Effect.runSync(
        Effect.flip(program).pipe(Effect.provide(testLayer))
      );

      expect(error._tag).toBe("InvalidAuthFormat");
      expect(error.status).toBe(401);
    });

    it("should reject wrong format (no Bearer prefix)", () => {
      const mockReq = new Request(
        "https://api.nakafa.com/contents/en/articles",
        {
          headers: {
            Authorization: TEST_API_KEY,
          },
        }
      );

      const program = requireInternalApiKey(mockReq);
      const error = Effect.runSync(
        Effect.flip(program).pipe(Effect.provide(testLayer))
      );

      expect(error._tag).toBe("InvalidAuthFormat");
      expect(error.status).toBe(401);
    });

    it("should reject incorrect API key", () => {
      const mockReq = new Request(
        "https://api.nakafa.com/contents/en/articles",
        {
          headers: {
            Authorization: "Bearer wrong_key_value_here",
          },
        }
      );

      const program = requireInternalApiKey(mockReq);
      const error = Effect.runSync(
        Effect.flip(program).pipe(Effect.provide(testLayer))
      );

      expect(error._tag).toBe("InvalidApiKey");
      expect(error.status).toBe(401);
    });

    it("should reject incorrect API key with same length as valid key", () => {
      const mockReq = new Request(
        "https://api.nakafa.com/contents/en/articles",
        {
          headers: {
            Authorization:
              "Bearer b1C2d3E4f5G6h7H8i9J1k2L3m4N5o6P7q8R9s0T1v2w3",
          },
        }
      );

      const program = requireInternalApiKey(mockReq);
      const error = Effect.runSync(
        Effect.flip(program).pipe(Effect.provide(testLayer))
      );

      expect(error._tag).toBe("InvalidApiKey");
      expect(error.status).toBe(401);
    });
  });

  describe("edge cases", () => {
    it("should reject when internal key not configured", () => {
      const mockReq = new Request(
        "https://api.nakafa.com/contents/en/articles",
        {
          headers: {
            Authorization: "Bearer test",
          },
        }
      );

      const program = requireInternalApiKey(mockReq);
      const error = Effect.runSync(
        Effect.flip(program).pipe(Effect.provide(createAuthLayer(undefined)))
      );

      expect(error._tag).toBe("InternalKeyNotConfigured");
      expect(error.status).toBe(500);
    });

    it("should handle empty Authorization header value", () => {
      const mockReq = new Request(
        "https://api.nakafa.com/contents/en/articles",
        {
          headers: {
            Authorization: "",
          },
        }
      );

      const program = requireInternalApiKey(mockReq);
      const error = Effect.runSync(
        Effect.flip(program).pipe(Effect.provide(testLayer))
      );

      expect(error._tag).toBe("InvalidAuthFormat");
      expect(error.status).toBe(401);
    });

    it("should handle Bearer with empty key", () => {
      const mockReq = new Request(
        "https://api.nakafa.com/contents/en/articles",
        {
          headers: {
            Authorization: "Bearer ",
          },
        }
      );

      const program = requireInternalApiKey(mockReq);
      const error = Effect.runSync(
        Effect.flip(program).pipe(Effect.provide(testLayer))
      );

      expect(error._tag).toBe("InvalidApiKey");
      expect(error.status).toBe(401);
    });
  });

  describe("timingSafeEqual", () => {
    it("should return true for identical strings", () => {
      const program = timingSafeEqual(TEST_API_KEY, TEST_API_KEY);
      const result = Effect.runSync(program);

      expect(result).toBe(true);
    });

    it("should return false for different strings of same length", () => {
      const program = timingSafeEqual(
        TEST_API_KEY,
        "b1C2d3E4f5G6h7H8i9J1k2L3m4N5o6P7q8R9s0T1v2w3"
      );
      const result = Effect.runSync(program);

      expect(result).toBe(false);
    });

    it("should return false for different length strings", () => {
      const program = timingSafeEqual(TEST_API_KEY, "short");
      const result = Effect.runSync(program);

      expect(result).toBe(false);
    });

    it("should return false when multiple characters differ", () => {
      const key1 = "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3";
      const key2 = "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2wX";

      const program = timingSafeEqual(key1, key2);
      const result = Effect.runSync(program);

      expect(result).toBe(false);
    });

    it("should be constant time for all mismatches", () => {
      const key1 = TEST_API_KEY;
      const key2 = "b1C2d3E4f5G6h7H8i9J1k2L3m4N5o6P7q8R9s0T1v2w3";

      const program = timingSafeEqual(key1, key2);
      const times: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        Effect.runSync(program);
        times.push(performance.now() - start);
      }

      const variance = Math.max(...times) - Math.min(...times);

      expect(variance).toBeLessThan(5);
    });
  });
});
