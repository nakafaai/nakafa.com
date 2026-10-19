// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import { getToken } from "@/lib/auth/server";
import { readProfile, readSchoolName, readViewer } from "@/lib/tenant/read";
import {
  ACCESS_DENIED,
  answered,
  NOT_MEMBER,
  PROFILE,
  PROFILE_VALUE,
  queriesOf,
  refusedWith,
  resetFakeBackend,
  serve,
  TENANT_NOT_FOUND,
  TOKEN,
  VIEWER,
  VIEWER_VALUE,
} from "@/test/school";

/** The server environment is a stand-in here: the reads take the token from the mocked session helper. */
vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/auth/server", () => ({ getToken: vi.fn() }));
/**
 * The shared fake backend imports the school gate, which builds its locale middleware when it
 * loads. These reads never reach that middleware, so the library stands in as a plain function.
 */
vi.mock("next-intl/middleware", () => ({ default: () => () => undefined }));
/**
 * The `use cache` directive is a build transform, so the test stands in for the cache scope
 * that `cacheLife` needs. The reads keep their real `io`.
 */
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheLife: vi.fn(),
}));

const SLUG = Schema.decodeSync(TenantSlug)("harapan");

describe("readProfile", () => {
  beforeEach(() => {
    resetFakeBackend();
  });

  it("reads the profile of a school that exists", async () => {
    serve({ profile: answered(PROFILE_VALUE) });

    const profile = await readProfile(SLUG);

    expect(Option.getOrUndefined(profile)?.name).toBe("Harapan");
    expect(Arr.map(queriesOf(), (query) => query.path)).toEqual([PROFILE]);
  });

  it("reads no profile for a school that does not exist", async () => {
    serve({ profile: refusedWith(TENANT_NOT_FOUND) });

    expect(Option.isNone(await readProfile(SLUG))).toBe(true);
  });
});

describe("readSchoolName", () => {
  beforeEach(() => {
    resetFakeBackend();
  });

  it("reads the name of a school that exists", async () => {
    serve({ profile: answered(PROFILE_VALUE) });

    expect(Option.getOrUndefined(await readSchoolName(SLUG))).toBe("Harapan");
    expect(Arr.map(queriesOf(), (query) => query.path)).toEqual([PROFILE]);
  });

  it("reads no name for a school that does not exist", async () => {
    serve({ profile: refusedWith(TENANT_NOT_FOUND) });

    expect(Option.isNone(await readSchoolName(SLUG))).toBe(true);
  });
});

describe("readViewer", () => {
  beforeEach(() => {
    resetFakeBackend();
    vi.mocked(getToken).mockReset();
  });

  it("reads nothing for a visitor without a session", async () => {
    vi.mocked(getToken).mockResolvedValue(undefined);

    expect(await readViewer(SLUG)).toEqual({ _tag: "visitor" });
    expect(queriesOf()).toEqual([]);
  });

  it("reads the viewer of a member with the session token", async () => {
    vi.mocked(getToken).mockResolvedValue(TOKEN);
    serve({ viewer: answered(VIEWER_VALUE) });

    const viewer = await readViewer(SLUG);

    expect(viewer).toMatchObject({
      _tag: "member",
      viewer: { person: { name: "Ayu" } },
    });
    expect(Arr.map(queriesOf(), (query) => query.path)).toEqual([VIEWER]);
  });

  it("answers denied for a viewer whom the school does not admit", async () => {
    vi.mocked(getToken).mockResolvedValue(TOKEN);
    serve({ viewer: refusedWith(ACCESS_DENIED) });

    expect(await readViewer(SLUG)).toEqual({ _tag: "denied" });
  });

  it("answers outsider for a signed-in account that is not a member", async () => {
    vi.mocked(getToken).mockResolvedValue(TOKEN);
    serve({ viewer: refusedWith(NOT_MEMBER) });

    expect(await readViewer(SLUG)).toEqual({ _tag: "outsider", token: TOKEN });
  });
});
