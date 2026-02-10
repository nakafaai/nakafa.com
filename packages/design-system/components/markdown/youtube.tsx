import { ArrowUpRight01Icon, InLoveIcon } from "@hugeicons/core-free-icons";
import { SiYoutube } from "@icons-pack/react-simple-icons";
import { YouTubeEmbed } from "@next/third-parties/google";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

interface Props {
  videoId: string;
}

export function Youtube({ videoId }: Props) {
  const t = useTranslations("Common");
  return (
    <Card className="my-4 grid gap-0 overflow-hidden pb-0">
      <CardHeader className="gap-0 border-b">
        <CardTitle className="flex items-center gap-2">
          <SiYoutube />
          YouTube
        </CardTitle>
      </CardHeader>
      <div className="aspect-video">
        <YouTubeEmbed videoid={videoId} />
      </div>
      <CardFooter className="flex-wrap gap-2 border-t pb-6">
        <Button
          nativeButton={false}
          render={
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("see-on-youtube")}
              <HugeIcons icon={ArrowUpRight01Icon} />
            </a>
          }
          variant="outline"
        />
        <Button
          nativeButton={false}
          render={
            <a
              href="https://www.youtube.com/@nakafaa?sub_confirmation=1"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("subscribe")}
              <HugeIcons icon={InLoveIcon} />
            </a>
          }
        />
      </CardFooter>
    </Card>
  );
}
