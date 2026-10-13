import type { WorkflowId } from "@convex-dev/workflow";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { startInviteEmail } from "@repo/backend/confect/emails/invite/workflow";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { workflow } from "@repo/backend/confect/workflow";
import { invitePerson, tenancyFixture } from "@repo/backend/test/tenancy";
import type { FunctionArgs } from "convex/server";
import { Array as Arr, Effect, Exit, Option, Schema } from "effect";

const address = Schema.decodeSync(Email)("kepala@harapan.example.test");

/** The workflow that the platform started for a new invite, before it has ended. */
const started = Effect.gen(function* () {
  const fixture = yield* tenancyFixture;
  const { inviteId } = yield* fixture.run(
    invitePerson(fixture.tenants.nf, address)
  );
  const workflowId = yield* fixture.run(
    Effect.gen(function* () {
      yield* startInviteEmail(inviteId, "id");
      const ctx = yield* MutationCtx;
      const { page } = yield* Effect.promise(() => workflow.list(ctx));
      return yield* Effect.fromOption(
        Option.map(Arr.head(page), (found) => found.workflowId)
      ).pipe(Effect.orDie);
    })
  );
  return { fixture, workflowId };
});

/** Ends the workflow the way the workflow component does, which then calls the completion handler. */
const end = Effect.fn("test.completion.end")(function* (
  workflowId: WorkflowId,
  runResult: FunctionArgs<
    typeof components.workflow.workflow.complete
  >["runResult"]
) {
  const ctx = yield* MutationCtx;
  const state = yield* Effect.promise(() =>
    ctx.runQuery(components.workflow.workflow.getStatus, { workflowId })
  );
  yield* Effect.promise(() =>
    ctx.runMutation(components.workflow.workflow.complete, {
      generationNumber: state.workflow.generationNumber,
      runResult,
      workflowId,
    })
  );
});

/** Whether the workflow component still holds the workflow. */
const holds = (workflowId: WorkflowId) =>
  Effect.flatMap(MutationCtx, (ctx) =>
    Effect.promise(() => workflow.status(ctx, workflowId))
  ).pipe(Effect.exit, Effect.map(Exit.isSuccess));

describe("emails/invite/completion", () => {
  it.effect("releases the journal of a workflow that delivered", () =>
    Effect.gen(function* () {
      const { fixture, workflowId } = yield* started;
      expect(yield* fixture.run(holds(workflowId))).toBe(true);
      yield* fixture.run(
        end(workflowId, { kind: "success", returnValue: null })
      );
      expect(yield* fixture.run(holds(workflowId))).toBe(false);
    })
  );

  it.effect("keeps the journal of a workflow that did not deliver", () =>
    Effect.gen(function* () {
      const { fixture, workflowId } = yield* started;
      yield* fixture.run(
        end(workflowId, {
          error: "The mail provider refused the message.",
          kind: "failed",
        })
      );
      expect(yield* fixture.run(holds(workflowId))).toBe(true);
    })
  );
});
