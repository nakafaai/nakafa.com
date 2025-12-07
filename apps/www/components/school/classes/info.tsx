"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import Image from "next/image";
import { useClass } from "@/lib/context/use-class";

export function SchoolClassesHeaderInfo() {
  const classId = useClass((state) => state.class._id);
  const classInfo = useQuery(api.classes.queries.getClassInfo, {
    classId,
  });

  if (!classInfo) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-3">
        <div className="relative h-36 overflow-hidden rounded-md bg-[color-mix(in_oklch,var(--primary)_2.5%,var(--background))]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-3">
      <div className="relative h-36 overflow-hidden rounded-md">
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

        <div className="absolute inset-0 flex flex-col items-start justify-start gap-4 p-4">
          <div className="grid min-w-0 max-w-full rounded-sm border bg-card px-4 py-3 text-card-foreground leading-tight shadow-xs">
            <h1 className="truncate font-medium text-lg">{classInfo.name}</h1>
            <p className="truncate text-muted-foreground">
              {classInfo.subject}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
