import { SiYoutube } from "@icons-pack/react-simple-icons";
import { YouTubeEmbed } from "@next/third-parties/google";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Link } from "@repo/internationalization/src/navigation";
import { ExternalLinkIcon, HandHeartIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  videoId: string;
}

export function Youtube({ videoId }: Props) {
  const t = useTranslations("Common");
  return (
    <Card className="my-4 grid gap-0 overflow-hidden pb-0">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <SiYoutube />
          YouTube
        </CardTitle>
      </CardHeader>
      <div className="aspect-video">
        <YouTubeEmbed videoid={videoId} />
      </div>
      <CardFooter className="flex-wrap gap-2 border-t pb-6">
        <Button asChild variant="outline">
          <Link
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
          >
            {t("see-on-youtube")}
            <ExternalLinkIcon />
          </Link>
        </Button>
        <Button asChild>
          <Link
            href="https://www.youtube.com/@nakafaa?sub_confirmation=1"
            target="_blank"
          >
            {t("subscribe")}
            <HandHeartIcon />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
