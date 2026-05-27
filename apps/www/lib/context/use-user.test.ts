import { QueryResult } from "@confect/react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserContextProvider, useUser } from "@/lib/context/use-user";

const mocks = vi.hoisted(() => ({
  getProperty: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  setPersonProperties: vi.fn(),
  useQuery: vi.fn(),
}));

const PROVIDER_ERROR = /useUser must be used within a UserContextProvider/;
const SIGNED_UP_AT = "2026-04-02T12:00:00.000Z";
const SIGNED_UP_AT_MS = Date.parse(SIGNED_UP_AT);

vi.mock("@repo/analytics/posthog", () => ({
  analytics: {
    get_property: mocks.getProperty,
    identify: mocks.identify,
    reset: mocks.reset,
    setPersonProperties: mocks.setPersonProperties,
  },
}));

vi.mock("@confect/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@confect/react")>();

  return {
    ...actual,
    useQuery: mocks.useQuery,
  };
});

function UserName() {
  const name = useUser((state) => state.user?.authUser.name ?? "guest");

  return createElement("div", null, name);
}

describe("lib/context/use-user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("waits for the current user query before syncing PostHog", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    mocks.useQuery.mockReturnValue(QueryResult.load(false));

    act(() => {
      root.render(
        createElement(UserContextProvider, null, createElement("div"))
      );
    });

    expect(mocks.getProperty).not.toHaveBeenCalled();
    expect(mocks.identify).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.setPersonProperties).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("identifies the signed-in user with stable person properties", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    mocks.getProperty.mockReturnValue(undefined);
    mocks.useQuery.mockReturnValue(
      QueryResult.succeed({
        appUser: {
          _id: "user_123",
          _creationTime: SIGNED_UP_AT_MS,
          plan: "pro",
          role: "teacher",
        },
        authUser: { email: "nabil@nakafa.com", name: "Nabil" },
      })
    );

    act(() => {
      root.render(
        createElement(UserContextProvider, null, createElement("div"))
      );
    });

    expect(mocks.identify).toHaveBeenCalledWith(
      "user_123",
      {
        email: "nabil@nakafa.com",
        name: "Nabil",
        plan: "pro",
        role: "teacher",
      },
      {
        signed_up_at: SIGNED_UP_AT,
      }
    );
    expect(mocks.setPersonProperties).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("skips PostHog updates when the auth snapshot is incomplete", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    mocks.getProperty.mockReturnValue(undefined);
    mocks.useQuery.mockReturnValue(
      QueryResult.succeed({
        appUser: {
          _id: "user_123",
          _creationTime: SIGNED_UP_AT_MS,
          plan: "pro",
        },
        authUser: { email: null, name: "Nabil" },
      })
    );

    act(() => {
      root.render(
        createElement(UserContextProvider, null, createElement("div"))
      );
    });

    expect(mocks.identify).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.setPersonProperties).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("refreshes person properties for the current identified user", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    mocks.getProperty.mockReturnValue("user_123");
    mocks.useQuery.mockReturnValue(
      QueryResult.succeed({
        appUser: {
          _id: "user_123",
          _creationTime: SIGNED_UP_AT_MS,
          plan: "free",
        },
        authUser: { email: "nabil@nakafa.com", name: "Nabil" },
      })
    );

    act(() => {
      root.render(
        createElement(UserContextProvider, null, createElement("div"))
      );
    });

    expect(mocks.identify).not.toHaveBeenCalled();
    expect(mocks.setPersonProperties).toHaveBeenCalledWith(
      {
        email: "nabil@nakafa.com",
        name: "Nabil",
        plan: "free",
      },
      {
        signed_up_at: SIGNED_UP_AT,
      }
    );
    expect(mocks.reset).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("resets PostHog when the session becomes anonymous again", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    mocks.getProperty.mockReturnValue("user_123");
    mocks.useQuery.mockReturnValue(QueryResult.succeed(null));

    act(() => {
      root.render(
        createElement(UserContextProvider, null, createElement("div"))
      );
    });

    expect(mocks.identify).not.toHaveBeenCalled();
    expect(mocks.setPersonProperties).not.toHaveBeenCalled();
    expect(mocks.reset).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("leaves PostHog anonymous when no identified user is active", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    mocks.getProperty.mockReturnValue(undefined);
    mocks.useQuery.mockReturnValue(QueryResult.succeed(null));

    act(() => {
      root.render(
        createElement(UserContextProvider, null, createElement("div"))
      );
    });

    expect(mocks.identify).not.toHaveBeenCalled();
    expect(mocks.setPersonProperties).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("provides the current user snapshot to consumers", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    mocks.useQuery.mockReturnValue(
      QueryResult.succeed({
        appUser: {
          _id: "user_123",
          _creationTime: SIGNED_UP_AT_MS,
          plan: "free",
        },
        authUser: { email: "nabil@nakafa.com", name: "Nabil" },
      })
    );

    act(() => {
      root.render(
        createElement(UserContextProvider, null, createElement(UserName))
      );
    });

    expect(container.textContent).toBe("Nabil");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("throws when useUser is called outside its provider", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    expect(() => {
      act(() => {
        root.render(createElement(UserName));
      });
    }).toThrow(PROVIDER_ERROR);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
