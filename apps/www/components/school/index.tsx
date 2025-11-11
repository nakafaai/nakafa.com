"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { redirect } from "next/navigation";

type Props = {
  children: React.ReactNode;
};

export function School({ children }: Props) {
  const user = useQuery(api.auth.getCurrentUser);

  // if there is user, redirect to its dashboard
  if (user) {
    // must redirect based on the user's role
    if (user.appUser.role === "teacher") {
      redirect("/school/teacher");
    }

    if (user.appUser.role === "student") {
      redirect("/school/student");
    }

    if (user.appUser.role === "parent") {
      redirect("/school/parent");
    }

    if (user.appUser.role === "administrator") {
      redirect("/school/admin");
    }

    return children;
  }

  // this is landing page for school
  return children;
}
