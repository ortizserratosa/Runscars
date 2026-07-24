type PosterBlockProps = {
  title: string;
  tone?: string;
  number?: string;
  size?: "small" | "medium" | "large";
};

export function PosterBlock({
  title,
  tone = "violet",
  number,
  size = "medium",
}: PosterBlockProps) {
  const words = title.split(" ");
  return (
    <div className={`poster-block poster-${tone} poster-${size}`} aria-label={`Marcador visual de ${title}`}>
      {number ? <span className="poster-rank">{number}</span> : null}
      <span className="poster-orbit" aria-hidden="true" />
      <span className="poster-title">
        {words.map((word) => (
          <span key={word}>{word}</span>
        ))}
      </span>
      <span className="poster-edition">OSCAR · 2027</span>
    </div>
  );
}
