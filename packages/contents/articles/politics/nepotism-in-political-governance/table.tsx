import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { useTranslations } from "next-intl";

type Props = {
  caption: string;
};

export function StateTable({ caption }: Props) {
  const t = useTranslations("Common");
  return (
    <div className="grid grid-cols-1">
      <Table containerClassName="scrollbar-hide">
        <TableCaption>{caption}</TableCaption>
        <TableHeader className="border-x border-t bg-muted/50">
          <TableRow>
            <TableHead className="border-r text-center">
              {t("country")}
            </TableHead>
            <TableHead className="border-r text-center">
              {t("judicial-efficiency-index")}
            </TableHead>
            <TableHead className="border-r text-center">
              {t("corruption-index")}
            </TableHead>
            <TableHead className="border-r text-center">
              {t("good-governance-index")}
            </TableHead>
            <TableHead className="text-center">
              {t("governance-quality-category")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="border-x border-b">
          <TableRow>
            <TableCell className="border-r bg-muted/50 text-center font-medium">
              Malaysia
            </TableCell>
            <TableCell className="border-r text-center">9,00</TableCell>
            <TableCell className="border-r text-center">7,38</TableCell>
            <TableCell className="border-r text-center">7,22</TableCell>
            <TableCell className="text-center">{t("good")}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r bg-muted/50 text-center font-medium">
              Singapore
            </TableCell>
            <TableCell className="border-r text-center">10,00</TableCell>
            <TableCell className="border-r text-center">8,22</TableCell>
            <TableCell className="border-r text-center">8,93</TableCell>
            <TableCell className="text-center">{t("good")}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r bg-muted/50 text-center font-medium">
              Thailand
            </TableCell>
            <TableCell className="border-r text-center">3,25</TableCell>
            <TableCell className="border-r text-center">5,18</TableCell>
            <TableCell className="border-r text-center">4,89</TableCell>
            <TableCell className="text-center">{t("medium")}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r bg-muted/50 text-center font-medium">
              Philippines
            </TableCell>
            <TableCell className="border-r text-center">4,75</TableCell>
            <TableCell className="border-r text-center">7,92</TableCell>
            <TableCell className="border-r text-center">3,47</TableCell>
            <TableCell className="text-center">{t("medium")}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r bg-muted/50 text-center font-medium">
              Indonesia
            </TableCell>
            <TableCell className="border-r text-center">2,50</TableCell>
            <TableCell className="border-r text-center">2,15</TableCell>
            <TableCell className="border-r text-center">2,88</TableCell>
            <TableCell className="text-center">{t("low")}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
