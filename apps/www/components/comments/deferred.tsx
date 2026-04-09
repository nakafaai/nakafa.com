"use client";

import dynamic from "next/dynamic";

export const DeferredComments = dynamic(
  () => import("@/components/comments").then((module) => module.Comments),
  {
    ssr: false,
    loading: () => null,
  }
);
