import { categoryById } from "../../../../lib/categories/config";
import { listPublicRankings } from "../../../../lib/repositories/community";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const category = categoryById(
    new URL(request.url).searchParams.get("categoria") ?? "",
  );
  if (!category)
    return Response.json({ error: "Not found" }, { status: 404, headers });
  try {
    // Anonymous/RLS-filtered reader: never serialize account IDs or a private
    // ranking into the professional HTML or a public response cache.
    const result = await listPublicRankings({
      seasonId: "oscars-2027",
      categoryId: category.id,
    });
    return Response.json(
      {
        total: result.total,
        rankings: result.rankings.slice(0, 3).map((ranking) => ({
          id: ranking.id,
          categorySlug: ranking.categorySlug,
          profile: {
            slug: ranking.profile.slug,
            displayName: ranking.profile.displayName,
            initials: ranking.profile.initials,
          },
          entriesCount: ranking.entriesCount,
          watchedCount: ranking.watchedCount,
        })),
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Public ballots unavailable" },
      { status: 503, headers },
    );
  }
}
