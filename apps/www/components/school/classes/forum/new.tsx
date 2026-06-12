"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  ChatAdd01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { MIN_FORUM_THREAD_TEXT_LENGTH } from "@repo/backend/convex/classes/forums/utils/constants";
import { PERMISSIONS } from "@repo/backend/convex/lib/helpers/permissions";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/overlays/responsive-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Group } from "@repo/design-system/components/ui/group";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@repo/design-system/components/ui/menu";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { toastManager } from "@repo/design-system/components/ui/toast";
import { cn } from "@repo/design-system/lib/utils";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Effect, Schema } from "effect";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { getTag, getTagsByRole } from "@/components/school/classes/_data/tag";
import { getSchoolClassesForumHref } from "@/components/school/classes/forum/helpers/routes";
import { reportClientException } from "@/lib/analytics/client";
import { useClass } from "@/lib/context/use-class";
import { useClassPermissions } from "@/lib/hooks/use-class-permissions";

const form = Schema.Struct({
  title: Schema.Trim.pipe(Schema.minLength(MIN_FORUM_THREAD_TEXT_LENGTH)),
  body: Schema.Trim.pipe(Schema.minLength(MIN_FORUM_THREAD_TEXT_LENGTH)),
  tag: Schema.Literal(
    "general",
    "question",
    "announcement",
    "assignment",
    "resource"
  ),
});

const formSchema = Schema.standardSchemaV1(form);

const defaultValues: Schema.Schema.Encoded<typeof form> = {
  title: "",
  body: "",
  tag: "general",
};

/** Render the create-forum dialog and submit it through the class forum API. */
export function SchoolClassesForumNew() {
  return (
    <Suspense fallback={null}>
      <SchoolClassesForumNewContent />
    </Suspense>
  );
}

function SchoolClassesForumNewContent() {
  const t = useTranslations("School.Classes");
  const router = useRouter();
  const routeParams = useParams<{ id: string; slug: string }>();
  const searchParams = useSearchParams();

  const [isDialogOpen, dialog] = useDisclosure(false);

  const classId = useClass((c) => c.class._id);
  const classMembership = useClass((c) => c.classMembership);
  const schoolMembership = useClass((c) => c.schoolMembership);
  const { can } = useClassPermissions();
  const createForum = useMutation(
    api.classes.forums.mutations.forums.createForum
  );

  const canModerateForum = can(PERMISSIONS.FORUM_MODERATE);

  // Get available tags based on the same permission split enforced by Convex.
  const availableTags = getTagsByRole(
    canModerateForum,
    classMembership?.role ?? "student",
    schoolMembership?.role ?? "student"
  );

  const form = useForm({
    defaultValues,
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: async () => {
            const forumId = await createForum({ ...value, classId });
            const href = getSchoolClassesForumHref({
              classRouteId: routeParams.id,
              forumId,
              queryString: searchParams.toString(),
              slug: routeParams.slug,
            });

            dialog.close();
            form.reset();
            router.push(href);
          },
          catch: (error) => error,
        }).pipe(
          Effect.catchAll((error) =>
            reportClientException(error, {
              source: "school-forum-create",
            }).pipe(
              Effect.zipRight(
                Effect.sync(() => {
                  toastManager.add({
                    type: "error",
                    title: t("create-forum-failed"),
                  });
                })
              )
            )
          )
        )
      );
    },
  });

  return (
    <form action={() => form.handleSubmit()} id="school-classes-forum-new-form">
      <Group>
        <Button onClick={dialog.open} type="button">
          <HugeIcons icon={ChatAdd01Icon} />
          {t("new-forum")}
        </Button>

        <ResponsiveDialog
          description={t("new-forum-description")}
          footer={
            <form.Subscribe
              selector={(state) => [state.isValid, state.isSubmitting]}
            >
              {([isValid, isSubmitting]) => (
                <Button
                  disabled={!isValid || isSubmitting}
                  form="school-classes-forum-new-form"
                  type="submit"
                >
                  <Spinner icon={Add01Icon} isLoading={isSubmitting} />
                  {t("create")}
                </Button>
              )}
            </form.Subscribe>
          }
          open={isDialogOpen}
          setOpen={(open) => {
            if (open) {
              dialog.open();
              return;
            }

            dialog.close();
          }}
          title={t("new-forum-title")}
        >
          <div className="flex w-full flex-col gap-3">
            <form.Field name="title">
              {(field) => {
                const isInvalid =
                  Boolean(field.state.meta.isTouched) &&
                  Boolean(!field.state.meta.isValid);
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="school-classes-forum-new-title">
                      {t("forum-title-label")}
                    </FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id="school-classes-forum-new-title"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("forum-title-placeholder")}
                      value={field.state.value}
                    />
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="body">
              {(field) => {
                const isInvalid =
                  Boolean(field.state.meta.isTouched) &&
                  Boolean(!field.state.meta.isValid);
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="school-classes-forum-new-body">
                      {t("forum-body-label")}
                    </FieldLabel>
                    <Textarea
                      aria-invalid={isInvalid}
                      className="min-h-24"
                      id="school-classes-forum-new-body"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("forum-body-placeholder")}
                      value={field.state.value}
                    />
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="tag">
              {(field) => {
                const isInvalid =
                  Boolean(field.state.meta.isTouched) &&
                  Boolean(!field.state.meta.isValid);

                const currentTag = getTag(field.state.value);
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="school-classes-forum-new-tag">
                      {t("tag-label")}
                    </FieldLabel>
                    <Menu>
                      <MenuTrigger
                        render={
                          <Button
                            aria-invalid={isInvalid}
                            className="w-full font-normal"
                            id="school-classes-forum-new-tag"
                            name={field.name}
                            variant="outline"
                          >
                            <HugeIcons icon={currentTag.icon} />
                            {t(currentTag.value)}
                            <HugeIcons
                              className="ml-auto"
                              icon={ArrowDown01Icon}
                            />
                          </Button>
                        }
                      />
                      <MenuPopup align="start" className="w-(--anchor-width)">
                        {availableTags.map((tag) => (
                          <MenuItem
                            key={tag.value}
                            onClick={() => field.handleChange(tag.value)}
                          >
                            <HugeIcons icon={tag.icon} />
                            {t(tag.value)}
                            <HugeIcons
                              className={cn(
                                "ml-auto size-4 opacity-0 transition-opacity ease-out",
                                field.state.value === tag.value && "opacity-100"
                              )}
                              icon={Tick01Icon}
                            />
                          </MenuItem>
                        ))}
                      </MenuPopup>
                    </Menu>
                  </Field>
                );
              }}
            </form.Field>
          </div>
        </ResponsiveDialog>
      </Group>
    </form>
  );
}
