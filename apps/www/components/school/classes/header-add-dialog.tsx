"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  Calendar03Icon,
  Search02Icon,
  Tick01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@repo/design-system/components/ui/autocomplete";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { subjectList } from "@/components/school/classes/_data/subject";
import {
  classCreateDefaultValues,
  classCreateFormSchema,
  classVisibilityList,
} from "@/components/school/classes/header-add-schema";
import { getAcademicYearList } from "@/components/school/classes/header-add-utils";
import { useSchool } from "@/lib/context/use-school";

/** Render the school class creation dialog. */
export function CreateSchoolClassDialog({
  open,
  setOpenAction,
}: {
  open: boolean;
  setOpenAction: (open: boolean) => void;
}) {
  const t = useTranslations("School.Classes");
  const router = useRouter();
  const pathname = usePathname();
  const schoolId = useSchool((state) => state.school._id);
  const createClass = useMutation(api.classes.mutations.createClass);
  const [subjectPopoverOpen, subjectPopoverHandlers] = useDisclosure(false);
  const subjectOptions = subjectList.map((subject) => ({
    label: t(subject),
    value: subject,
  }));
  const subjectGroups = [
    {
      items: subjectOptions,
      value: t("subject-label"),
    },
  ];

  const form = useForm({
    defaultValues: classCreateDefaultValues,
    validators: {
      onChange: classCreateFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const classId = await createClass({
          ...value,
          schoolId,
        });

        router.push(`${pathname}/${classId}`);
        setOpenAction(false);
        form.reset();
      } catch (error) {
        captureException(error, {
          source: "school-class-create",
        });

        toast.error(t("create-class-failed"));
      }
    },
  });

  return (
    <form
      action={() => form.handleSubmit()}
      id="school-classes-header-add-form"
    >
      <ResponsiveDialog
        description={t("create-class-description")}
        footer={
          <form.Subscribe
            selector={(state) => [state.isValid, state.isSubmitting]}
          >
            {([isValid, isSubmitting]) => (
              <Button
                disabled={!isValid || isSubmitting}
                form="school-classes-header-add-form"
                type="submit"
              >
                <Spinner icon={Add01Icon} isLoading={isSubmitting} />
                {t("create")}
              </Button>
            )}
          </form.Subscribe>
        }
        open={open}
        setOpen={setOpenAction}
        title={t("create-class")}
      >
        <FieldGroup>
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="school-classes-header-add-name">
                    {t("name-label")}
                  </FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id="school-classes-header-add-name"
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={t("name-placeholder")}
                    value={field.state.value}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="subject">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="school-classes-header-add-subject">
                    {t("subject-label")}
                  </FieldLabel>
                  <ButtonGroup>
                    <Input
                      aria-invalid={isInvalid}
                      id="school-classes-header-add-subject"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder={t("subject-placeholder")}
                      value={field.state.value}
                    />

                    <Popover
                      onOpenChange={subjectPopoverHandlers.set}
                      open={subjectPopoverOpen}
                    >
                      <PopoverTrigger
                        render={
                          <Button
                            aria-label="Select subject"
                            size="icon"
                            type="button"
                            variant="outline"
                          />
                        }
                      >
                        <HugeIcons
                          className={cn(
                            "transition-transform ease-out",
                            subjectPopoverOpen && "rotate-180"
                          )}
                          icon={ArrowDown01Icon}
                        />
                      </PopoverTrigger>
                      <PopoverContent align="end" className="p-0">
                        <Autocomplete
                          autoHighlight="always"
                          inline
                          items={subjectGroups}
                          keepHighlight
                          open
                        >
                          <AutocompleteInput
                            className="h-9 rounded-none border-x-0 border-t-0 border-b shadow-none focus-visible:border-border focus-visible:ring-0"
                            placeholder={t("search-subjects-placeholder")}
                            showClear
                            startAddon={
                              <HugeIcons
                                className="size-4"
                                icon={Search02Icon}
                              />
                            }
                          />
                          <AutocompleteEmpty>
                            {t("no-subjects-found")}
                          </AutocompleteEmpty>
                          <AutocompleteList
                            className="max-h-75"
                            scrollArea={false}
                          >
                            {(group) => (
                              <AutocompleteGroup
                                items={group.items}
                                key={group.value}
                              >
                                <AutocompleteCollection>
                                  {(subject) => (
                                    <AutocompleteItem
                                      className="min-h-8 cursor-pointer py-1.5 text-sm sm:min-h-8"
                                      key={subject.value}
                                      onClick={() => {
                                        field.handleChange(subject.label);
                                        subjectPopoverHandlers.close();
                                      }}
                                      value={subject}
                                    >
                                      <span>{subject.label}</span>
                                      <HugeIcons
                                        className={cn(
                                          "ml-auto size-4 opacity-0 transition-opacity ease-out",
                                          field.state.value === subject.label &&
                                            "opacity-100"
                                        )}
                                        icon={Tick01Icon}
                                      />
                                    </AutocompleteItem>
                                  )}
                                </AutocompleteCollection>
                              </AutocompleteGroup>
                            )}
                          </AutocompleteList>
                        </Autocomplete>
                      </PopoverContent>
                    </Popover>
                  </ButtonGroup>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="year">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="school-classes-header-add-year">
                    {t("year-label")}
                  </FieldLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          aria-invalid={isInvalid}
                          className="w-full font-normal"
                          id="school-classes-header-add-year"
                          name={field.name}
                          type="button"
                          variant="outline"
                        >
                          <HugeIcons icon={Calendar03Icon} />
                          {field.state.value || t("year-placeholder")}
                          <HugeIcons
                            className="ml-auto"
                            icon={ArrowDown01Icon}
                          />
                        </Button>
                      }
                    />
                    <DropdownMenuContent
                      align="start"
                      className="w-(--anchor-width)"
                    >
                      {getAcademicYearList().map((year) => (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          key={year}
                          onClick={() => field.handleChange(year)}
                        >
                          {year}
                          <HugeIcons
                            className={cn(
                              "ml-auto size-4 opacity-0 transition-opacity ease-out",
                              field.state.value === year && "opacity-100"
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

          <form.Field name="visibility">
            {(field) => {
              const isInvalid =
                Boolean(field.state.meta.isTouched) &&
                Boolean(!field.state.meta.isValid);

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor="school-classes-header-add-visibility">
                    {t("visibility-label")}
                  </FieldLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          aria-invalid={isInvalid}
                          className="w-full font-normal"
                          id="school-classes-header-add-visibility"
                          name={field.name}
                          type="button"
                          variant="outline"
                        >
                          <HugeIcons icon={ViewIcon} />
                          {t(field.state.value)}
                          <HugeIcons
                            className="ml-auto"
                            icon={ArrowDown01Icon}
                          />
                        </Button>
                      }
                    />
                    <DropdownMenuContent
                      align="start"
                      className="w-(--anchor-width)"
                    >
                      {classVisibilityList.map((visibility) => (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          key={visibility}
                          onClick={() => field.handleChange(visibility)}
                        >
                          {t(visibility)}
                          <HugeIcons
                            className={cn(
                              "ml-auto size-4 opacity-0 transition-opacity ease-out",
                              field.state.value === visibility && "opacity-100"
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
    </form>
  );
}
