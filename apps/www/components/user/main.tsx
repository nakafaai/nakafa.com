"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { UserComments } from "./comments";
import { UserHeader } from "./header";
import { UserTabs } from "./tabs";

type Props = {
  userId: Id<"users">;
};

export function UserMain({ userId }: Props) {
  const user = useQuery(api.auth.getUserById, { userId });

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <UserHeader user={user} />
      <UserTabs userId={userId} />
      <UserComments user={user} />
    </div>
  );
}
