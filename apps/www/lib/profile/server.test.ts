// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import users from "@repo/backend/confect/_generated/refs/users";
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

const PROFILE_ID = "kn7d517e2jtf7kq3m7evvp4dhd7s39p1";
const OTHER_ID = "kn7ab0c1d2e3f4g5h6i7j8k9l0m1n2o3";
const TOKEN = "session-token";
const PROFILE = {
  _id: PROFILE_ID,
  name: "Nabil Fatih",
  username: "nabil_fatih",
};

/** The signed-in account that a session names, as `getCurrentUser` answers it. */
const accountOf = (id: string) =>
  Effect.succeed({
    appUser: { _id: id, name: "Nabil Fatih" },
    authUser: { _id: "auth", email: "nabil@example.com", name: "Nabil Fatih" },
  });

/** Answers the profile query with `profile` and the account query with `account`. */
function answerWith({
  account = Effect.succeed(null),
  profile = Effect.succeed(PROFILE),
}: {
  account?: Effect.Effect<unknown>;
  profile?: Effect.Effect<unknown>;
}) {
  mocks.query.mockImplementation((ref: unknown) =>
    ref === users.queries.getProfileByUsername ? profile : account
  );
}

describe("profile server", () => {
  beforeEach(() => {
    mocks.layerOptions.mockClear();
    mocks.notFound.mockClear();
    mocks.query.mockReset();
    mocks.token.mockReset();
  });

  it("reads the profile at the address in any case, by its lowercase username", async () => {
    mocks.token.mockResolvedValue(undefined);
    answerWith({});

    const { profile } = await readProfile("Nabil_Fatih");

    expect(profile).toStrictEqual(PROFILE);
    expect(mocks.query).toHaveBeenCalledWith(
      users.queries.getProfileByUsername,
      { username: "nabil_fatih" }
    );
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("opens the profile for a visitor without a session, who owns nothing and asks no account", async () => {
    mocks.token.mockResolvedValue(undefined);
    answerWith({});

    expect(await readProfile("visitor_profile")).toMatchObject({
      isOwner: false,
      profile: PROFILE,
    });
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.layerOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({ auth: TOKEN })
    );
  });

  it("marks the owner: the signed-in account whose app user is the profile's", async () => {
    mocks.token.mockResolvedValue(TOKEN);
    answerWith({ account: accountOf(PROFILE_ID) });

    expect(await readProfile("owner_profile")).toMatchObject({ isOwner: true });
    expect(mocks.layerOptions).toHaveBeenCalledWith({ auth: TOKEN });
  });

  it("does not mark a signed-in learner who holds another account as the owner", async () => {
    mocks.token.mockResolvedValue(TOKEN);
    answerWith({ account: accountOf(OTHER_ID) });

    expect(await readProfile("other_profile")).toMatchObject({
      isOwner: false,
      profile: PROFILE,
    });
  });

  it("treats a session that names no account as a visitor", async () => {
    mocks.token.mockResolvedValue(TOKEN);
    answerWith({ account: Effect.succeed(null) });

    expect(await readProfile("nameless_profile")).toMatchObject({
      isOwner: false,
    });
  });

  it("ends the request as not found for a username nobody holds, with or without a session", async () => {
    mocks.token.mockResolvedValue(undefined);
    answerWith({ profile: Effect.succeed(null) });
    await expect(readProfile("nobody_visitor")).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );

    mocks.token.mockResolvedValue(TOKEN);
    answerWith({
      account: accountOf(PROFILE_ID),
      profile: Effect.succeed(null),
    });
    await expect(readProfile("nobody_owner")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledTimes(2);
  });
});
