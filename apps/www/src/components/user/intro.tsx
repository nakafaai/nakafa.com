import { DeferredLearnerText } from "@repo/design-system/components/markdown/deferred";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { PublicProfile } from "@/lib/profile/public";

/**
 * The top of a profile's body, its heading: the name and the address on the left, the picture on the right, and the
 * bio under them, one line for each line written.
 */
export function UserIntro({ profile }: { profile: PublicProfile }) {
  return (
    <section className="grid gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-2xl font-semibold text-balance wrap-anywhere sm:text-3xl">
            {profile.name}
          </h1>
          <p className="text-muted-foreground truncate text-base">
            @{profile.username}
          </p>
        </div>
        <PersonAvatar
          className="size-14 shrink-0 md:size-21"
          mascot={profile.mascot}
          photo={profile.image}
        />
      </header>
      {profile.bio ? (
        <DeferredLearnerText className="text-base">
          {profile.bio}
        </DeferredLearnerText>
      ) : null}
    </section>
  );
}
