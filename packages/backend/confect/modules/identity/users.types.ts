import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";

/** Minimal user shape displayed in school/forum read models. */
export interface UserData {
  readonly _id: Id<"users">;
  readonly email: string;
  readonly image?: string | null;
  readonly name: string;
}

export type AppUserDoc = Doc<"users">;
