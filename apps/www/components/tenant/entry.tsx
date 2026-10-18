import { NuqsAdapter } from "nuqs/adapters/next/app";
import { SignInScreen } from "@/components/auth/screen";
import { EntryShellArtwork } from "@/components/entry/artwork.client";
import {
  EntryShell,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";

/**
 * The entry surface of a school for a visitor who is signed out. It reuses the
 * sign-in body of the main site, and the Google button returns the visitor to
 * the school root they came from.
 */
export function TenantEntry({ title }: { title: string }) {
  return (
    <EntryShell>
      <EntryShellPanel>
        <NuqsAdapter>
          <EntryShellHeader>
            <div className="ms-auto">
              <ThemePicker variant="ghost" />
            </div>
          </EntryShellHeader>

          <SignInScreen returnPath="/">
            <h1 className="font-semibold text-2xl">{title}</h1>
          </SignInScreen>
        </NuqsAdapter>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}
