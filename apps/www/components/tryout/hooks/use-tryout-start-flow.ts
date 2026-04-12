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
  const authHref = `/auth?redirect=${pathname}`;
  const isAuthPending = access === "authenticated" && isLoading;
  const isStartBlocked = isActionPending || isAuthPending;

  useLayoutEffect(() => {
    return () => {
      closeDialog();
    };
  }, [closeDialog]);

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

  const prefetchAuthAction = useCallback(() => {
    if (isAuthPending) {
      return;
    }

    if (isAuthenticated) {
      return;
    }

    router.prefetch(authHref);
  }, [authHref, isAuthenticated, isAuthPending, router]);

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

      if (result.ok) {
        closeDialog();
        router.replace(pathname);
        toast.success(tTryouts("start-success"), {
          position: "bottom-center",
        });
        return;
      }

      if (result.code === "COMPETITION_ATTEMPT_ALREADY_USED") {
        closeDialog();
        toast.info(tTryouts("competition-attempt-used-error"), {
          position: "bottom-center",
        });
        return;
      }

      if (result.code === "TRYOUT_ACCESS_REQUIRED") {
        closeDialog();
        window.location.href = result.url;
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
