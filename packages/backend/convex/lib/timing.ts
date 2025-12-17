/**
 * Simple timing utility for Convex functions.
 *
 * Uses console.time/timeEnd which Convex provides for accurate timing.
 * Note: Date.now() is frozen in Convex's default runtime for determinism.
 *
 * @see https://docs.convex.dev/functions/debugging
 */

/**
 * Measure multiple steps in a function using console.time/timeEnd.
 * Usage:
 *   const timer = createStepTimer("myFunction");
 *   await doStep1();
 *   timer.step("step1");  // logs time since last step (or start)
 *   await doStep2();
 *   timer.step("step2");
 *   timer.total();        // logs total time
 */
export function createStepTimer(prefix: string) {
  const totalLabel = `⏱ [${prefix}] TOTAL`;
  let stepCount = 0;

  // Start total timer
  console.time(totalLabel);
  // Start first step timer
  console.time(`⏱ [${prefix}] step_${stepCount}`);

  return {
    step: (name: string) => {
      // End current step timer
      console.timeEnd(`⏱ [${prefix}] step_${stepCount}`);
      console.info(`⏱ [${prefix}] ^ ${name}`);
      stepCount += 1;
      // Start next step timer
      console.time(`⏱ [${prefix}] step_${stepCount}`);
    },
    total: () => {
      console.timeEnd(totalLabel);
    },
  };
}

/**
 * Start timing for a specific label.
 * Call returned function to log duration.
 */
export function startTimer(label: string) {
  console.time(label);
  return () => console.timeEnd(label);
}

/**
 * Measure and log the duration of an async operation.
 */
export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  console.time(label);
  try {
    const result = await fn();
    console.timeEnd(label);
    return result;
  } catch (error) {
    console.timeEnd(label);
    throw error;
  }
}
