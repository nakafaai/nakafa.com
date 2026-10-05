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

/** Roles a `roles` rule names. Every Owner passes every `roles` rule unnamed. */
export const RuleRole = BuiltinRole.pick([
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

/** Roles only Owners may give or remove, so an Admin cannot mint Admins. */
export const OwnerRole = BuiltinRole.pick(["owner", "admin"]);

/** A write stops at a locked subject or a suspended tenant; a read does not. */
export const Access = Schema.Literals(["read", "write"]);

/**
 * How one action is granted. A `roles` rule allows its roles, every Owner,
 * and its relations. A `relations` rule allows its relations only: no role,
 * not even Owner, may record a guardian's consent or answer a student's exam.
 */
export const Rule = Schema.Union([
  Schema.Struct({
    access: Access,
    grantedBy: Schema.Literal("roles"),
    relations: Schema.Array(Schema.String),
    roles: Schema.Array(RuleRole),
  }),
  Schema.Struct({
    access: Access,
    grantedBy: Schema.Literal("relations"),
    relations: Schema.NonEmptyArray(Schema.String),
  }),
]).pipe(Schema.toTaggedUnion("grantedBy"));
export type Rule = typeof Rule.Type;

/** Custom tenant roles join this union as a second member. */
export const RoleRef = Schema.Struct({
  key: BuiltinRole,
  kind: Schema.Literal("builtin"),
});

/** A tenant grant covers every subject; a unit grant covers its unit's. */
export const GrantScope = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("tenant") }),
  Schema.Struct({ kind: Schema.Literal("unit"), unitId: Id("tenantUnits") }),
]).pipe(Schema.toTaggedUnion("kind"));
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
