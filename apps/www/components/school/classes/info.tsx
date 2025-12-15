"use client";

import { api } from "@repo/backend/convex/_generated/api";
import {
  CLASS_IMAGES,
  TEACHER_PERMISSIONS,
} from "@repo/backend/convex/classes/constants";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { useMutation, useQuery } from "convex/react";
import { PaintbrushIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useClass } from "@/lib/context/use-class";

export function SchoolClassesHeaderInfo() {
  const classId = useClass((state) => state.class._id);
  const classInfo = useQuery(api.classes.queries.getClassInfo, {
    classId,
  });

  if (!classInfo) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-3">
        <div className="relative h-48 overflow-hidden rounded-md bg-[color-mix(in_oklch,var(--primary)_2.5%,var(--background))]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-3">
      <div className="relative h-48 overflow-hidden rounded-md">
        <Image
          alt={classInfo.name}
          className="bg-[color-mix(in_oklch,var(--primary)_2.5%,var(--background))] object-cover"
          fill
          loading="eager"
          preload
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          src={classInfo.image}
          title={classInfo.name}
        />

        <div className="absolute top-4 left-4">
          <div className="grid min-w-0 max-w-full rounded-sm border bg-card px-4 py-3 text-card-foreground leading-tight shadow-xs">
            <h1 className="truncate font-medium">{classInfo.name}</h1>
            <p className="truncate text-muted-foreground text-sm">
              {classInfo.subject}
            </p>
          </div>
        </div>

        <div className="absolute right-4 bottom-4">
          <InfoCustomizeButton />
        </div>
      </div>
    </div>
  );
}

function InfoCustomizeButton() {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  // only show if the user is a teacher that has the CLASS_MANAGE permission
  const classMembership = useClass((state) => state.classMembership);
  const classId = useClass((state) => state.class._id);

  const updateClassImage = useMutation(api.classes.mutations.updateClassImage);

  const handleImageClick = (image: string) => {
    startTransition(async () => {
      try {
        await updateClassImage({
          classId,
          image,
        });
      } catch (error) {
        console.error(error);
      }
    });
  };

  if (
    !classMembership?.teacherPermissions?.includes(
      TEACHER_PERMISSIONS.CLASS_MANAGE
    )
  ) {
    return null;
  }

  return (
    <Sheet modal={false} onOpenChange={setOpen} open={open}>
      <SheetTrigger
        render={
          <Button size="sm" variant="outline">
            <PaintbrushIcon />
            {t("customize")}
          </Button>
        }
      />
      <SheetContent className="gap-0" showCloseButton={false}>
        <SheetHeader className="border-b p-3">
          <SheetTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 px-2">
              <PaintbrushIcon className="size-4" />
              {t("customize")}
            </div>

            <div className="flex items-center">
              <Button
                onClick={() => setOpen(false)}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="relative flex size-full flex-col overflow-hidden">
          <div className="scrollbar-hide grid grid-cols-2 gap-3 overflow-y-auto p-6">
            {getImageList().map((image) => (
              <button
                className="relative aspect-video size-full cursor-pointer overflow-hidden rounded-sm border border-transparent transition-[opacity,border-color] ease-out hover:border-primary disabled:pointer-events-none disabled:opacity-50"
                disabled={isPending}
                key={image.value}
                onClick={() => handleImageClick(image.src)}
                type="button"
              >
                <Image
                  alt={image.value}
                  className="object-cover"
                  fill
                  loading="eager"
                  preload
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  src={image.src}
                />
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function getImageList() {
  return Array.from(CLASS_IMAGES.entries()).map(([key, image]) => ({
    value: key,
    src: image,
  }));
}
