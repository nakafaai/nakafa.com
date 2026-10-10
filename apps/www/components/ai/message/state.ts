import type { Invocation } from "@/components/ai/message/invocation";

/**
 * The states a learner should read as a problem. It has its own module, apart
 * from `readInvocation`, so a page that only renders activity rows never loads
 * the capability schemas in the browser.
 */
export function isProblem(state: Invocation["state"]) {
  return state === "denied" || state === "failed" || state === "limit";
}
