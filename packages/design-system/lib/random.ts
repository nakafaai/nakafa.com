/**
 * Deterministic Pseudo-Random Number Generator (PRNG) using Linear Congruential Generator
 *
 * This implementation provides deterministic randomness that produces the same sequence
 * for the same seed, avoiding hydration mismatches in SSR applications.
 *
 * Based on the LCG algorithm: X = (a * X + c) % m
 * Using constants from Numerical Recipes for good quality randomness.
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647; // Ensure seed is within valid range
    if (this.seed <= 0) {
      this.seed += 2147483646;
    }
  }

  /**
   * Generate the next random number in the sequence
   * @returns A pseudo-random number between 0 and 1
   */
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /**
   * Generate a random float within a specified range
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (exclusive)
   * @returns A pseudo-random float between min and max
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Generate a random integer within a specified range
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (exclusive)
   * @returns A pseudo-random integer between min and max
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Generate a random boolean value
   * @param probability - Probability of returning true (0-1), defaults to 0.5
   * @returns A pseudo-random boolean
   */
  nextBoolean(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm with deterministic randomness
   * @param array - The array to shuffle
   * @returns A new shuffled array (does not modify the original)
   */
  shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Pick a random element from an array
   * @param array - The array to pick from
   * @returns A random element from the array, or undefined if array is empty
   */
  choice<T>(array: T[]): T | undefined {
    if (array.length === 0) {
      return undefined;
    }
    return array[this.nextInt(0, array.length)];
  }
}

/**
 * Create a deterministic seed from multiple inputs
 * @param inputs - Array of numbers or strings to create seed from
 * @returns A deterministic seed number
 */
export function createSeed(...inputs: (string | number)[]): number {
  let seed = 0;
  for (const input of inputs) {
    if (typeof input === "number") {
      seed += input;
    } else {
      // Convert string to number using character codes
      seed += Array.from(input).reduce(
        (acc, char) => acc + char.charCodeAt(0),
        0
      );
    }
  }
  return Math.abs(seed) % 2147483647;
}

/**
 * Create a seeded random number generator from component props
 * @param inputs - Component props or identifiers to create seed from
 * @returns A SeededRandom instance
 */
export function createSeededRandom(
  ...inputs: (string | number)[]
): SeededRandom {
  return new SeededRandom(createSeed(...inputs));
}
