"use client";

import { useRouter } from "@repo/internationalization/src/navigation";
import type { ConvexReactClient } from "convex/react";
import { lazy, Suspense, useState } from "react";
import { Composer } from "@/components/marketing/about/nina/composer";
import { useLiveSession } from "@/components/providers/live";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";

/**
 * The signed-in composer's admission and submission code. It loads on the first
 * focus or input in the composer, so a page nobody types into never loads it, and
 * a visitor's page never loads it at all.
 */
const LiveNinaComposer = lazy(() =>
  import("@/components/marketing/about/nina/live.client").then((loaded) => ({
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
    <Composer
      attachments={false}
      disabled={false}
      onAttachRequest={signIn}
      onSubmit={signIn}
      prompt={null}
    />
  );
}

/**
 * A signed-in composer before its first focus or input: the same input as the
 * live composer, which replaces it, with the submission code still unloaded.
 */
function SignedInNinaComposer({ client }: { client: ConvexReactClient }) {
  const [engaged, setEngaged] = useState(false);

  if (!engaged) {
    return (
      <Composer
        attachments={false}
        disabled={false}
        onEngage={() => setEngaged(true)}
        onSubmit={() => {
          setEngaged(true);
          return false;
        }}
        prompt={null}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <Composer
          attachments={false}
          disabled
          onSubmit={() => false}
          prompt={null}
        />
      }
    >
      <LiveNinaComposer client={client} />
    </Suspense>
  );
}

/** Starts a conversation with the shared draft, attachments and admission. */
export function NinaComposer() {
  const client = useLiveSession((state) => state.client);
  if (client === null) {
    return <VisitorNinaComposer />;
  }
  return <SignedInNinaComposer client={client} />;
}
