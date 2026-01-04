import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import { articlesMenu } from "@/components/sidebar/_data/articles";
import { exercisesMenu } from "@/components/sidebar/_data/exercises";
import { holyMenu } from "@/components/sidebar/_data/holy";
import { subjectMenu } from "@/components/sidebar/_data/subject";

export function Curriculum() {
  const tHoly = useTranslations("Holy");
  const tCommon = useTranslations("Common");
  const tSubject = useTranslations("Subject");
  const tArticles = useTranslations("Articles");
  const tExercises = useTranslations("Exercises");

  const t = useTranslations("About");

  return (
    <section className="grid scroll-mt-28 gap-12" id="curriculum">
      <div className="grid gap-6">
        <h2 className="font-semibold text-3xl tracking-tight sm:text-4xl">
          {t.rich("curriculum-title", {
            mark: (chunks) => <mark>{chunks}</mark>,
          })}
        </h2>
        <p className="max-w-xl text-balance text-lg text-muted-foreground md:text-xl">
          {t("curriculum-description")}
        </p>
      </div>

      <div className="grid gap-4">
        <h3 className="font-medium text-2xl tracking-tight">
          {tCommon("subject")}
        </h3>
        <div className="overflow-hidden rounded-xl border shadow-sm">
          {subjectMenu.map((subject) => (
            <div
              className="flex flex-col border-b last:border-b-0"
              key={subject.title}
            >
              <div className="flex items-center gap-2 border-b p-6">
                {!!subject.icon && (
                  <HugeIcons className="size-5 shrink-0" icon={subject.icon} />
                )}
                <h4>{tSubject(subject.title)}</h4>
              </div>
              <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {subject.items.map((item) => {
                  let title = "";
                  if ("value" in item) {
                    title = tSubject(item.title, { grade: item.value });
                  } else {
                    title = tSubject(item.title);
                  }
                  return (
                    <NavigationLink
                      className="cursor-pointer p-6 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
                      href={item.href}
                      key={title}
                    >
                      <h4>{title}</h4>
                    </NavigationLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <h3 className="font-medium text-2xl tracking-tight">
          {tCommon("exercises")}
        </h3>
        <div className="overflow-hidden rounded-xl border shadow-sm">
          {exercisesMenu.map((exercise) => (
            <div
              className="flex flex-col border-b last:border-b-0"
              key={exercise.title}
            >
              <div className="flex items-center gap-2 border-b p-6">
                {!!exercise.icon && (
                  <HugeIcons className="size-5 shrink-0" icon={exercise.icon} />
                )}
                <h4>{tExercises(exercise.title)}</h4>
              </div>
              <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {exercise.items.map((item) => (
                  <NavigationLink
                    className="cursor-pointer p-6 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
                    href={item.href}
                    key={item.title}
                  >
                    <h4>{tExercises(item.title)}</h4>
                  </NavigationLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-12 sm:grid-cols-2">
        <div className="grid gap-4">
          <h3 className="font-medium text-2xl tracking-tight">
            {tHoly("holy")}
          </h3>
          <div className="overflow-hidden rounded-xl border shadow-sm">
            {holyMenu.map((item) => (
              <div
                className="flex flex-col border-b last:border-b-0"
                key={item.title}
              >
                <NavigationLink
                  className="flex cursor-pointer items-center gap-2 p-6 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
                  href={item.href}
                >
                  {!!item.icon && (
                    <HugeIcons className="size-5 shrink-0" icon={item.icon} />
                  )}
                  <h4>{tHoly(item.title)}</h4>
                </NavigationLink>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <h3 className="font-medium text-2xl tracking-tight">
            {tCommon("articles")}
          </h3>
          <div className="overflow-hidden rounded-xl border shadow-sm">
            {articlesMenu.map((item) => (
              <div
                className="flex flex-col border-b last:border-b-0"
                key={item.title}
              >
                <NavigationLink
                  className="flex cursor-pointer items-center gap-2 p-6 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
                  href={item.href}
                >
                  {!!item.icon && (
                    <HugeIcons className="size-5 shrink-0" icon={item.icon} />
                  )}
                  <h4>{tArticles(item.title)}</h4>
                </NavigationLink>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
