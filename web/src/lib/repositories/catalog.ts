import "server-only";
import { filmFixtures, findFilmById } from "../../data/films";
import { isSupabaseConfigured } from "../environment";
import { createSupabaseServerClient } from "../supabase/server";

type Genre = {
  id: number;
  name: string;
};

export type CatalogCredit = {
  personId: string;
  name: string;
  kind: "cast" | "crew";
  role: string;
  department: string | null;
  billingOrder: number | null;
  profilePath: string | null;
};

export type FilmCatalogDetail = {
  id: string;
  title: string;
  alternateTitles: string[];
  releaseStatus: "released" | "upcoming";
  editorialReleaseDate: string | null;
  verificationUrl: string;
  notes: string | null;
  tmdb: {
    id: number;
    localizedTitle: string;
    originalTitle: string;
    originalLanguage: string | null;
    overview: string | null;
    releaseDate: string | null;
    runtime: number | null;
    status: string | null;
    tagline: string | null;
    imdbId: string | null;
    posterPath: string | null;
    backdropPath: string | null;
    genres: Genre[];
    fetchedAt: string;
    expiresAt: string;
    url: string;
  } | null;
  credits: CatalogCredit[];
};

export type PersonCatalogDetail = {
  id: string;
  name: string;
  tmdb: {
    id: number;
    originalName: string | null;
    knownForDepartment: string | null;
    biography: string | null;
    birthday: string | null;
    deathday: string | null;
    placeOfBirth: string | null;
    homepageUrl: string | null;
    imdbId: string | null;
    profilePath: string | null;
    fetchedAt: string;
    expiresAt: string;
    url: string;
  };
  films: Array<{
    id: string;
    title: string;
    roles: string[];
  }>;
};

function genresFromJson(value: unknown): Genre[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((genre) => {
    if (
      typeof genre === "object" &&
      genre !== null &&
      typeof genre.id === "number" &&
      typeof genre.name === "string"
    ) {
      return [{ id: genre.id, name: genre.name }];
    }
    return [];
  });
}

function fixtureDetail(slug: string): FilmCatalogDetail | null {
  const fixture = findFilmById(slug);
  if (!fixture) {
    return null;
  }

  return {
    id: fixture.id,
    title: fixture.title,
    alternateTitles: fixture.alternateTitles,
    releaseStatus: fixture.releaseStatus,
    editorialReleaseDate: fixture.releaseDate,
    verificationUrl: fixture.verificationUrl,
    notes: fixture.notes,
    tmdb: null,
    credits: [],
  };
}

export async function getFilmCatalogDetail(
  slug: string,
): Promise<FilmCatalogDetail | null> {
  const fallback = fixtureDetail(slug);
  if (!fallback || !isSupabaseConfigured()) {
    return fallback;
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: film, error: filmError } = await supabase
      .from("films")
      .select(
        "id, title, alternate_titles, release_status, release_date, verification_url, notes, tmdb_id",
      )
      .eq("id", slug)
      .maybeSingle();

    if (filmError || !film) {
      return fallback;
    }

    const detail: FilmCatalogDetail = {
      id: film.id,
      title: film.title,
      alternateTitles: film.alternate_titles,
      releaseStatus:
        film.release_status === "released" ? "released" : "upcoming",
      editorialReleaseDate: film.release_date,
      verificationUrl: film.verification_url ?? fallback.verificationUrl,
      notes: film.notes,
      tmdb: null,
      credits: [],
    };

    if (!film.tmdb_id) {
      return detail;
    }

    const now = new Date().toISOString();
    const { data: snapshot, error: snapshotError } = await supabase
      .from("tmdb_movie_snapshots")
      .select(
        "tmdb_id, title, original_title, original_language, overview, release_date, runtime, status, tagline, imdb_id, poster_path, backdrop_path, genres, fetched_at, expires_at",
      )
      .eq("tmdb_id", film.tmdb_id)
      .eq("locale", "es-ES")
      .gt("expires_at", now)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError || !snapshot) {
      return detail;
    }

    detail.tmdb = {
      id: snapshot.tmdb_id,
      localizedTitle: snapshot.title,
      originalTitle: snapshot.original_title,
      originalLanguage: snapshot.original_language,
      overview: snapshot.overview,
      releaseDate: snapshot.release_date,
      runtime: snapshot.runtime,
      status: snapshot.status,
      tagline: snapshot.tagline,
      imdbId: snapshot.imdb_id,
      posterPath: snapshot.poster_path,
      backdropPath: snapshot.backdrop_path,
      genres: genresFromJson(snapshot.genres),
      fetchedAt: snapshot.fetched_at,
      expiresAt: snapshot.expires_at,
      url: `https://www.themoviedb.org/movie/${snapshot.tmdb_id}`,
    };

    const { data: creditRows, error: creditsError } = await supabase
      .from("film_credits")
      .select(
        "person_id, credit_kind, role, department, billing_order, tmdb_credit_id",
      )
      .eq("film_id", film.id)
      .order("credit_kind")
      .order("billing_order", { nullsFirst: false });

    if (creditsError || creditRows.length === 0) {
      return detail;
    }

    const personIds = [
      ...new Set(creditRows.map((credit) => credit.person_id)),
    ];
    const { data: people, error: peopleError } = await supabase
      .from("people")
      .select("id, name, tmdb_id")
      .in("id", personIds);

    if (peopleError || people.length === 0) {
      return detail;
    }

    const tmdbPersonIds = people.map((person) => person.tmdb_id);
    const { data: personSnapshots } = await supabase
      .from("tmdb_person_snapshots")
      .select("tmdb_id, profile_path, fetched_at")
      .in("tmdb_id", tmdbPersonIds)
      .eq("locale", "es-ES")
      .gt("expires_at", now)
      .order("fetched_at", { ascending: false });

    const profileByTmdbId = new Map<number, string | null>();
    for (const personSnapshot of personSnapshots ?? []) {
      if (!profileByTmdbId.has(personSnapshot.tmdb_id)) {
        profileByTmdbId.set(
          personSnapshot.tmdb_id,
          personSnapshot.profile_path,
        );
      }
    }

    const personById = new Map(people.map((person) => [person.id, person]));
    detail.credits = creditRows.flatMap((credit) => {
      const person = personById.get(credit.person_id);
      if (!person) {
        return [];
      }

      return [
        {
          personId: person.id,
          name: person.name,
          kind: credit.credit_kind,
          role: credit.role,
          department: credit.department,
          billingOrder: credit.billing_order,
          profilePath: profileByTmdbId.get(person.tmdb_id) ?? null,
        },
      ];
    });

    return detail;
  } catch {
    return fallback;
  }
}

export async function getPersonCatalogDetail(
  personId: string,
): Promise<PersonCatalogDetail | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("id, name, tmdb_id")
      .eq("id", personId)
      .maybeSingle();

    if (personError || !person) {
      return null;
    }

    const { data: snapshot, error: snapshotError } = await supabase
      .from("tmdb_person_snapshots")
      .select(
        "tmdb_id, original_name, known_for_department, biography, birthday, deathday, place_of_birth, homepage_url, imdb_id, profile_path, fetched_at, expires_at",
      )
      .eq("tmdb_id", person.tmdb_id)
      .eq("locale", "es-ES")
      .gt("expires_at", new Date().toISOString())
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError || !snapshot) {
      return null;
    }

    const { data: creditRows, error: creditsError } = await supabase
      .from("film_credits")
      .select("film_id, role")
      .eq("person_id", person.id);

    if (creditsError) {
      return null;
    }

    const filmIds = [...new Set(creditRows.map((credit) => credit.film_id))];
    const { data: films } =
      filmIds.length === 0
        ? { data: [] }
        : await supabase.from("films").select("id, title").in("id", filmIds);
    const rolesByFilmId = new Map<string, string[]>();
    for (const credit of creditRows) {
      const roles = rolesByFilmId.get(credit.film_id) ?? [];
      roles.push(credit.role);
      rolesByFilmId.set(credit.film_id, roles);
    }

    return {
      id: person.id,
      name: person.name,
      tmdb: {
        id: snapshot.tmdb_id,
        originalName: snapshot.original_name,
        knownForDepartment: snapshot.known_for_department,
        biography: snapshot.biography,
        birthday: snapshot.birthday,
        deathday: snapshot.deathday,
        placeOfBirth: snapshot.place_of_birth,
        homepageUrl: snapshot.homepage_url,
        imdbId: snapshot.imdb_id,
        profilePath: snapshot.profile_path,
        fetchedAt: snapshot.fetched_at,
        expiresAt: snapshot.expires_at,
        url: `https://www.themoviedb.org/person/${snapshot.tmdb_id}`,
      },
      films: (films ?? []).map((film) => ({
        id: film.id,
        title: film.title,
        roles: rolesByFilmId.get(film.id) ?? [],
      })),
    };
  } catch {
    return null;
  }
}

export async function listCatalogPersonIds() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.from("people").select("id");
    return error ? [] : data.map((person) => person.id);
  } catch {
    return [];
  }
}

export function listFixtureFilmIds() {
  return filmFixtures.map((film) => film.id);
}
