// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { ClientSession } from "@/lib/auth/visitor";
import {
  authenticateConvex,
  readConvexClient,
} from "@/lib/convex/client.client";

const URL = "https://example.convex.cloud";

describe("browser Convex client", () => {
  it("creates one client per page", () => {
    expect(readConvexClient(URL)).toBe(readConvexClient(URL));
  });

  it("authenticates a signed-in visitor", () => {
    const client = readConvexClient(URL);
    const setAuth = vi.spyOn(client, "setAuth");
    const session = ClientSession.cases.SignedIn.make({
      name: "Ada",
      sessionId: "session-1",
      userId: "user-1",
    });
    const fetchToken = () => Promise.resolve("token");
    authenticateConvex(client, session, fetchToken);
    expect(setAuth).toHaveBeenCalledWith(fetchToken);
  });

  it("never authenticates a signed-out visitor", () => {
    const client = readConvexClient(URL);
    const setAuth = vi.spyOn(client, "setAuth");
    authenticateConvex(client, ClientSession.cases.SignedOut.make({}), () =>
      Promise.resolve(null)
    );
    expect(setAuth).not.toHaveBeenCalled();
  });
});
