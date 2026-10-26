import { useState } from "react";
import { UserSettingsBio } from "@/components/user/settings/bio";
import { UserSettingsDeleteAccount } from "@/components/user/settings/deletion";
import { UserSettingsName } from "@/components/user/settings/name";
import { UserSettingsPicture } from "@/components/user/settings/picture";
import { UserSettingsUsername } from "@/components/user/settings/username";
import { type CurrentUser, useViewer } from "@/lib/identity/client";

/**
 * The profile settings of the account the server read. The live account
 * replaces it while the viewer holds one. When the viewer holds none, the page
 * keeps the account it last showed: deleting the account ends it before the page
 * leaves, and the deletion dialog, its progress and its failure must stay on
 * screen until then. Every way out of the account leaves the page by loading
 * another one.
 */
export function UserSettingsProfilePage({
  initialAccount,
}: {
  initialAccount: CurrentUser;
}) {
  const account = useViewer((state) => state.account);
  const [last, setLast] = useState(initialAccount);
  if (account !== null && account !== last) {
    setLast(account);
  }
  const user = account ?? last;

  return (
    <>
      <UserSettingsPicture user={user} />
      <UserSettingsName user={user} />
      <UserSettingsUsername user={user} />
      <UserSettingsBio user={user} />
      <UserSettingsDeleteAccount userId={user.appUser._id} />
    </>
  );
}
