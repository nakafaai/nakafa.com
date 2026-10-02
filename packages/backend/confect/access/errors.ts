import { Effect, Schema } from "effect";

const accessDenied = Schema.Literal("ACCESS_DENIED");

/**
 * The caller may not perform `action`. `resource` covers both a missing
 * object and another tenant's object, so an ID probe reveals nothing.
 * `action` is a plain string on the wire, so clients built before a lane
 * added an action still decode the denial.
 */
export class AccessDenied extends Schema.TaggedError<AccessDenied>()(
  "AccessDenied",
  {
    action: Schema.String,
    code: accessDenied.pipe(
      Schema.withConstructorDefault(Effect.succeed(accessDenied.literal))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("You do not have access to this.")
      )
    ),
    reason: Schema.Literals(["resource", "role", "condition"]),
  }
) {}

/**
 * A grant the caller may manage but the tenant's invariants refuse:
 * `GRANT_ROLE` a role no person may assign, `GRANT_SCOPE` an Owner outside
 * tenant scope, `GRANT_LIMIT` too many grants, `PERSON_INACTIVE` an ended
 * Person, `PERSON_KIND` an operator Person (visits are the only operator
 * grants), `LAST_OWNER` removing the tenant's last claimed Owner.
 */
export class GrantRejected extends Schema.TaggedError<GrantRejected>()(
  "GrantRejected",
  {
    code: Schema.Literals([
      "GRANT_ROLE",
      "GRANT_SCOPE",
      "GRANT_LIMIT",
      "PERSON_INACTIVE",
      "PERSON_KIND",
      "LAST_OWNER",
    ]),
    message: Schema.String,
  }
) {}
