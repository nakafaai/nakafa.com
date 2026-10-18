"use client";

import type { GenericId } from "@confect/core";
import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type {
  DeviceId,
  SignalKind,
} from "@repo/backend/confect/exams/sittings/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Clock, Effect, HashMap } from "effect";
import { useEffect, useRef } from "react";
import {
  leftFullscreen,
  type SignalGate,
  takeSignal,
  visibilitySignal,
} from "@/components/exams/sitting/signal";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Sends the integrity signals of one admitted attempt while the student's page is open: a
 * change of visibility, leaving the window, leaving full screen, copy, and paste. The gate
 * keeps each kind to one send a second, and a failed send only reaches the analytics.
 */
export function useSittingSignals({
  attemptId,
  deviceId,
  enabled,
  slug,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  readonly deviceId: typeof DeviceId.Type;
  readonly enabled: boolean;
  readonly slug: TenantSlug;
}) {
  const signal = useMutation(exams.sittings.signal);
  const gate = useRef<SignalGate | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    /** Sends one kind of signal, unless the gate holds it back. */
    function send(kind: typeof SignalKind.Type) {
      const current: SignalGate = gate.current ?? HashMap.empty();
      const [allowed, next] = takeSignal(
        current,
        kind,
        Effect.runSync(Clock.currentTimeMillis)
      );
      gate.current = next;
      if (!allowed) {
        return;
      }
      Effect.runPromise(
        Effect.tryPromise(() =>
          signal({ attemptId, deviceId, kind, slug })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.matchEffect({
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/exams/sitting/signals",
              }),
            onSuccess: () => Effect.void,
          })
        )
      );
    }

    let wasFullscreen = document.fullscreenElement !== null;

    /** Reports a change of visibility, and the page hiding, as a leave or a return. */
    function onVisibility() {
      send(visibilitySignal(document.visibilityState));
    }

    /** Reports full screen only when the page was in it and has left it. */
    function onFullscreen() {
      const isFullscreen = document.fullscreenElement !== null;
      if (leftFullscreen(wasFullscreen, isFullscreen)) {
        send("fullscreenExit");
      }
      wasFullscreen = isFullscreen;
    }

    function onPageHide() {
      send("exit");
    }

    function onBlur() {
      send("blur");
    }

    function onCopy() {
      send("copy");
    }

    function onPaste() {
      send("paste");
    }

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("blur", onBlur);
    };
  }, [attemptId, deviceId, enabled, signal, slug]);
}
