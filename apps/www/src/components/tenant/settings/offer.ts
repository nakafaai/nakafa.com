import { OwnerRole } from "@repo/backend/confect/access/schema";
import { Array as Arr, Schema } from "effect";

/**
 * Whether a Person who holds these roles can take a login card. An Owner or an Admin cannot:
 * a card hands the Person's grants to whoever redeems it, so the server refuses to issue one
 * to either (ADR 0009). The invitations offer a card only where the server would issue it.
 */
export const cardOffered = (roles: readonly string[]) =>
  !Arr.some(roles, Schema.is(OwnerRole));
