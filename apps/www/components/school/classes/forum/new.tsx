"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  ChatAdd01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import { MIN_FORUM_THREAD_TEXT_LENGTH } from "@repo/backend/convex/classes/forums/utils/constants";
import { PERMISSIONS } from "@repo/backend/convex/lib/helpers/permissions";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import * as z from "zod/mini";
import { getTag, getTagsByRole } from "@/components/school/classes/_data/tag";
import { getSchoolClassesForumHref } from "@/components/school/classes/forum/helpers/routes";
import { useClass } from "@/lib/context/use-class";
import { useClassPermissions } from "@/lib/hooks/use-class-permissions";

const formSchema = z.object({
  title: z.string().check(z.minLength(MIN_FORUM_THREAD_TEXT_LENGTH), z.trim()),
  body: z.string().check(z.minLength(MIN_FORUM_THREAD_TEXT_LENGTH), z.trim()),
  tag: z.union([
    z.literal("general"),
    z.literal("question"),
    z.literal("announcement"),
    z.literal("assignment"),
    z.literal("resource"),
  ]),
});

const defaultValues: z.infer<typeof formSchema> = {
  title: "",
  body: "",
  tag: "general",
};

/** Render the create-forum dialog and submit it through the class forum API. */
export function SchoolClassesForumNew() {
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
      try {
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
      } catch (error) {
        captureException(error, {
          source: "school-forum-create",
        });

        toast.error(t("create-forum-failed"));
      }
    },
  });

  return (
    <form
      id="school-classes-forum-new-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <ButtonGroup>
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
          <FieldGroup>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
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
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-(--radix-dropdown-menu-trigger-width)"
                      >
                        {availableTags.map((tag) => (
                          <DropdownMenuItem
                            className="cursor-pointer"
                            key={tag.value}
                            onSelect={() => field.handleChange(tag.value)}
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
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Field>
                );
              }}
            </form.Field>
          </FieldGroup>
        </ResponsiveDialog>
      </ButtonGroup>
    </form>
  );
}
