"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { redirect } from "next/navigation";

type Props = {
  /**
   * The children is the landing page for Nakafa School.
   */
  children: React.ReactNode;
};

export function School({ children }: Props) {
  const user = useQuery(api.auth.getCurrentUser);

  if (user) {
    redirect("/school/onboarding");

    // TODO: Check if user has school membership, redirect to appropriate page
  }

  return children;
}
