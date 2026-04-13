import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserContextProvider, useUser } from "./use-user";

const mocks = vi.hoisted(() => ({
  getProperty: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  setPersonProperties: vi.fn(),
  useQueryWithStatus: vi.fn(),
}));

const PROVIDER_ERROR = /useUser must be used within a UserContextProvider/;

vi.mock("@repo/analytics/posthog", () => ({
  analytics: {
    get_property: mocks.getProperty,
    identify: mocks.identify,
    reset: mocks.reset,
    setPersonProperties: mocks.setPersonProperties,
  },
}));

vi.mock("@repo/backend/helpers/react", () => ({
  useQueryWithStatus: mocks.useQueryWithStatus,
}));

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

    mocks.useQueryWithStatus.mockReturnValue({ data: null, isPending: true });

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
    mocks.useQueryWithStatus.mockReturnValue({
      data: {
        appUser: { _id: "user_123" },
        authUser: { email: "nabil@nakafa.com", name: "Nabil" },
      },
      isPending: false,
    });

    act(() => {
      root.render(
        createElement(UserContextProvider, null, createElement("div"))
      );
    });

    expect(mocks.identify).toHaveBeenCalledWith("user_123", {
      email: "nabil@nakafa.com",
      name: "Nabil",
    });
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
    mocks.useQueryWithStatus.mockReturnValue({
      data: {
        appUser: { _id: "user_123" },
        authUser: { email: null, name: "Nabil" },
      },
      isPending: false,
    });

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
    mocks.useQueryWithStatus.mockReturnValue({
      data: {
        appUser: { _id: "user_123" },
        authUser: { email: "nabil@nakafa.com", name: "Nabil" },
      },
      isPending: false,
    });

    act(() => {
      root.render(
        createElement(UserContextProvider, null, createElement("div"))
      );
    });

    expect(mocks.identify).not.toHaveBeenCalled();
    expect(mocks.setPersonProperties).toHaveBeenCalledWith({
      email: "nabil@nakafa.com",
      name: "Nabil",
    });
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
    mocks.useQueryWithStatus.mockReturnValue({ data: null, isPending: false });

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
    mocks.useQueryWithStatus.mockReturnValue({ data: null, isPending: false });

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

    mocks.useQueryWithStatus.mockReturnValue({
      data: {
        appUser: { _id: "user_123" },
        authUser: { email: "nabil@nakafa.com", name: "Nabil" },
      },
      isPending: false,
    });

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
