import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import type { Mascot } from "@repo/mascot/code";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { SignInScreen } from "@/components/auth/screen";
import { EntryShellArtwork } from "@/components/entry/artwork.client";
import {
  EntryShell,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { TenantEntryActions } from "@/components/tenant/entry.client";
import { SchoolMark } from "@/components/tenant/mark";

/**
 * The entry surface of a school for a visitor who is signed out. It reuses the
 * sign-in body of the main site under the school's own mark. Its actions sign in with
 * Google, which returns the visitor to the school root they came from, or with a school
 * username and card (`TenantEntryActions`).
 */
export function TenantEntry({
  logo,
  mascot,
  slug,
  title,
}: {
  logo: string | undefined;
  mascot: typeof Mascot.Type;
  slug: TenantSlug;
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
            action={<TenantEntryActions slug={slug} />}
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
