import { UserSettingsBio } from "@/components/user/settings/bio";
import { UserSettingsDeleteAccount } from "@/components/user/settings/deletion";
import { UserSettingsName } from "@/components/user/settings/name";
import { UserSettingsPicture } from "@/components/user/settings/picture";
import { UserSettingsUsername } from "@/components/user/settings/username";
import { type CurrentUser, useViewer } from "@/lib/identity/client";

export function UserSettingsProfilePage({
  initialAccount,
}: {
  initialAccount: CurrentUser;
}) {
  const identity = useViewer((state) => state);
  const user = identity.isPending ? initialAccount : identity.account;

  if (!user) {
    return null;
  }

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
