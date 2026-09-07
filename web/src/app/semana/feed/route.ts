import {
  getWeeklyReport,
  listDigestWeeks,
} from "../../../lib/discovery/report";
import { escapeXml } from "../../../lib/discovery/weekly";
import { absoluteUrl } from "../../../lib/seo";
import { localizedPath } from "../../../lib/i18n/config";
export async function GET(request: Request) {
  const locale =
    new URL(request.url).searchParams.get("lang") === "en" ? "en" : "es";
  const en = locale === "en";
  const weeks = (await listDigestWeeks()).slice(0, 8);
  const reports = await Promise.all(weeks.map(getWeeklyReport));
  const title = en
    ? "Runscars · The weekly Oscar race"
    : "Runscars · La semana de los Oscar";
  const items = reports
    .filter((report) => report.updatedAt)
    .map((report) => {
      const url = absoluteUrl(localizedPath(`/semana/${report.week}`, locale));
      const description = report.categories
        .filter((item) => item.changes)
        .map(
          (item) =>
            `${en ? item.category.nameEn : item.category.name}: ${item.leader?.label ?? "—"}. ${en ? "Updated sources" : "Fuentes que cambiaron"}: ${item.sources.join(", ")}.`,
        )
        .join(" ");
      return `<item><title>${escapeXml(`${en ? "Week of" : "Semana del"} ${report.week}`)}</title><link>${escapeXml(url)}</link><guid isPermaLink="true">${escapeXml(url)}</guid><pubDate>${new Date(report.updatedAt!).toUTCString()}</pubDate><description>${escapeXml(description)}</description></item>`;
    })
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeXml(title)}</title><link>${escapeXml(absoluteUrl(localizedPath("/semana", locale)))}</link><description>${escapeXml(title)}</description><language>${locale}</language><atom:link href="${escapeXml(absoluteUrl(`/semana/feed?lang=${locale}`))}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
      },
    },
  );
}
