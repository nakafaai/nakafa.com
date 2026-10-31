import type { OptimisticUpdate } from "@confect/react";
import type access from "@repo/backend/confect/_generated/refs/access";
import type integrations from "@repo/backend/confect/_generated/refs/integrations";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr } from "effect";
import {
  changeClientLists,
  changeGrantPages,
  changeInviteLists,
  patchViewer,
} from "@/components/tenant/settings/mutation";

/** The optimistic changes of the edits of a record the school already holds. */

/** Shows an invite's corrected address at once. */
export const readdressInviteChange: OptimisticUpdate<
  typeof tenancy.invites.readdress
> = (localStore, { email, inviteId, slug }) => {
  changeInviteLists(
    localStore,
    slug,
    () => true,
    (page) =>
      Arr.map(page, (invite) =>
        invite.id === inviteId ? { ...invite, email } : invite
      )
  );
};

/** Shows a client's new name and actions at once. */
export const updateClientChange: OptimisticUpdate<
  typeof integrations.clients.update
> = (localStore, { actions, clientId, name, slug }) => {
  changeClientLists(localStore, slug, (page) =>
    Arr.map(page, (client) =>
      client.id === clientId ? { ...client, actions, name } : client
    )
  );
};

/** Shows a grant's new role at once, in every loaded list of the school's grants. */
export const changeGrantRoleChange: OptimisticUpdate<
  typeof access.grants.change
> = (localStore, { grantId, role, slug }) => {
  changeGrantPages(
    localStore,
    slug,
    () => true,
    (page) =>
      Arr.map(page, (grant) =>
        grant.id === grantId
          ? { ...grant, role: { key: role, kind: "builtin" } }
          : grant
      )
  );
};

/** Shows the school's new country and currency at once. */
export const setLocaleChange: OptimisticUpdate<
  typeof tenancy.settings.setLocale
> = (localStore, { country, currency, slug }) => {
  patchViewer(localStore, slug, (viewer) => ({
    ...viewer,
    tenant: { ...viewer.tenant, country, currency },
  }));
};
