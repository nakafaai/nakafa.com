import type { Id } from "@repo/backend/convex/_generated/dataModel";

export type TryoutDataIntent =
  | {
      attemptId: Id<"tryoutAttempts">;
      kind: "set";
    }
  | {
      attemptId: Id<"tryoutAttempts">;
      kind: "section";
      sectionKey: string;
    };

type TryoutDataIntentIdentity =
  | { attemptId: string; kind: "set" }
  | { attemptId: string; kind: "section"; sectionKey: string };

export const TRYOUT_QUERY_LEASE_MS = 5000;

/** Identifies one exact query lease without depending on route aliases. */
export function getTryoutDataIntentKey(intent: TryoutDataIntentIdentity) {
  if (intent.kind === "set") {
    return `set:${intent.attemptId}`;
  }

  return `section:${intent.attemptId}:${intent.sectionKey}`;
}

/** Reports whether an intent query is still covered by its short lease. */
export function isTryoutQueryLeaseActive(
  expiresAt: number | undefined,
  now: number
) {
  return expiresAt !== undefined && now < expiresAt;
}
