import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Array as Arr, Schema } from "effect";
// @vitest-environment node

import { afterEach, expect, it } from "@effect/vitest";
// convex-test imports a function's module on the first call, inside that test's 5 s, and the cold graph
// takes longer. Importing them here loads them while the file is collected, so no test pays it.
import "@repo/backend/convex/auth/deletion/workflow";
import { createConvexTestWithAuth } from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { insertProSubscription } from "@repo/backend/test/billing";
import { registerWorkflow } from "@repo/backend/test/workflow";
import { encodeJsonText } from "@repo/utilities/json";

const NOW = Date.UTC(2026, 8, 27);

/** One request that the stubbed fetch recorded: its method, URL and body text. */
const CapturedRequestSchema = Schema.Struct({
  body: Schema.String,
  method: Schema.String,
  url: Schema.String,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("drains the three deletion workflows and their delayed reconciliation before releasing journals", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("POSTHOG_HOST", "https://eu.i.posthog.com");
  let requests: (typeof CapturedRequestSchema.Type)[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const request = new Request(input, init);
      requests = Arr.append(requests, {
        method: request.method,
        url: request.url,
        body: await request.text(),
      });
      if (
        request.url ===
        "https://eu.posthog.com/api/projects/114144/persons/bulk_delete/"
      ) {
        return Response.json({
          deletion_errors: [],
          events_queued_for_deletion: true,
          persons_deleted: 1,
          persons_found: 1,
          recordings_queued_for_deletion: true,
        });
      }
      expect(new URL(request.url).hostname).toBe("sandbox-api.polar.sh");
      if (request.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      expect(request.method).toBe("GET");
      return Response.json({ detail: "Not found" }, { status: 404 });
    })
  );
  const t = createConvexTestWithAuth();
  await registerWorkflow(t);
  const userId = await t.mutation(async (ctx) => {
    const id = await ctx.db.insert("users", {
      credits: 0,
      creditsResetAt: NOW,
      deletedAt: NOW,
      email: "removed@example.com",
      mascot: MASCOT_CODE,
      name: "Removed user",
      plan: "free",
    });
    const accountId = await ctx.db.insert("billingAccounts", {
      owner: { kind: "personal", userId: id },
      rail: "polar",
      country: "ZZ",
      currency: "USD",
      providerCustomerId: "polar-deleted",
    });
    await insertProSubscription(ctx, accountId, {
      subscriptionId: "sub-deleted",
    });
    for (let index = 0; index < 3; index += 1) {
      await ctx.db.insert("comments", {
        likeCount: 0,
        slug: "material/algebra",
        userId: id,
        text: `Comment ${index}`,
        replyCount: 0,
      });
    }
    return id;
  });
  await t.mutation(internal.auth.deletion.workflow.finalize, { userId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const state = await t.query(async (ctx) => ({
    user: await ctx.db.get("users", userId),
    comments: await ctx.db.query("comments").collect(),
    accounts: await ctx.db.query("billingAccounts").collect(),
    subscriptions: await ctx.db.query("billingSubscriptions").collect(),
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  expect(state.user).toMatchObject({
    email: `deleted-${userId}@account.nakafa.invalid`,
    name: "Deleted user",
    deletedAt: NOW,
    deletionCleanupStartedAt: expect.any(Number),
  });
  expect(state.comments).toEqual([]);
  expect(state.accounts).toEqual([]);
  expect(state.subscriptions).toEqual([]);
  expect(Arr.every(state.jobs, (job) => job.state.kind === "success")).toBe(
    true
  );
  expect(
    Arr.filter(
      state.jobs,
      (job) => job.name === "privacy/recovery:cleanupWorkflowStorage"
    )
  ).toHaveLength(3);
  const analyticsRequests = Arr.filter(requests, (request) =>
    request.url.includes("posthog.com")
  );
  expect(analyticsRequests).toHaveLength(2);
  expect(
    Arr.every(
      analyticsRequests,
      (request) =>
        request.body ===
        encodeJsonText({
          delete_events: true,
          delete_recordings: true,
          distinct_ids: [userId],
          keep_person: false,
        })
    )
  ).toBe(true);
  expect(
    Arr.filter(requests, (request) => request.method === "DELETE")
  ).toHaveLength(1);
  // The account held its Polar customer, so the first billing step erased that one. The reconciliation
  // step finds no account left, so it looks the customer up by the user's id, which Polar reports as absent.
  expect(
    Arr.map(
      Arr.filter(requests, (request) => request.method === "GET"),
      (request) => new URL(request.url).pathname
    )
  ).toEqual([`/v1/customers/external/${userId}`]);
});
