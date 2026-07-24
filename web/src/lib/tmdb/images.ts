const TMDB_IMAGE_PATH = /^\/[A-Za-z0-9._-]+$/;

export function tmdbImageUrl(
  imagePath: string | null,
  size: "w185" | "w342" | "w500" | "w780" = "w500",
) {
  if (!imagePath || !TMDB_IMAGE_PATH.test(imagePath)) {
    return null;
  }

  return `https://image.tmdb.org/t/p/${size}${imagePath}`;
}
