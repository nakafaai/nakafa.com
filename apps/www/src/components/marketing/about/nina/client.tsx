import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useRouter } from "@repo/internationalization/src/navigation";
import { Option } from "effect";
import { lazy, Suspense, startTransition, useState } from "react";
import { NinaInput } from "@/components/ai/input";
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
 * A visitor's composer. Its attach button and its send both ask for sign-in,
 * so the page loads no chat code and opens no Convex client.
 */
function VisitorNinaComposer() {
  const router = useRouter();
  const authNavigation = useCurrentAuthNavigation();

  function signIn() {
    router.push(authNavigation.readHref());
    return false;
  }

  return (
    <NinaInput attachments={false} onAttachRequest={signIn} onSubmit={signIn} />
  );
}

/**
 * A signed-in composer while its session loads. Its send waits for the account,
 * so it offers neither sign-in nor a send.
 */
function PendingNinaComposer() {
  return <NinaInput attachments={false} disabled onSubmit={() => false} />;
}

/**
 * A signed-in composer before its first focus or input. Engaging is a transition,
 * so React keeps this input, focused and holding its text, until the live composer
 * that replaces it has loaded. A send pressed here is held and admitted once that
 * composer mounts.
 */
function SignedInNinaComposer() {
  const [engaged, setEngaged] = useState(false);
  const [held, setHeld] = useState<PromptInputMessage | null>(null);

  function engage() {
    startTransition(() => setEngaged(true));
  }

  return (
    <Suspense fallback={null}>
      {engaged ? (
        <LiveNinaComposer held={held} />
      ) : (
        <NinaInput
          attachments={false}
          onEngage={engage}
          onSubmit={(message) => {
            setHeld(message);
            engage();
            return false;
          }}
        />
      )}
    </Suspense>
  );
}

/** Selects the composer that the page's live session allows: signed in, loading, or a visitor's. */
function NinaComposerInput() {
  const client = useLiveSession((state) => state.client);
  const isSessionPending = useLiveSession((state) => state.isPending);
  if (Option.isSome(client)) {
    return <SignedInNinaComposer />;
  }
  if (isSessionPending) {
    return <PendingNinaComposer />;
  }
  return <VisitorNinaComposer />;
}

/** Starts a conversation with the shared draft, attachments and admission. */
export function NinaComposer() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <NinaComposerInput />
    </div>
  );
}
