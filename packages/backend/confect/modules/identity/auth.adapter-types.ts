import type { RegisteredMutation } from "convex/server";
import type { Value } from "convex/values";

interface BetterAuthDocument {
  readonly [key: string]: undefined | Value;
}

export type BetterAuthCreateTrigger = RegisteredMutation<
  "internal",
  {
    readonly doc: BetterAuthDocument;
    readonly model: string;
  },
  null
>;

export type BetterAuthDeleteTrigger = RegisteredMutation<
  "internal",
  {
    readonly doc: BetterAuthDocument;
    readonly model: string;
  },
  null
>;

export type BetterAuthUpdateTrigger = RegisteredMutation<
  "internal",
  {
    readonly model: string;
    readonly newDoc: BetterAuthDocument;
    readonly oldDoc: BetterAuthDocument;
  },
  null
>;
