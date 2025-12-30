"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  ChatAdd01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
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
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod/mini";
import { getTag, getTagsByRole } from "@/components/school/classes/_data/tag";
import { useClass } from "@/lib/context/use-class";

const MIN_LENGTH = 3;

const formSchema = z.object({
  title: z.string().check(z.minLength(MIN_LENGTH), z.trim()),
  body: z.string().check(z.minLength(MIN_LENGTH), z.trim()),
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

export function SchoolClassesForumNew() {
  const t = useTranslations("School.Classes");

  const [openDialog, setOpenDialog] = useState(false);

  const classId = useClass((c) => c.class._id);
  const classMembership = useClass((c) => c.classMembership);
  const schoolMembership = useClass((c) => c.schoolMembership);
  const createForum = useMutation(api.classes.forums.mutations.createForum);

  // Get available tags based on user role (school admins get all tags)
  const availableTags = getTagsByRole(
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
        await createForum({ ...value, classId });
        setOpenDialog(false);
        form.reset();
      } catch {
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
        <Button onClick={() => setOpenDialog(true)}>
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
          open={openDialog}
          setOpen={setOpenDialog}
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
