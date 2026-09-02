type BrandMarkProps = {
  className?: string;
  inverse?: boolean;
  title?: string;
};

export function BrandMark({
  className = "",
  inverse = false,
  title,
}: BrandMarkProps) {
  const labelled = Boolean(title);
  return (
    <svg
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
      className={`brand-mark${inverse ? " brand-mark--inverse" : ""}${className ? ` ${className}` : ""}`}
      role={labelled ? "img" : undefined}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <circle className="brand-mark__disc" cx="48" cy="48" r="45" />
      <circle className="brand-mark__keyline" cx="48" cy="48" r="40" />
      <g className="brand-mark__aperture">
        <path d="M48 9a39 39 0 0 1 33.8 19.5L56.3 41.2a12.5 12.5 0 0 0-12-6.7Z" />
        <path d="M81.8 28.5a39 39 0 0 1 0 39L57 53.7a12.5 12.5 0 0 0-.7-12.5Z" />
        <path d="M81.8 67.5A39 39 0 0 1 48 87l1.3-28.3A12.5 12.5 0 0 0 57 53.7Z" />
        <path d="M48 87a39 39 0 0 1-33.8-19.5l25.5-12.7a12.5 12.5 0 0 0 9.6 3.9Z" />
        <path d="M14.2 67.5a39 39 0 0 1 0-39L39 42.3a12.5 12.5 0 0 0 .7 12.5Z" />
        <path d="M14.2 28.5A39 39 0 0 1 48 9l-1.3 28.3A12.5 12.5 0 0 0 39 42.3Z" />
      </g>
      <path
        className="brand-mark__letter"
        d="M27 72v-4.4l5.7-2V31L27 29v-4.5h24.7c13.1 0 21 6.1 21 16.4 0 7.8-4.8 13.2-13.3 15.4l10.9 10.5 4.7.9V72H60.2L46.4 57.7h-2.9V65l6.1 2.5V72Zm16.5-19.8h5.8c7.1 0 11-3.6 11-10.6 0-7.5-3.7-11.8-10.8-11.8h-6Z"
      />
      <circle className="brand-mark__dot-keyline" cx="73.5" cy="25.5" r="6" />
      <circle className="brand-mark__dot" cx="73.5" cy="25.5" r="4.4" />
    </svg>
  );
}

type BrandLogoProps = {
  compact?: boolean;
  inverse?: boolean;
  tagline?: string;
};

export function BrandLogo({
  compact = false,
  inverse = false,
  tagline,
}: BrandLogoProps) {
  return (
    <span
      className={`brand-logo${compact ? " brand-logo--compact" : ""}${inverse ? " brand-logo--inverse" : ""}`}
    >
      <BrandMark inverse={inverse} />
      <span className="brand-logo__type">
        <span className="brand-logo__word">Runscars</span>
        {tagline ? (
          <span className="brand-logo__tagline">{tagline}</span>
        ) : null}
      </span>
    </span>
  );
}
