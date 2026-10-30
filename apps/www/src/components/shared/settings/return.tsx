import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { useWindowEvent } from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { type AnyRouter, useNavigate, useRouter } from "@tanstack/react-router";
import { Array as Arr, Option, String as Str } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import { Link, type LinkTarget } from "@/lib/routing/link";

/** The address of the page on screen when it is no settings section under `path`. */
function readReturn(router: AnyRouter, path: string): Option.Option<string> {
  const { location, matches } = router.state;
  return Arr.some(matches, (match) => Str.startsWith(path)(match.fullPath))
    ? Option.none()
    : Option.some(location.href);
}

const SettingsReturnContext = createContext<StoreApi<
  Option.Option<string>
> | null>(null);

/**
 * Remembers the last page read outside the settings whose routes start with
 * `path`, so the settings' way back leads there. It mounts with the sidebar,
 * which stays on screen from the page the viewer leaves into settings, and
 * follows each resolved navigation. A viewer who opened settings first has no
 * such page.
 */
export function SettingsReturnProvider({
  children,
  path,
}: {
  children: ReactNode;
  path: string;
}) {
  const router = useRouter();
  const [store] = useState(() =>
    createStore<Option.Option<string>>()(() => readReturn(router, path))
  );

  useEffect(
    () =>
      router.subscribe("onResolved", () => {
        const page = readReturn(router, path);
        if (Option.isSome(page)) {
          store.setState(page, true);
        }
      }),
    [path, router, store]
  );

  return (
    <SettingsReturnContext value={store}>{children}</SettingsReturnContext>
  );
}

/** The last page read outside settings, when there was one. */
function useSettingsReturn(): Option.Option<string> {
  const store = use(SettingsReturnContext);
  if (store === null) {
    throw new TypeError(
      "useSettingsReturn must be used within SettingsReturnProvider"
    );
  }
  return useStore(store);
}

/** Whether a key press belongs to a field the viewer is typing in. */
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

/**
 * The way out of a settings sidebar, above its first group: back to the page
 * read before settings, or to `home` when settings was the first page. Escape
 * leaves the same way, unless a field holds the key or an open popup closed
 * with it, which marks the press as handled before it reaches the window.
 */
export function SettingsBack({
  home,
  label,
}: {
  home: LinkTarget;
  label: string;
}) {
  const navigate = useNavigate();
  const page = useSettingsReturn();

  useWindowEvent("keydown", (event) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.isComposing ||
      isTyping(event.target)
    ) {
      return;
    }
    navigate(
      Option.match(page, {
        onNone: () => home,
        onSome: (href) => ({ href }),
      })
    );
  });

  // A border closes the way back off from the settings below it.
  return (
    <SidebarGroup className="border-b">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={Option.match(page, {
                onNone: () => <Link {...home} title={label} />,
                onSome: (href) => <Link href={href} title={label} />,
              })}
              tooltip={label}
            >
              <HugeIcons icon={ArrowLeft02Icon} />
              <span className="truncate">{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
