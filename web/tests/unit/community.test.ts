import { describe, expect, it } from "vitest";
import {
  parseCandidateIds,
  profileSchema,
  rankingSchema,
} from "../../src/lib/community/validation";

describe("community input contracts", () => {
  it("accepts an explicit partial ranking without inferring missing positions", () => {
    const candidateIds = parseCandidateIds(
      JSON.stringify(["candidate-one", "candidate-three"]),
    );
    const ranking = rankingSchema.parse({
      seasonId: "oscars-2027",
      categoryId: "best-picture",
      candidateIds,
      isPublic: false,
    });

    expect(ranking.candidateIds).toEqual(["candidate-one", "candidate-three"]);
  });

  it("rejects repeated candidates and malformed ranking payloads", () => {
    expect(
      rankingSchema.safeParse({
        seasonId: "oscars-2027",
        categoryId: "best-picture",
        candidateIds: ["candidate-one", "candidate-one"],
        isPublic: true,
      }).success,
    ).toBe(false);
    expect(parseCandidateIds("{not-json")).toEqual([]);
  });

  it("keeps public watched history behind an explicitly public profile", () => {
    const privateProfile = profileSchema.safeParse({
      displayName: "Usuario Runscars",
      slug: "usuario-runscars",
      isPublic: false,
      watchedIsPublic: true,
    });
    expect(privateProfile.success).toBe(false);
  });
});
