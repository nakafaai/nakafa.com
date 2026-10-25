import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createStore } from "zustand";
import { AuthSessionContext } from "@/components/auth/context";
import { useConvexAuth } from "@/components/auth/convex";
import {
  SignedOutSessionProvider,
  useAuthSession,
} from "@/components/auth/session";
import {
  ConvexAuthContext,
  type ConvexAuthStore,
  createConvexAuthStore,
} from "@/lib/auth/convex";
import { type AuthSession, previewAuthSession } from "@/lib/auth/session";

/** Shows the Convex auth state a component selects, as text the test reads. */
function ConvexAuthProbe() {
  const state = useConvexAuth(
    (auth) => `authenticated=${auth.isAuthenticated} loading=${auth.isLoading}`
  );
  return createElement("span", null, state);
}

/** Shows the signed-in session id that the page's session store holds. */
function SessionProbe() {
  const sessionId = useAuthSession((session) => `session=${session.sessionId}`);
  return createElement("span", null, sessionId);
}

/** Renders the children under the page's Convex auth store, which every probe reads. */
function withConvexStore(convex: ConvexAuthStore, children: ReactNode) {
  return createElement(ConvexAuthContext, { value: convex }, children);
}

/** Mounts the children in the page's DOM, and returns what it shows and how to end it. */
function mount(children: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(children);
  });
  return {
    shown: () => container.textContent,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** A session that is signed in as the given session id. */
function signedInSession(sessionId: string): AuthSession {
  return { ...previewAuthSession, sessionId, userId: "user-1" };
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe("useConvexAuth", () => {
  it("reports a visitor as signed out, with nothing to wait for", () => {
    const session = createStore(() => previewAuthSession);
    const probe = mount(
      createElement(
        AuthSessionContext,
        { value: session },
        withConvexStore(createConvexAuthStore(), createElement(ConvexAuthProbe))
      )
    );

    expect(probe.shown()).toBe("authenticated=false loading=false");
    probe.unmount();
  });

  it("waits for Convex's answer for the session it is signed in to", () => {
    const session = createStore(() => signedInSession("session-1"));
    const convex = createConvexAuthStore();
    const probe = mount(
      createElement(
        AuthSessionContext,
        { value: session },
        withConvexStore(convex, createElement(ConvexAuthProbe))
      )
    );

    expect(probe.shown()).toBe("authenticated=false loading=true");

    act(() => {
      convex.setState({
        confirmation: Option.some({
          isAuthenticated: true,
          sessionId: "session-1",
        }),
      });
    });
    expect(probe.shown()).toBe("authenticated=true loading=false");
    probe.unmount();
  });

  it("ignores Convex's answer for another session", () => {
    const session = createStore(() => signedInSession("session-1"));
    const convex = createConvexAuthStore();
    const probe = mount(
      createElement(
        AuthSessionContext,
        { value: session },
        withConvexStore(convex, createElement(ConvexAuthProbe))
      )
    );

    act(() => {
      convex.setState({
        confirmation: Option.some({
          isAuthenticated: true,
          sessionId: "session-0",
        }),
      });
    });
    expect(probe.shown()).toBe("authenticated=false loading=true");
    probe.unmount();
  });

  it("switches off with the session the moment it ends", () => {
    const session = createStore(() => signedInSession("session-1"));
    const convex = createConvexAuthStore();
    act(() => {
      convex.setState({
        confirmation: Option.some({
          isAuthenticated: true,
          sessionId: "session-1",
        }),
      });
    });
    const probe = mount(
      createElement(
        AuthSessionContext,
        { value: session },
        withConvexStore(convex, createElement(ConvexAuthProbe))
      )
    );
    expect(probe.shown()).toBe("authenticated=true loading=false");

    act(() => {
      session.setState(previewAuthSession);
    });
    expect(probe.shown()).toBe("authenticated=false loading=false");
    probe.unmount();
  });

  it("serves a visitor's page the signed-out session", () => {
    const probe = mount(
      createElement(
        SignedOutSessionProvider,
        null,
        withConvexStore(
          createConvexAuthStore(),
          createElement(
            "div",
            null,
            createElement(ConvexAuthProbe),
            createElement(SessionProbe)
          )
        )
      )
    );

    expect(probe.shown()).toBe("authenticated=false loading=falsesession=null");
    probe.unmount();
  });
});

describe("useConvexAuth on the server", () => {
  it("renders the state each store starts in, before Convex answers", () => {
    const session = createStore(() => signedInSession("session-1"));
    const html = renderToString(
      createElement(
        AuthSessionContext,
        { value: session },
        withConvexStore(createConvexAuthStore(), createElement(ConvexAuthProbe))
      )
    );

    expect(html).toContain("authenticated=false loading=true");
  });

  it("refuses a page that reads the state outside its Convex provider", () => {
    expect(() => renderToString(createElement(ConvexAuthProbe))).toThrow(
      "useConvexAuth must be used within ConvexProvider"
    );
  });

  it("refuses a page that reads the session outside its session provider", () => {
    expect(() => renderToString(createElement(SessionProbe))).toThrow(
      "useAuthSession must be used within AuthSessionProvider"
    );
  });
});
