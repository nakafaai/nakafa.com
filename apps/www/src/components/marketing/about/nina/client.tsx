import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useNavigate } from "@tanstack/react-router";
import { Option } from "effect";
import { lazy, Suspense, startTransition, useEffect, useState } from "react";
import { NinaInput } from "@/components/ai/input";
import { HeldPromptContext } from "@/components/marketing/about/nina/held";
import { useLiveSession } from "@/components/providers/live";
import { useCurrentAuthNavigation } from "@/lib/auth/location";

/**
 * The signed-in composer's admission and submission code. It loads on the first
 * focus or input in the composer, so a page nobody types into never loads it, and
 * a visitor's page never loads it at all.
 */
const LiveNinaComposer = lazy(() =>
  import("@/components/marketing/about/nina/live").then((loaded) => ({
    default: loaded.LiveNinaComposer,
  }))
);

/**
 * The composer before its live code loads: one input that looks the same and
 * keeps its text while the page's session settles, so a signed-in learner never
 * sees it dim and come back. A visitor's attach and send ask for sign-in. A send
 * pressed while the session loads is held: a session that signs in loads the
 * live composer, which admits it, and a session that settles signed out asks
 * for sign-in. A signed-in learner's first focus or input loads the live
 * composer as a transition, so React keeps this input, focused and holding its
 * text, until the live composer has loaded, which admits a send held here.
 */
function NinaComposerInput() {
  const isSignedIn = useLiveSession((state) => Option.isSome(state.client));
  const isSessionPending = useLiveSession((state) => state.isPending);
  const navigate = useNavigate();
  const authNavigation = useCurrentAuthNavigation();
  const [engaged, setEngaged] = useState(false);
  const [held, setHeld] = useState<PromptInputMessage | null>(null);
  const isVisitor = !(isSignedIn || isSessionPending);

  // A send held while the session loaded follows the session once it settles.
  useEffect(() => {
    if (held === null || isSessionPending) {
      return;
    }
    if (isSignedIn) {
      startTransition(() => setEngaged(true));
      return;
    }
    setHeld(null);
    navigate(authNavigation.readTarget());
  }, [authNavigation, held, isSessionPending, isSignedIn, navigate]);

  function signIn() {
    navigate(authNavigation.readTarget());
    return false;
  }

  function engage() {
    startTransition(() => setEngaged(true));
  }

  return (
    <Suspense fallback={null}>
      {engaged && isSignedIn ? (
        <HeldPromptContext value={{ held }}>
          <LiveNinaComposer />
        </HeldPromptContext>
      ) : (
        <NinaInput
          attachments={false}
          onAttachRequest={isVisitor ? signIn : undefined}
          onEngage={isSignedIn ? engage : undefined}
          onSubmit={(message) => {
            if (isVisitor) {
              return signIn();
            }
            setHeld(message);
            return false;
          }}
        />
      )}
    </Suspense>
  );
}

/** Starts a conversation with the shared draft, attachments and admission. */
export function NinaComposer() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <NinaComposerInput />
    </div>
  );
}
