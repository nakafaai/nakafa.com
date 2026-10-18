import type { Mascot } from "@repo/mascot/code";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AuthGoogle } from "@/components/auth/google";
import { SignInScreen } from "@/components/auth/screen";
import { EntryShellArtwork } from "@/components/entry/artwork.client";
import {
  EntryShell,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { SchoolMark } from "@/components/tenant/mark";

/**
 * The entry surface of a school for a visitor who is signed out. It reuses the
 * sign-in body of the main site under the school's own mark, and the Google
 * button returns the visitor to the school root they came from.
 */
export function TenantEntry({
  logo,
  mascot,
  title,
}: {
  logo: string | undefined;
  mascot: typeof Mascot.Type;
  title: string;
}) {
  return (
    <EntryShell>
      <EntryShellPanel>
        <NuqsAdapter>
          <EntryShellHeader>
            <div className="ms-auto">
              <ThemePicker variant="ghost" />
            </div>
          </EntryShellHeader>

          <SignInScreen
            action={<AuthGoogle returnPath="/" />}
            figure={<SchoolMark logo={logo} mascot={mascot} size="lg" />}
          >
            <h1 className="font-semibold text-2xl">{title}</h1>
          </SignInScreen>
        </NuqsAdapter>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}
