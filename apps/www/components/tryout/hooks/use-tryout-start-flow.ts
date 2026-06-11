"use client";

import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { toastManager } from "@repo/design-system/components/ui/toast";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useAction, useConvexAuth } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useTransition } from "react";
import { startTryout } from "@/components/tryout/actions/tryout";
import { getTryoutPartHref } from "@/components/tryout/utils/routes";
import { getSafeInternalRedirectPath } from "@/lib/auth/utils";

export type TryoutStartParams = FunctionArgs<
  typeof api.tryouts.mutations.attempts.startTryout
>;

export type TryoutRouteAccess = "anonymous" | "authenticated";

/**
 * Owns the shared start-tryout actions for routes that can open the tryout
 * start dialog.
 */
export function useTryoutStartFlow({
  access,
  partKeys,
  params,
  resumePartKey,
}: {
  access: TryoutRouteAccess;
  partKeys: readonly string[];
  params: TryoutStartParams;
  resumePartKey?: string;
}) {
  const tTryouts = useTranslations("Tryouts");
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const generateCheckoutLink = useAction(
    api.customers.actions.public.generateCheckoutLink
  );
  const [isActionPending, startTransition] = useTransition();
  const [isDialogOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const safeRedirectPath = getSafeInternalRedirectPath(pathname) ?? "/";
  const authHref = `/auth?${new URLSearchParams({
    redirect: safeRedirectPath,
  }).toString()}`;
  const isAuthPending = access === "authenticated" && isLoading;
  const isStartBlocked = isActionPending || isAuthPending;

  useLayoutEffect(
    () => () => {
      closeDialog();
    },
    [closeDialog]
  );

  /** Keeps the dialog state aligned with route preservation and unmounts. */
  const setDialogOpenAction = (open: boolean) => {
    if (open) {
      openDialog();
      return;
    }

    closeDialog();
  };

  /** Opens auth, resumes an attempt, or opens the start dialog based on state. */
  const clickStartAction = () => {
    if (isAuthPending) {
      return;
    }

    if (!isAuthenticated) {
      closeDialog();
      router.push(authHref);
      return;
    }

    if (resumePartKey) {
      closeDialog();
      router.push(
        getTryoutPartHref({
          partKey: resumePartKey,
          product: params.product,
          tryoutSlug: params.tryoutSlug,
        })
      );
      return;
    }

    openDialog();
  };

  /** Prefetches the auth route for anonymous users when the CTA becomes relevant. */
  const prefetchAuthAction = () => {
    if (isAuthPending) {
      return;
    }

    if (isAuthenticated) {
      return;
    }

    router.prefetch(authHref);
  };

  /** Starts the tryout and maps the server result into the route-level UX. */
  const confirmStartAction = () => {
    if (isAuthPending) {
      return;
    }

    if (!isAuthenticated) {
      closeDialog();
      router.push(authHref);
      return;
    }

    startTransition(async () => {
      const result = await startTryout({
        ...params,
        partKeys,
        returnPath: pathname,
      });

      if (result.kind === "started") {
        closeDialog();
        router.replace(pathname);
        toastManager.add({ type: "success", title: tTryouts("start-success") });
        return;
      }

      if (result.kind === "competition-attempt-used") {
        closeDialog();
        toastManager.add({
          type: "info",
          title: tTryouts("competition-attempt-used-error"),
        });
        return;
      }

      if (result.kind === "requires-access") {
        closeDialog();
        const { url } = await generateCheckoutLink({
          locale: params.locale,
          successUrl: result.successUrl,
        });
        window.location.href = url;
        return;
      }

      if (result.kind === "not-ready") {
        toastManager.add({
          type: "error",
          title: tTryouts("start-not-ready-error"),
        });
        return;
      }

      if (result.kind === "inactive" || result.kind === "not-found") {
        toastManager.add({
          type: "error",
          title: tTryouts("start-unavailable-error"),
        });
        return;
      }

      toastManager.add({ type: "error", title: tTryouts("start-error") });
    });
  };

  return {
    clickStartAction,
    confirmStartAction,
    isActionPending,
    isDialogOpen,
    isStartBlocked,
    prefetchAuthAction,
    setDialogOpenAction,
  };
}
