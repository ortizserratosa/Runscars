"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { localizedPath, type Locale } from "../../lib/i18n/config";
import {
  PublicRankingView,
  type PublicRankingSummaryResult,
} from "./PublicRankingView";

export function LivePublicRankingModule({
  categoryId,
  categoryName,
  locale,
}: {
  categoryId: string;
  categoryName: string;
  locale: Locale;
}) {
  const [loaded, setLoaded] = useState<{
    categoryId: string;
    result: PublicRankingSummaryResult;
  } | null>(null);
  const [failedCategory, setFailedCategory] = useState<string | null>(null);
  const result = loaded?.categoryId === categoryId ? loaded.result : null;
  const failed = failedCategory === categoryId;
  useEffect(() => {
    let controller: AbortController | undefined;
    let generation = 0;
    let active = true;
    async function refresh() {
      const current = ++generation;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch(
          `/api/comunidad/quinielas?categoria=${encodeURIComponent(categoryId)}`,
          { cache: "no-store", credentials: "omit", signal: request.signal },
        );
        if (!response.ok) throw new Error("Public ballots unavailable");
        const data: PublicRankingSummaryResult = await response.json();
        if (active && !request.signal.aborted && current === generation) {
          setLoaded({ categoryId, result: data });
          setFailedCategory(null);
        }
      } catch {
        if (active && !request.signal.aborted && current === generation) {
          setFailedCategory(categoryId);
        }
      }
    }
    // Refresh after returning to a tab so revocations are not kept in the
    // cached page or in a restored client tree indefinitely.
    function onVisibility() {
      if (document.visibilityState === "visible") void refresh();
      else {
        ++generation;
        controller?.abort();
        setLoaded(null);
      }
    }
    if (document.visibilityState === "visible") void refresh();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      ++generation;
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [categoryId]);

  if (result && !failed) {
    return (
      <PublicRankingView
        categoryId={categoryId}
        categoryName={categoryName}
        locale={locale}
        result={result}
      />
    );
  }
  const en = locale === "en";
  return (
    <section className="community-module" aria-busy={!failed}>
      <h2>{en ? "Public ballots" : "Quinielas públicas"}</h2>
      <p role="status">
        {failed
          ? en
            ? "Public ballots could not be loaded."
            : "No se pudieron cargar las quinielas públicas."
          : en
            ? "Loading public ballots…"
            : "Cargando quinielas públicas…"}
      </p>
      <Link href={localizedPath(`/comunidad?category=${categoryId}`, locale)}>
        {en ? "Explore all ballots →" : "Explorar todas las quinielas →"}
      </Link>
    </section>
  );
}
