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
        color: "#171a17",
        display: "flex",
        height: "100%",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "50px 58px 46px",
          width: "58%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex" }}>
          <svg height="70" viewBox="0 0 96 96" width="70">
            <circle cx="48" cy="48" fill="#171a17" r="45" />
            <circle
              cx="48"
              cy="48"
              fill="none"
              r="39"
              stroke="#f2efe6"
              strokeWidth="2"
            />
            <path
              d="M27 72v-4.4l5.7-2V31L27 29v-4.5h24.7c13.1 0 21 6.1 21 16.4 0 7.8-4.8 13.2-13.3 15.4l10.9 10.5 4.7.9V72H60.2L46.4 57.7h-2.9V65l6.1 2.5V72Zm16.5-19.8h5.8c7.1 0 11-3.6 11-10.6 0-7.5-3.7-11.8-10.8-11.8h-6Z"
              fill="#f2efe6"
            />
            <circle cx="73.5" cy="25.5" fill="#171a17" r="6.5" />
            <circle cx="73.5" cy="25.5" fill="#dfff59" r="4.5" />
          </svg>
          <div
            style={{
              display: "flex",
              fontFamily: "Georgia",
              fontSize: 42,
              marginLeft: 16,
              textTransform: "uppercase",
            }}
          >
            Runscars
          </div>
        </div>
        <div
          style={{
            color: "#7569ff",
            display: "flex",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 4,
            marginTop: 42,
            textTransform: "uppercase",
          }}
        >
          {en ? "Public ballot" : "Quiniela pública"} · Oscar 2027
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Georgia",
            fontSize: 60,
            lineHeight: 1,
            marginTop: 14,
          }}
        >
          {name}
        </div>
        <div
          style={{
            borderBottom: "6px solid #f06c49",
            display: "flex",
            fontSize: 29,
            fontWeight: 700,
            marginTop: 12,
            paddingBottom: 19,
          }}
        >
          {categoryName}
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", marginTop: 20 }}
        >
          {entries.length === 0 ? (
            <div
              style={{
                borderTop: "1px solid #171a17",
                display: "flex",
                fontSize: 25,
                padding: "18px 0",
              }}
            >
              {en ? "Ballot not available" : "Quiniela no disponible"}
            </div>
          ) : null}
          {entries.slice(0, 4).map((entry, index) => (
            <div
              key={entry.id}
              style={{
                alignItems: "center",
                borderTop: "1px solid #171a17",
                display: "flex",
                fontSize: 23,
                minHeight: 57,
              }}
            >
              <span
                style={{
                  alignItems: "center",
                  background:
                    index === 0
                      ? "#dfff59"
                      : index === 1
                        ? "#f4a8bd"
                        : "#85adff",
                  display: "flex",
                  height: 42,
                  justifyContent: "center",
                  marginRight: 16,
                  width: 42,
                }}
              >
                {String(entry.position).padStart(2, "0")}
              </span>
              <span style={{ display: "flex", flex: 1, fontWeight: 700 }}>
                {entry.filmTitle ?? entry.label}
              </span>
              {entry.filmId ? (
                <span
                  style={{
                    background:
                      entry.filmState === "watched" ? "#dfff59" : "#f4a8bd",
                    display: "flex",
                    fontSize: 15,
                    padding: "7px 9px",
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
            color: "#5f645f",
            display: "flex",
            fontSize: 17,
            marginTop: "auto",
          }}
        >
          {en
            ? "Explicit positions · no community consensus"
            : "Posiciones explícitas · sin consenso comunitario"}
        </div>
      </div>
      <div
        style={{
          background: "#171a17",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          padding: "54px 42px",
          position: "relative",
          width: "42%",
        }}
      >
        <div
          style={{
            border: "2px solid #f2efe6",
            borderRadius: "50%",
            display: "flex",
            height: 280,
            left: 75,
            position: "absolute",
            rotate: "-12deg",
            top: 98,
            width: 440,
          }}
        />
        <div
          style={{
            background: "#dfff59",
            border: "4px solid #171a17",
            borderRadius: 99,
            display: "flex",
            height: 32,
            position: "absolute",
            right: 58,
            top: 102,
            width: 32,
          }}
        />
        <div
          style={{
            alignItems: "center",
            background: "#7569ff",
            color: "#f2efe6",
            display: "flex",
            fontFamily: "Georgia",
            fontSize: 145,
            height: 355,
            justifyContent: "center",
            marginLeft: "auto",
            marginTop: 68,
            width: 270,
          }}
        >
          01
        </div>
        {["FUENTE VERIFICADA", "VALOR ORIGINAL CONSERVADO"].map(
          (label, index) => (
            <div
              key={label}
              style={{
                background: "#f2efe6",
                border: "1px solid #171a17",
                color: "#171a17",
                display: "flex",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 1,
                marginLeft: index === 0 ? 0 : 34,
                marginTop: index === 0 ? 26 : 9,
                padding: "18px 20px",
                rotate: index === 0 ? "-2deg" : "2deg",
                width: 350,
              }}
            >
              {String(index + 1).padStart(2, "0")} · {label}
            </div>
          ),
        )}
      </div>
    </div>,
    { ...size },
  );
}
