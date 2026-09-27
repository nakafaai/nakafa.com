import {
  AccountUnavailableWire,
  AuthReadErrorWire,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import { failureWire } from "@repo/backend/confect/failure";
import { Schema } from "effect";

/** Tryout clients receive authentication failures as code/message objects. */
export const TryoutAuthFailure = Schema.Union([
  failureWire(SessionRequired),
  AccountUnavailableWire,
  AuthReadErrorWire,
]);
