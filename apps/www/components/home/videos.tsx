import { SiYoutube } from "@icons-pack/react-simple-icons";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function Videos() {
  const t = useTranslations("Videos");

  return (
    <VideoCard>
      <div />

      <div className="mx-auto w-fit rounded-sm bg-card/80 px-3 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <SiYoutube className="hidden size-4 sm:block" />
          <span className="text-pretty text-xs">{t("discover")}</span>
        </div>
      </div>
    </VideoCard>
  );
}

function VideoCard({ children }: { children: React.ReactNode }) {
  return (
    <Link
      className="group relative flex aspect-square overflow-hidden rounded-md border p-3 text-card-foreground shadow-xs"
      href="https://www.youtube.com/@nakafaa"
      target="_blank"
    >
      <Image
        alt="Video Thumbnail"
        className="absolute inset-0 object-cover transition-transform duration-300 group-hover:scale-105"
        fill
        loading="eager"
        preload
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        src="/stars.png"
      />
      <div className="relative z-1 flex flex-1 flex-col justify-between">
        {children}
      </div>
    </Link>
  );
}
