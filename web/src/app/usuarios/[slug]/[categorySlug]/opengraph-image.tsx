import { ImageResponse } from "next/og";
import { categoryBySlug } from "../../../../lib/categories/config";
import { getPublicRanking } from "../../../../lib/repositories/community";
import { localizedCategoryName } from "../../../../lib/i18n/categories";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const alt = "Quiniela pública de Runscars";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type OgImageProps = {
  params: Promise<{ slug: string; categorySlug: string }>;
};

export default async function OpenGraphImage({ params }: OgImageProps) {
  const { slug, categorySlug } = await params;
  const locale = await getRequestLocale();
  const en = locale === "en";
  const category = categoryBySlug(categorySlug);
  const ranking = category
    ? await getPublicRanking({
        slug,
        seasonId: "oscars-2027",
        categoryId: category.id,
      })
    : null;
  const entries = ranking?.entries.slice(0, 5) ?? [];
  const name = ranking?.profile.displayName ?? "Runscars";
  const categoryName = ranking
    ? localizedCategoryName(locale, ranking.categoryId, ranking.categoryName)
    : en
      ? "Public ballot"
      : "Quiniela pública";
  const labels = {
    watched: en ? "Watched" : "Vista",
    not_watched: en ? "Not watched" : "No vista",
    unmarked: en ? "Unmarked" : "No indicada",
  } as const;

  return new ImageResponse(
    <div
      style={{
        background: "#f2efe6",
        color: "#1a1a19",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "58px 68px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", fontSize: 24, letterSpacing: 4 }}>
        RUNSCARS · {en ? "PUBLIC BALLOT" : "QUINIELA PÚBLICA"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
        <div style={{ color: "#6e675f", display: "flex", fontSize: 25 }}>
          {name} · OSCAR 2027
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            marginTop: 8,
          }}
        >
          {categoryName}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 42 }}>
        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              alignItems: "center",
              borderTop: "2px solid #d5cfc4",
              display: "flex",
              fontSize: 28,
              padding: "14px 0",
            }}
          >
            <span style={{ color: "#6e675f", display: "flex", width: 62 }}>
              {String(entry.position).padStart(2, "0")}
            </span>
            <span style={{ display: "flex", flex: 1, fontWeight: 700 }}>
              {entry.filmTitle ?? entry.label}
            </span>
            {entry.filmId ? (
              <span
                style={{
                  background:
                    entry.filmState === "watched" ? "#d8f26a" : "#e7d9ff",
                  display: "flex",
                  fontSize: 21,
                  padding: "8px 13px",
                }}
              >
                {labels[entry.filmState]}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div
        style={{
          color: "#6e675f",
          display: "flex",
          fontSize: 22,
          marginTop: "auto",
        }}
      >
        {en
          ? "Explicit positions · no community consensus"
          : "Posiciones explícitas · sin consenso comunitario"}
      </div>
    </div>,
    { ...size },
  );
}
