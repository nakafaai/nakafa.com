import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useNavigate } from "@tanstack/react-router";
import { Deferred, Effect, Option } from "effect";
import {
  lazy,
  Suspense,
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { NinaInput } from "@/components/ai/input";
import { HeldPromptContext } from "@/components/marketing/about/nina/held";
import { useLiveSession } from "@/components/providers/live";
import { hasSignedInHint } from "@/lib/auth/hint";
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

/** Whether this page starts no session: its signed-in hint is not set, so it stays a visitor's. */
function startsNoSession() {
  return !hasSignedInHint(document.cookie);
}

/**
 * The composer before its live code loads: one input that looks the same and
 * keeps its text while the page's session settles, so a signed-in learner never
 * sees it dim and come back. A visitor's attach and send ask for sign-in. A send
 * or an attach pressed while the session loads, or before the live composer
 * loaded, is held: a session that signs in loads the live composer, which admits
 * the send or opens the file picker, and a session that settles signed out asks
 * for sign-in. The page's session starts only after React takes the page over,
 * so until then a reader counts as a visitor only when the page has no signed-in
 * hint, and an attach pressed before then is kept (`useEarlyPress`) and follows
 * the same way. A signed-in learner's first focus or input loads the live
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
  const [attachHeld, setAttachHeld] = useState(false);
  const isVisitor = !(isSignedIn || isSessionPending);
  // The session settles once per page, so one deferred marks that moment: a
  // settled session with its client, or a page that starts none.
  const [sessionKnown] = useState(() => Deferred.makeUnsafe<void>());
  useEffect(() => {
    if (!isSessionPending && (isSignedIn || startsNoSession())) {
      Deferred.doneUnsafe(sessionKnown, Effect.void);
    }
  }, [isSessionPending, isSignedIn, sessionKnown]);
  /** Loads the live composer for a signed-in session, or asks a visitor to sign in. */
  function followSession() {
    if (isSignedIn) {
      startTransition(() => setEngaged(true));
      return;
    }
    setHeld(null);
    setAttachHeld(false);
    navigate(authNavigation.readTarget());
  }

  // A held send follows the session as the render that knows it reads it, and
  // a composer that leaves meanwhile drops it.
  const follow = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    follow.current = followSession;
    return () => {
      follow.current = null;
    };
  });

  /** Holds a send pressed while the session loads, until the session is known. */
  function hold(message: PromptInputMessage) {
    setHeld(message);
    Effect.runPromise(Deferred.await(sessionKnown)).then(() =>
      follow.current?.()
    );
    return false;
  }

  /** Holds an attach pressed before the live composer loaded, until the session is known. */
  function holdAttach() {
    setAttachHeld(true);
    Effect.runPromise(Deferred.await(sessionKnown)).then(() =>
      follow.current?.()
    );
  }

  function signIn() {
    navigate(authNavigation.readTarget());
    return false;
  }

  /** Whether the reader is a visitor: no session, none loading, and none the page will start. */
  function isVisitorNow() {
    return isVisitor && startsNoSession();
  }

  /** Asks a visitor to sign in, and holds any other reader's attach. */
  function requestAttach() {
    if (isVisitorNow()) {
      signIn();
      return;
    }
    holdAttach();
  }

  function engage() {
    startTransition(() => setEngaged(true));
  }

  return (
    <Suspense fallback={null}>
      {engaged && isSignedIn ? (
        <HeldPromptContext value={{ attach: attachHeld, held }}>
          <LiveNinaComposer />
        </HeldPromptContext>
      ) : (
        <NinaInput
          attachments={false}
          onAttachRequest={requestAttach}
          onEngage={isSignedIn ? engage : undefined}
          onSubmit={(message) => (isVisitorNow() ? signIn() : hold(message))}
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
