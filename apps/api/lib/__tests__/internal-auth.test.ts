import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "../internal-auth";

const KEY_LENGTH = 32;
const CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateRandomKey(length: number): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET[values[i] % CHARSET.length];
  }
  return result;
}

function generateDifferentKey(original: string): string {
  const chars = original.split("");
  const randomIndex = Math.floor(Math.random() * chars.length);
  const originalChar = chars[randomIndex];
  let newChar = originalChar;
  while (newChar === originalChar) {
    newChar = CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  chars[randomIndex] = newChar;
  return chars.join("");
}

const TEST_API_KEY = generateRandomKey(KEY_LENGTH);

describe("timingSafeEqual", () => {
  it("should return true for identical strings", () => {
    const program = timingSafeEqual(TEST_API_KEY, TEST_API_KEY);
    const result = Effect.runSync(program);

    expect(result).toBe(true);
  });

  it("should return false for different strings of same length", () => {
    const differentKey = generateDifferentKey(TEST_API_KEY);
    const program = timingSafeEqual(TEST_API_KEY, differentKey);
    const result = Effect.runSync(program);

    expect(result).toBe(false);
  });

  it("should return false for different length strings", () => {
    const shortKey = "short";
    const program = timingSafeEqual(TEST_API_KEY, shortKey);
    const result = Effect.runSync(program);

    expect(result).toBe(false);
  });

  it("should return false when multiple characters differ", () => {
    const key1 = generateRandomKey(KEY_LENGTH);
    const key2 = generateRandomKey(KEY_LENGTH);

    const program = timingSafeEqual(key1, key2);
    const result = Effect.runSync(program);

    expect(result).toBe(false);
  });

  it("should be constant time for all mismatches", () => {
    const key1 = TEST_API_KEY;
    const key2 = generateDifferentKey(TEST_API_KEY);

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

  it("should return false for undefined inputs", () => {
    expect(Effect.runSync(timingSafeEqual(undefined, TEST_API_KEY))).toBe(
      false
    );
    expect(Effect.runSync(timingSafeEqual(TEST_API_KEY, undefined))).toBe(
      false
    );
    expect(Effect.runSync(timingSafeEqual(undefined, undefined))).toBe(false);
  });
});
