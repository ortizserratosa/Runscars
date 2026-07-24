import Image from "next/image";
import { tmdbImageUrl } from "../../lib/tmdb/images";

type PosterBlockProps = {
  title: string;
  tone?: string;
  number?: string;
  size?: "small" | "medium" | "large";
  imagePath?: string | null;
};

export function PosterBlock({
  title,
  tone = "violet",
  number,
  size = "medium",
  imagePath = null,
}: PosterBlockProps) {
  const words = title.split(" ");
  const imageUrl = tmdbImageUrl(imagePath);
  return (
    <div
      className={`poster-block poster-${tone} poster-${size}${imageUrl ? " poster-with-image" : ""}`}
      aria-label={
        imageUrl ? `Póster de ${title}` : `Marcador visual de ${title}`
      }
    >
      {imageUrl ? (
        <Image
          alt=""
          className="poster-image"
          fill
          priority={size === "large"}
          sizes={
            size === "large"
              ? "(max-width: 760px) 82vw, 390px"
              : "(max-width: 760px) 42vw, 240px"
          }
          src={imageUrl}
        />
      ) : null}
      {number ? <span className="poster-rank">{number}</span> : null}
      <span className="poster-orbit" aria-hidden="true" />
      <span className={`poster-title${imageUrl ? " visually-hidden" : ""}`}>
        {words.map((word) => (
          <span key={word}>{word}</span>
        ))}
      </span>
      <span className="poster-edition">OSCAR · 2027</span>
    </div>
  );
}
