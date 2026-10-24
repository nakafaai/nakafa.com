import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createStore, type StoreApi } from "zustand";
import { AuthSessionContext } from "@/components/auth/context";
import { useConvexAuth } from "@/components/auth/convex";
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

/** Mounts the probe under the session and Convex stores of one page. */
function mountProbe(session: StoreApi<AuthSession>, convex: ConvexAuthStore) {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(
      createElement(
        AuthSessionContext,
        { value: session },
        createElement(
          ConvexAuthContext,
          { value: convex },
          createElement(ConvexAuthProbe)
        )
      )
    );
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
    const probe = mountProbe(session, createConvexAuthStore());

    expect(probe.shown()).toBe("authenticated=false loading=false");
    probe.unmount();
  });

  it("waits for Convex's answer for the session it is signed in to", () => {
    const session = createStore(() => signedInSession("session-1"));
    const convex = createConvexAuthStore();
    const probe = mountProbe(session, convex);

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
    const probe = mountProbe(session, convex);

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
    const probe = mountProbe(session, convex);
    expect(probe.shown()).toBe("authenticated=true loading=false");

    act(() => {
      session.setState(previewAuthSession);
    });
    expect(probe.shown()).toBe("authenticated=false loading=false");
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
        createElement(
          ConvexAuthContext,
          { value: createConvexAuthStore() },
          createElement(ConvexAuthProbe)
        )
      )
    );

    expect(html).toContain("authenticated=false loading=true");
  });

  it("refuses a page that reads the state outside its Convex provider", () => {
    expect(() => renderToString(createElement(ConvexAuthProbe))).toThrow(
      "useConvexAuth must be used within ConvexProvider"
    );
  });
});
