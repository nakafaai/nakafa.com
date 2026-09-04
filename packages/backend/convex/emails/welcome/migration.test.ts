import { type EmailId, Resend } from "@convex-dev/resend";
import resendTest from "@convex-dev/resend/test";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { resend } from "@repo/backend/convex/emails/client";
import {
  type LegacyWelcomeHandleMigrationResult,
  legacyWelcomePageOptions,
} from "@repo/backend/convex/emails/welcome/migration";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeFunctionReference } from "convex/server";
import { convexTest, type TestConvex } from "convex-test";

const NOW = Date.UTC(2026, 8, 4, 10, 0, 0);
const migrationReference = makeFunctionReference<
  "action",
  {
    cursor: string | null;
    maxPages: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  },
  LegacyWelcomeHandleMigrationResult
>("emails/welcome/migration:migrateLegacyWelcomeHandles");
const testResend = new Resend(components.resend, {
  apiKey: "re_test_legacy_welcome_migration",
  testMode: true,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function createMigrationTest() {
  const test = convexTest(schema, convexModules);
  resendTest.register(test);
  return test;
}

async function createWaitingEmail(test: TestConvex<typeof schema>) {
  return await test.mutation((ctx) =>
    testResend.sendEmail(ctx, {
      from: "Nakafa <nakafa@notifications.nakafa.com>",
      subject: "Welcome",
      text: "Welcome",
      to: "delivered@resend.dev",
    })
  );
}

async function createQueuedEmail(test: TestConvex<typeof schema>) {
  const emailId = await createWaitingEmail(test);
  await test.mutation((ctx) =>
    ctx.runMutation(components.resend.lib.updateManualEmail, {
      emailId,
      status: "queued",
    })
  );
  return emailId;
}

async function createSentEmail(
  test: TestConvex<typeof schema>,
  providerMessageId: string
) {
  return await test.mutation((ctx) =>
    testResend.sendEmailManually(
      ctx,
      {
        from: "Nakafa <nakafa@notifications.nakafa.com>",
        subject: "Welcome",
        to: "delivered@resend.dev",
      },
      () => Promise.resolve(providerMessageId)
    )
  );
}

async function insertUser(
  test: TestConvex<typeof schema>,
  suffix: string,
  welcomeEmailId?: EmailId
) {
  return await test.mutation((ctx) =>
    ctx.db.insert("users", {
      authId: `${suffix}-auth`,
      credits: 0,
      creditsResetAt: 0,
      email: `${suffix}@example.com`,
      name: `User ${suffix}`,
      plan: "free",
      welcomeEmailId,
    })
  );
}

async function readUsers(
  test: TestConvex<typeof schema>,
  userIds: readonly Id<"users">[]
) {
  return await test.query(
    async (ctx) =>
      await Promise.all(userIds.map((userId) => ctx.db.get("users", userId)))
  );
}

describe("emails/welcome/migration", () => {
  it("hard-bounds every Convex page by rows and bytes", () => {
    expect(legacyWelcomePageOptions("opaque-cursor")).toEqual({
      cursor: "opaque-cursor",
      maximumBytesRead: 4 * 1024 * 1024,
      maximumRowsRead: 32,
      numItems: 32,
    });
  });

  it("cancels queued work and clears every safely inspected legacy handle", async () => {
    const test = createMigrationTest();
    const missingComponentHandle = await createWaitingEmail(test);
    vi.setSystemTime(NOW + 1);
    await test.mutation((ctx) =>
      ctx.runMutation(components.resend.lib.cleanupAbandonedEmails, {
        olderThan: 0,
      })
    );
    const waitingHandle = await createWaitingEmail(test);
    const queuedHandle = await createQueuedEmail(test);
    const sentHandle = await createSentEmail(test, "sent-provider-message");
    const userIds = await Promise.all([
      insertUser(test, "without-handle"),
      insertUser(test, "missing-component", missingComponentHandle),
      insertUser(test, "waiting", waitingHandle),
      insertUser(test, "queued", queuedHandle),
      insertUser(test, "sent", sentHandle),
    ]);

    const result = await test.action(migrationReference, {
      cursor: null,
      maxPages: 1,
    });

    expect(result).toEqual({
      cancelledHandles: 2,
      clearedHandles: 4,
      componentRecordsMissing: 1,
      continueCursor: null,
      inspectedHandles: 4,
      inspectionFailures: 0,
      isDone: true,
      scannedUsers: 5,
    });
    expect(
      (await readUsers(test, userIds)).every(
        (user) => user?.welcomeEmailId === undefined
      )
    ).toBe(true);
    expect(
      await test.query((ctx) => testResend.status(ctx, waitingHandle))
    ).toMatchObject({ status: "cancelled" });
    expect(
      await test.query((ctx) => testResend.status(ctx, queuedHandle))
    ).toMatchObject({ status: "cancelled" });
    expect(
      await test.query((ctx) => testResend.status(ctx, sentHandle))
    ).toMatchObject({ status: "sent" });
    expect(
      await test.query((ctx) => testResend.status(ctx, missingComponentHandle))
    ).toBeNull();

    await expect(
      test.action(migrationReference, { cursor: null, maxPages: 1 })
    ).resolves.toEqual({
      cancelledHandles: 0,
      clearedHandles: 0,
      componentRecordsMissing: 0,
      continueCursor: null,
      inspectedHandles: 0,
      inspectionFailures: 0,
      isDone: true,
      scannedUsers: 5,
    });
  });

  it("retains a handle when component inspection fails", async () => {
    const test = createMigrationTest();
    const waitingHandle = await createWaitingEmail(test);
    const userId = await insertUser(test, "inspection-failure", waitingHandle);
    vi.spyOn(resend, "status").mockRejectedValueOnce(
      new Error("Synthetic component outage")
    );

    const result = await test.action(migrationReference, {
      cursor: null,
      maxPages: 1,
    });

    expect(result).toEqual({
      cancelledHandles: 0,
      clearedHandles: 0,
      componentRecordsMissing: 0,
      continueCursor: null,
      inspectedHandles: 0,
      inspectionFailures: 1,
      isDone: true,
      scannedUsers: 1,
    });
    expect((await readUsers(test, [userId]))[0]?.welcomeEmailId).toBe(
      waitingHandle
    );
    expect(
      await test.query((ctx) => testResend.status(ctx, waitingHandle))
    ).toMatchObject({ status: "waiting" });
  });

  it("continues clearing healthy rows after one inspection failure", async () => {
    const test = createMigrationTest();
    const failedHandle = await createWaitingEmail(test);
    const healthyHandle = await createWaitingEmail(test);
    const failedUserId = await insertUser(test, "failed-row", failedHandle);
    const healthyUserId = await insertUser(test, "healthy-row", healthyHandle);
    vi.spyOn(resend, "status").mockRejectedValueOnce(
      new Error("Synthetic component outage")
    );

    const result = await test.action(migrationReference, {
      cursor: null,
      maxPages: 1,
    });

    expect(result).toMatchObject({
      cancelledHandles: 1,
      clearedHandles: 1,
      inspectedHandles: 1,
      inspectionFailures: 1,
      isDone: true,
      scannedUsers: 2,
    });
    const [failedUser, healthyUser] = await readUsers(test, [
      failedUserId,
      healthyUserId,
    ]);
    expect(failedUser?.welcomeEmailId).toBe(failedHandle);
    expect(healthyUser?.welcomeEmailId).toBeUndefined();
  });

  it("stops at the approved page bound and resumes from its opaque cursor", async () => {
    const test = createMigrationTest();
    const sentHandle = await createSentEmail(test, "later-page-provider");
    for (let index = 0; index < 96; index += 1) {
      await insertUser(test, `first-page-${index}`);
    }
    vi.setSystemTime(NOW + 1);
    const laterUserId = await insertUser(test, "later-page", sentHandle);

    const first = await test.action(migrationReference, {
      cursor: null,
      maxPages: 2,
    });

    expect(first).toMatchObject({
      clearedHandles: 0,
      inspectedHandles: 0,
      inspectionFailures: 0,
      isDone: false,
      scannedUsers: 64,
    });
    if (first.isDone) {
      throw new Error("Expected a continuation cursor at the approved bound.");
    }

    const second = await test.action(migrationReference, {
      cursor: first.continueCursor,
      maxPages: 2,
    });

    expect(second).toEqual({
      cancelledHandles: 0,
      clearedHandles: 1,
      componentRecordsMissing: 0,
      continueCursor: null,
      inspectedHandles: 1,
      inspectionFailures: 0,
      isDone: true,
      scannedUsers: 33,
    });
    expect((await readUsers(test, [laterUserId]))[0]?.welcomeEmailId).toBe(
      undefined
    );
  });
});
