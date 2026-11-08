import { QueryResult, useMutation, useQuery } from "@confect/react";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { useConvexAuth } from "@/components/auth/convex";
import { ChoiceContext } from "@/components/notifications/choice";
import {
  NoticePreferences,
  PreferenceTable,
} from "@/components/notifications/settings";
import { LoadFailure } from "@/components/state/failure";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/** The Nakafa inbox's preferences: the notices the account holds itself, with a switch for each channel. */
export function AccountPreferences() {
  return (
    <NoticePreferences>
      <AccountChoices />
    </NoticePreferences>
  );
}

/** What the account switched off, and how a switch saves on it. */
function AccountChoices() {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const off = useQuery(notifications.personal.list, isSettled ? {} : "skip");
  const set = useMutation(notifications.personal.set);

  if (QueryResult.isFailure(off)) {
    return <LoadFailure />;
  }
  const isRead = QueryResult.isSuccess(off);

  return (
    <ChoiceContext
      value={
        isRead
          ? (channel, kind, on) =>
              runSchoolWrite(schoolCall(() => set({ channel, kind, on })))
          : null
      }
    >
      <PreferenceTable off={isRead ? off.value : []} relation="commenter" />
    </ChoiceContext>
  );
}
