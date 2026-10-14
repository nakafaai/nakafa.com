// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { Effect, Layer } from "effect";
import { readProfile } from "@/lib/profile/server";

const mocks = vi.hoisted(() => ({
  layerOptions: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  query: vi.fn(),
  token: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/auth/server", () => ({ getToken: mocks.token }));
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) => {
        mocks.layerOptions(args[1]);
        return Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return { ...client, query: mocks.query };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args)));
      },
    },
  };
});

const ID = "kn7d517e2jtf7kq3m7evvp4dhd7s39p1";
const TOKEN = "session-token";

/** The account the session names, as `getCurrentUser` answers it. */
const accountOf = (username?: string) =>
  Effect.succeed({
    appUser: { _id: ID, name: "Nabil", ...(username ? { username } : {}) },
    authUser: { _id: "auth", email: "nabil@example.com", name: "Nabil" },
  });

describe("profile server", () => {
  beforeEach(() => {
    mocks.layerOptions.mockClear();
    mocks.notFound.mockClear();
    mocks.query.mockReset();
    mocks.token.mockReset();
  });

  it("opens the profile at the address of the signed-in account, in any case", async () => {
    mocks.token.mockResolvedValue(TOKEN);
    mocks.query.mockReturnValue(accountOf("nabil_fatih"));

    const profile = await readProfile("Nabil_Fatih");

    expect(profile.username).toBe("nabil_fatih");
    expect(profile.account.appUser._id).toBe(ID);
    expect(mocks.layerOptions).toHaveBeenCalledWith({ auth: TOKEN });
    expect(mocks.query.mock.calls[0]?.[0]).toBe(auth.queries.getCurrentUser);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("ends the request as not found at the address of another account", async () => {
    mocks.token.mockResolvedValue(TOKEN);
    mocks.query.mockReturnValue(accountOf("someoneelse"));

    await expect(readProfile("nabil_fatih")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("ends the request as not found for a visitor without a session, and asks no account", async () => {
    mocks.token.mockResolvedValue(undefined);

    await expect(readProfile("nabil_fatih")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("ends the request as not found for a session that names no account", async () => {
    mocks.token.mockResolvedValue(TOKEN);
    mocks.query.mockReturnValue(Effect.succeed(null));

    await expect(readProfile("nabil_fatih")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("ends the request as not found for an account that holds no username", async () => {
    mocks.token.mockResolvedValue(TOKEN);
    mocks.query.mockReturnValue(accountOf());

    await expect(readProfile("nabil_fatih")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
