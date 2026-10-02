import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** Roles are code, identical in every tenant; display labels live in the UI dictionary. */
export const BuiltinRole = Schema.Literals([
  "owner",
  "admin",
  "principal",
  "deputy",
  "teacher",
  "counselor",
  "staff",
  "student",
  "guardian",
  "proctor",
  "auditor",
  "integration",
]);
export type BuiltinRole = typeof BuiltinRole.Type;

/** Custom tenant roles join this union as a second member. */
export const RoleRef = Schema.Struct({
  key: BuiltinRole,
  kind: Schema.Literal("builtin"),
});

export const GrantScope = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("tenant") }),
  Schema.Struct({ kind: Schema.Literal("unit"), unitId: Id("tenantUnits") }),
]);
export type GrantScope = typeof GrantScope.Type;

/** Temporary grants end through a scheduled mutation, never by reading the clock. */
export const GrantTerm = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("standing") }),
  Schema.Struct({
    expiresAt: Schema.Finite,
    kind: Schema.Literal("temporary"),
  }),
]);
export const GrantStatus = Schema.Literals(["active", "revoked", "expired"]);

/** Why a grant stopped: a person revoked it, its term ran out, or a visit replaced it. */
export const GrantEndReason = Schema.Literals([
  "revoked",
  "expired",
  "replaced",
]);

/** One active grant on the wire. */
export const GrantView = Schema.Struct({
  id: Id("tenantGrants"),
  role: RoleRef,
  scope: GrantScope,
  term: GrantTerm,
});
