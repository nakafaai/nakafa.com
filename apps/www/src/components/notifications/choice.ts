import type { PreferenceChannel } from "@repo/backend/confect/notifications/preference";
import type { NoticeKind } from "@repo/backend/confect/notifications/rules";
import { createContext } from "react";

/**
 * How a switch of the preferences saves its choice: as a member of a school or as the
 * account itself, which the sheet's content provides and every switch reads. It is null until
 * the reader's choices have been read, and a switch keeps its place unseen until then.
 */
export const ChoiceContext = createContext<
  | ((
      channel: typeof PreferenceChannel.Type,
      kind: typeof NoticeKind.Type,
      on: boolean
    ) => Promise<void>)
  | null
>(null);
