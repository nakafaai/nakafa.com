import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Session } from "@repo/backend/confect/auth/session";
import { member } from "@repo/backend/confect/middleware/member.impl";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Cause, Effect, Exit, Schema } from "effect";

describe("middleware/member", () => {
  it.effect("dies when a function attaching it declares no tenant slug", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      const defect = yield* confect.run(
        Effect.gen(function* () {
          const userId = yield* (yield* DatabaseWriter).table("users").insert({
            authId: "member-wiring",
            credits: 0,
            creditsResetAt: 0,
            email: "member-wiring@example.com",
            name: "Member Wiring",
            plan: "free",
          });
          const appUser = yield* (yield* DatabaseReader)
            .table("users")
            .get(userId);
          const exit = yield* member(Effect.die("the handler ran"), {
            invocation: {
              args: { schoolSlug: "nf" },
              functionType: "query",
              functionVisibility: "public",
              name: "probe",
            },
          }).pipe(
            Effect.provideService(Session, {
              appUser,
              authId: "member-wiring",
            }),
            Effect.exit
          );
          return Exit.hasDies(exit) ? String(Cause.squash(exit.cause)) : "none";
        }).pipe(Effect.orDie),
        Schema.String
      );
      expect(defect).not.toBe("none");
      expect(defect).not.toContain("the handler ran");
    }).pipe(Effect.provide(confectLayer))
  );
});
