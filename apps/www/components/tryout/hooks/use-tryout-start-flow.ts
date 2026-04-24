"use client";

import { useDisclosure } from "@mantine/hooks";
import type { api } from "@repo/backend/convex/_generated/api";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useConvexAuth } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useTranslations } from "next-intl";
import { useCallback, useLayoutEffect, useTransition } from "react";
import { toast } from "sonner";
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
  const setDialogOpenAction = useCallback(
    (open: boolean) => {
      if (open) {
        openDialog();
        return;
      }

      closeDialog();
    },
    [closeDialog, openDialog]
  );

  /** Opens auth, resumes an attempt, or opens the start dialog based on state. */
  const clickStartAction = useCallback(() => {
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
  }, [
    authHref,
    closeDialog,
    isAuthenticated,
    isAuthPending,
    openDialog,
    params.product,
    params.tryoutSlug,
    resumePartKey,
    router,
  ]);

  /** Prefetches the auth route for anonymous users when the CTA becomes relevant. */
  const prefetchAuthAction = useCallback(() => {
    if (isAuthPending) {
      return;
    }

    if (isAuthenticated) {
      return;
    }

    router.prefetch(authHref);
  }, [authHref, isAuthenticated, isAuthPending, router]);

  /** Starts the tryout and maps the server result into the route-level UX. */
  const confirmStartAction = useCallback(() => {
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
        toast.success(tTryouts("start-success"), {
          position: "bottom-center",
        });
        return;
      }

      if (result.kind === "competition-attempt-used") {
        closeDialog();
        toast.info(tTryouts("competition-attempt-used-error"), {
          position: "bottom-center",
        });
        return;
      }

      if (result.kind === "requires-access") {
        closeDialog();
        window.location.href = result.url;
        return;
      }

      if (result.kind === "not-ready") {
        toast.error(tTryouts("start-not-ready-error"), {
          position: "bottom-center",
        });
        return;
      }

      if (result.kind === "inactive" || result.kind === "not-found") {
        toast.error(tTryouts("start-unavailable-error"), {
          position: "bottom-center",
        });
        return;
      }

      toast.error(tTryouts("start-error"), {
        position: "bottom-center",
      });
    });
  }, [
    closeDialog,
    isAuthenticated,
    isAuthPending,
    partKeys,
    params,
    pathname,
    authHref,
    router,
    tTryouts,
  ]);

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
