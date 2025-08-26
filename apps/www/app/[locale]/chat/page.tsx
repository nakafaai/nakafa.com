"use client";

import { Authenticated } from "convex/react";
import { AiChat } from "@/components/ai/chat";

export default function Page() {
  return (
    <Authenticated>
      <AiChat />
    </Authenticated>
  );
}
