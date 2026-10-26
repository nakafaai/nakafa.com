import { type AnyRouter, useRouter } from "@tanstack/react-router";
import { Array as Arr, Option, String as Str } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/** The address under which every settings section lives. */
const SETTINGS_PATH = "/$locale/user/settings";

/** The address of the page on screen when it is no settings section. */
function readReturn(router: AnyRouter): Option.Option<string> {
  const { location, matches } = router.state;
  return Arr.some(matches, (match) =>
    Str.startsWith(SETTINGS_PATH)(match.fullPath)
  )
    ? Option.none()
    : Option.some(location.href);
}

const SettingsReturnContext = createContext<StoreApi<
  Option.Option<string>
> | null>(null);

/**
 * Remembers the last page the learner read outside settings, so the settings'
 * way back leads there. It mounts with the sidebar, which stays on screen from
 * the page the learner leaves into settings, and follows each resolved
 * navigation. A learner who opened settings first has no such page.
 */
export function SettingsReturnProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [store] = useState(() =>
    createStore<Option.Option<string>>()(() => readReturn(router))
  );

  useEffect(
    () =>
      router.subscribe("onResolved", () => {
        const page = readReturn(router);
        if (Option.isSome(page)) {
          store.setState(page, true);
        }
      }),
    [router, store]
  );

  return (
    <SettingsReturnContext value={store}>{children}</SettingsReturnContext>
  );
}

/** The last page the learner read outside settings, when there was one. */
export function useSettingsReturn(): Option.Option<string> {
  const store = use(SettingsReturnContext);
  if (store === null) {
    throw new TypeError(
      "useSettingsReturn must be used within SettingsReturnProvider"
    );
  }
  return useStore(store);
}
