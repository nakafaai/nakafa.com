import { QueryResult, useMutation, useQuery } from "@confect/react";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { Option } from "effect";
import { useConvexAuth } from "@/components/auth/convex";
import { ChoiceContext } from "@/components/notifications/choice";
import { relationOfRole } from "@/components/notifications/preferences";
import {
  NoticePreferences,
  PreferenceTable,
} from "@/components/notifications/settings";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/inbox/preferences";

/** The School inbox's preferences: each kind of notice this member gets, with a switch for each channel. */
export function SchoolPreferences() {
  return (
    <NoticePreferences>
      <SchoolChoices />
    </NoticePreferences>
  );
}

/** What the member switched off in this school, and how a switch saves there. */
function SchoolChoices() {
  const { role, slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const off = useQuery(
    notifications.preferences.list,
    isSettled ? { slug } : "skip"
  );
  const set = useMutation(notifications.preferences.set);

  if (QueryResult.isFailure(off)) {
    throw off.error;
  }
  if (!QueryResult.isSuccess(off)) {
    return null;
  }

  return (
    <ChoiceContext
      value={(channel, kind, on) =>
        saveSchool(() => set({ channel, kind, on, slug }), SOURCE)
      }
    >
      <PreferenceTable
        off={off.value}
        relation={relationOfRole(Option.getOrElse(role, () => "teacher"))}
      />
    </ChoiceContext>
  );
}
