import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AuthGoogle } from "@/components/auth/google";
import { EntryShellArtwork } from "@/components/entry/artwork.client";
import {
  EntryShell,
  EntryShellBody,
  EntryShellPanel,
} from "@/components/entry/shell";

/**
 * The entry surface of a school for a visitor who is signed out. It reuses the
 * entry shell of the main site, and the Google button returns the visitor to
 * the school root they came from. The school sign-in lane replaces it.
 */
export function TenantEntry({ title }: { title: string }) {
  return (
    <EntryShell>
      <EntryShellPanel>
        <NuqsAdapter>
          <EntryShellBody>
            <h1 className="text-center font-semibold text-2xl">{title}</h1>
            <AuthGoogle returnPath="/" />
          </EntryShellBody>
        </NuqsAdapter>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}
