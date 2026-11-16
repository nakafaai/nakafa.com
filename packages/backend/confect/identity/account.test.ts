import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import {
  createLoginAccount,
  passwordFormatRefusal,
  setLoginPassword,
} from "@repo/backend/confect/identity/account";
import { isLoginAddress } from "@repo/backend/confect/identity/address";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { inMutation } from "@repo/backend/test/client";
import { Option } from "effect";

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);
const PASSWORD = "correct horse battery";

describe("identity/account", () => {
  it.each([
    ["kurang", Option.some("passwordTooShort")],
    ["x".repeat(101), Option.some("passwordTooLong")],
    [` ${PASSWORD}`, Option.some("passwordRejected")],
    [`${PASSWORD} `, Option.some("passwordRejected")],
    [PASSWORD, Option.none()],
    // Length counts characters a person typed, not UTF-16 units.
    ["🦊🦊🦊🦊🦊🦊🦊🦊", Option.none()],
  ])("tells why a card would refuse the password %j", (password, refusal) => {
    expect(passwordFormatRefusal(password)).toEqual(refusal);
  });

  it("makes a school account with no mailbox, whose Convex Auth username is its own id", async () => {
    const t = createConvexTestWithAuth();
    const userId = await t.mutation(
      inMutation(() => createLoginAccount("Siti Aminah"))
    );
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", userId),
      username: await ctx.runQuery(components.authUsername.public.getUsername, {
        userId,
      }),
      welcome: await ctx.db.query("welcomeEmailIntents").collect(),
    }));
    expect(state.user).toMatchObject({ name: "Siti Aminah" });
    expect(isLoginAddress(state.user?.email ?? "")).toBe(true);
    expect(state.user?.email).not.toContain("Siti");
    expect(state.username).toBe(userId);
    expect(state.welcome).toEqual([]);
  });

  it("dies when the username component refuses an account id, which only a defect can cause", async () => {
    const t = createConvexTestWithAuth();
    await expect(
      t.mutation((ctx) => {
        vi.spyOn(ctx, "runMutation").mockResolvedValueOnce({
          success: false,
          userError: { error: "USERNAME_TAKEN" },
        });
        return inMutation(() => createLoginAccount("Siti Aminah"))(ctx);
      })
    ).rejects.toThrow("USERNAME_TAKEN");
  });

  it("replaces the password and ends every session, so an old card's holder is locked out", async () => {
    const t = createConvexTestWithAuth();
    const account = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "school-login" })
    );
    await expect(
      t.mutation(inMutation(() => setLoginPassword(account.userId, PASSWORD)))
    ).resolves.toBeNull();
    await expect(
      t.query((ctx) =>
        ctx.runQuery(components.auth.public.listSessions, {
          userId: account.userId,
        })
      )
    ).resolves.toEqual([]);
    const verify = (password: string) =>
      t.mutation((ctx) =>
        ctx.runMutation(components.authPassword.public.verifyPassword, {
          password,
          userId: account.userId,
        })
      );
    await expect(verify(PASSWORD)).resolves.toEqual({ success: true });
    await expect(
      t.mutation(
        inMutation(() =>
          setLoginPassword(account.userId, "another fine phrase")
        )
      )
    ).resolves.toBeNull();
    await expect(verify("another fine phrase")).resolves.toEqual({
      success: true,
    });
    await expect(verify(PASSWORD)).resolves.toMatchObject({ success: false });
  });

  it("answers the password component's refusal and keeps the sessions", async () => {
    const t = createConvexTestWithAuth();
    const account = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "common-password" })
    );
    await expect(
      t.mutation(inMutation(() => setLoginPassword(account.userId, "password")))
    ).resolves.toBe("PASSWORD_TOO_COMMON");
    await expect(
      t.query((ctx) =>
        ctx.runQuery(components.auth.public.listSessions, {
          userId: account.userId,
        })
      )
    ).resolves.toHaveLength(1);
  });
});
