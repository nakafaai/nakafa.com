import { getRouteApi } from "@tanstack/react-router";
import { AuthLegal } from "@/components/auth/legal";
import { SignInScreen } from "@/components/auth/screen";
import { EntryShellArtwork } from "@/components/entry/artwork";
import {
  EntryShell,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { SchoolMark } from "@/components/tenant/mark";
import {
  TenantEntryActions,
  TenantEntryBack,
} from "@/components/tenant/username";

/** The school layout's route, which holds the school's profile and the legal notice of its sign-in. */
const schoolRoute = getRouteApi("/school/$slug");

/**
 * The entry surface of a school for a visitor who is signed out. It reuses the
 * sign-in body of the main site under the school's own mark. Its actions sign in with
 * Google, which returns the visitor to the school root they came from, or with a school
 * username and card (`TenantEntryActions`), one way at a time; the header leads back from
 * the username form to Google (`TenantEntryBack`). The school's mark and the legal notice come from
 * the school layout's route.
 */
export function TenantEntry({ title }: { title: string }) {
  const { legal, school } = schoolRoute.useRouteContext();
  const { slug } = school.profile;

  return (
    <EntryShell>
      <EntryShellPanel>
        <EntryShellHeader>
          <TenantEntryBack slug={slug} />
          <div className="ms-auto">
            <ThemePicker variant="ghost" />
          </div>
        </EntryShellHeader>
        <SignInScreen
          action={<TenantEntryActions slug={slug} />}
          figure={
            <SchoolMark
              logo={school.profile.logo}
              mascot={school.profile.mascot}
              size="lg"
            />
          }
          legal={<AuthLegal links={legal} />}
        >
          <h1 className="font-semibold text-2xl">{title}</h1>
        </SignInScreen>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}
