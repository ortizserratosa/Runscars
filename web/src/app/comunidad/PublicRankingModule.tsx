import { listPublicRankings } from "../../lib/repositories/community";
import { getRequestLocale } from "../../lib/i18n/server";
import { PublicRankingView } from "./PublicRankingView";

export async function PublicRankingModule({
  categoryId,
  categoryName,
}: {
  categoryId: string;
  categoryName: string;
}) {
  const [result, locale] = await Promise.all([
    listPublicRankings({ seasonId: "oscars-2027", categoryId }),
    getRequestLocale(),
  ]);
  return (
    <PublicRankingView
      categoryId={categoryId}
      categoryName={categoryName}
      locale={locale}
      result={result}
    />
  );
}
