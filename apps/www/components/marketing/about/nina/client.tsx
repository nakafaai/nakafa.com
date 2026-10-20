"use client";

import { useRouter } from "@repo/internationalization/src/navigation";
import { lazy, Suspense } from "react";
import { Composer } from "@/components/marketing/about/nina/composer";
import { useLiveSession } from "@/components/providers/marketing";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";

/**
 * The signed-in composer loads with its admission and submission code, so a
 * visitor's page never loads them, and no identity or Convex hook runs there.
 */
const LiveNinaComposer = lazy(() =>
  import("@/components/marketing/about/nina/live.client").then((loaded) => ({
    default: loaded.LiveNinaComposer,
  }))
);

/**
 * A visitor's composer. A prompt sends the visitor to sign-in and stays in the
 * input, so the page loads no chat submission code and opens no client.
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
      onSubmit={signIn}
      prompt={null}
    />
  );
}

/** The composer's frame, disabled, until the signed-in code has loaded. */
function PendingNinaComposer() {
  return (
    <Composer
      attachments={false}
      disabled
      onSubmit={() => false}
      prompt={null}
    />
  );
}

/** Starts a conversation with the shared draft, attachments and admission. */
export function NinaComposer() {
  const live = useLiveSession();
  if (!live) {
    return <VisitorNinaComposer />;
  }
  return (
    <Suspense fallback={<PendingNinaComposer />}>
      <LiveNinaComposer />
    </Suspense>
  );
}
