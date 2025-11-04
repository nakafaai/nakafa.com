"use client";

import { Authenticated } from "convex/react";
import { UserSettingsApiKey } from "@/components/user/settings/api-key";

export function UserSettingsDevelopersPage() {
  return (
    <Authenticated>
      <UserSettingsApiKey />
    </Authenticated>
  );
}
