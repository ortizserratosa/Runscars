import { isEligibleFestivalEntry } from "./core.mjs";

const htmlEntities = {
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  aacute: "á",
  Aacute: "Á",
  eacute: "é",
  Eacute: "É",
  iacute: "í",
  Iacute: "Í",
  oacute: "ó",
  Oacute: "Ó",
  uacute: "ú",
  Uacute: "Ú",
  agrave: "à",
  Agrave: "À",
  egrave: "è",
  Egrave: "È",
  ugrave: "ù",
  Ugrave: "Ù",
  auml: "ä",
  Auml: "Ä",
  ouml: "ö",
  Ouml: "Ö",
  uuml: "ü",
  Uuml: "Ü",
  aelig: "æ",
  AElig: "Æ",
  ccedil: "ç",
  Ccedil: "Ç",
  ntilde: "ñ",
  Ntilde: "Ñ",
};

function decodeHtml(value) {
  return value
    .replaceAll(/<\/?span\b[^>]*>/gi, "")
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
      if (!code.startsWith("#")) return htmlEntities[code] ?? entity;
      const point = code.slice(1).toLowerCase().startsWith("x")
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    })
    .replaceAll(/\s+/g, " ")
    .trim();
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] ? decodeHtml(match[1]) : null;
}

function dataAttributeEntries(html, kind) {
  return [...html.matchAll(/<[^>]+data-film-title=["'][^"']+["'][^>]*>/gi)].map(
    ([tag], index) => ({
      section: attribute(tag, "data-section") ?? "Official Selection",
      originalTitle: attribute(tag, "data-film-title"),
      originalRecipient: attribute(tag, "data-recipient"),
      awardType:
        kind === "awards"
          ? (attribute(tag, "data-award") ?? `Official award ${index + 1}`)
          : null,
      isFeature: attribute(tag, "data-format") !== "short",
      isOfficial: attribute(tag, "data-official") !== "false",
      entryType: attribute(tag, "data-entry-type") ?? "feature",
      originalData: { tag },
    }),
  );
}

function jsonLdEntries(html, kind) {
  const scripts = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  const entries = [];
  for (const match of scripts) {
    try {
      const roots = Array.isArray(JSON.parse(match[1]))
        ? JSON.parse(match[1])
        : [JSON.parse(match[1])];
      for (const root of roots) {
        const lists = [root, ...(root["@graph"] ?? [])].filter(
          (item) => item?.["@type"] === "ItemList",
        );
        for (const list of lists) {
          for (const listItem of list.itemListElement ?? []) {
            const item = listItem.item ?? listItem;
            const title = item.name ?? listItem.name;
            if (!title) continue;
            entries.push({
              section: item.genre ?? list.name ?? "Official Selection",
              originalTitle: title,
              originalRecipient: item.director?.name ?? null,
              awardType:
                kind === "awards" ? (list.name ?? "Official award") : null,
              isFeature: !/short/i.test(
                `${item.genre ?? ""} ${item.duration ?? ""}`,
              ),
              isOfficial: true,
              entryType: item.genre ?? "feature",
              originalData: listItem,
            });
          }
        }
      }
    } catch {
      // Un bloque JSON-LD ajeno o malformado no invalida los demás recibos.
    }
  }
  return entries;
}

function sundanceAwards(html) {
  const entries = [];
  const blocks = html.matchAll(/<p\b[^>]*>(?:(?!<p\b)[\s\S])*?<\/p>/gi);
  for (const [raw] of blocks) {
    if (!/was presented to|was awarded to|went to/i.test(raw)) continue;
    // The press release keeps the award and italicized film in separate bold
    // elements, followed by credits and a synopsis. Keep only the named film;
    // the previous plain-text split accidentally imported all of the synopsis.
    const film = raw.match(
      /<(?:b|strong)[^>]*>\s*<i[^>]*>([\s\S]*?)<\/i>\s*<\/(?:b|strong)>/i,
    );
    if (film) {
      if (!/<(?:b|strong)\b/i.test(raw.slice(0, film.index))) continue;
      const prefix = decodeHtml(raw.slice(0, film.index));
      const split = prefix.match(
        /^(.*?)\s+(?:was presented to|was awarded to|went to)\s*(.*?)$/i,
      );
      if (!split || /short film/i.test(split[1])) continue;
      const award = split[1]
        .replace(/^(?:The|A)\s+/i, "")
        .replace(/,?\s*Presented by .+$/i, "")
        .replace(/\s+for an outstanding feature film.*$/i, "")
        .trim();
      if (/NHK|Mentorship|Gayle Stevens/i.test(award)) continue;
      const recipient = split[2].replace(/\s+for\s*$/i, "").trim();
      entries.push({
        section: "Official awards",
        originalTitle: decodeHtml(film[1]),
        originalRecipient: recipient || null,
        awardType: award,
        isFeature: true,
        isOfficial: true,
        entryType: "feature",
        originalData: {
          award,
          recipient: recipient || null,
          originalTitle: decodeHtml(film[1]),
        },
      });
      continue;
    }
    const text = decodeHtml(raw);
    const parts = text.split(/ was (?:presented|awarded) to | went to /i);
    if (parts.length !== 2) continue;
    if (/NHK|Mentorship|Gayle Stevens/i.test(parts[0])) continue;
    let recipient = null;
    let title = parts[1].replace(/[.\s]+$/, "").trim();
    const credited = title.match(/^(.+?)\s+for\s+(.+)$/i);
    if (credited) {
      recipient = credited[1].trim();
      title = credited[2].trim();
    }
    entries.push({
      section: "Official awards",
      originalTitle: title,
      originalRecipient: recipient,
      awardType: parts[0]
        .replace(/^(?:The|A)\s+/i, "")
        .replace(/,?\s*Presented by .+$/i, "")
        .trim(),
      isFeature: !/short film/i.test(parts[0]),
      isOfficial: true,
      entryType: "feature",
      originalData: { text },
    });
  }
  return entries;
}

function sundanceSelection(html) {
  const entries = [];
  let section = null;
  for (const [raw] of html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)) {
    const text = decodeHtml(raw);
    if (
      /^(?:U\.S\. (?:DRAMATIC|DOCUMENTARY) COMPETITION|WORLD CINEMA (?:DRAMATIC|DOCUMENTARY) COMPETITION|NEXT|PREMIERES|MIDNIGHT|SPOTLIGHT|EPISODIC|FAMILY MATINEE|SPECIAL SCREENINGS|NEW FRONTIER)$/i.test(
        text,
      )
    ) {
      section = text;
      continue;
    }
    if (!section || /episodic|new frontier/i.test(section)) continue;
    const title = raw.match(/<b[^>]*>\s*<i[^>]*>([\s\S]*?)<\/i>\s*<\/b>/i);
    if (!title || !/\(\s*Director/.test(text)) continue;
    const credits = text.match(/\(\s*(Directors?[^)]+)\)/)?.[1] ?? "";
    const director =
      credits.match(
        /^Directors?[^:]*:\s*(.+?)(?=, (?:Screenwriters?|Producers?|Co-[A-Z][^:]*):|$)/,
      )?.[1] ?? null;
    entries.push({
      section,
      originalTitle: decodeHtml(title[1]),
      originalRecipient: director,
      isFeature: true,
      isOfficial: true,
      entryType: "feature",
      originalData: {
        originalTitle: decodeHtml(title[1]),
        creditLine: credits,
      },
    });
  }
  return entries;
}

function cannesSelection(html) {
  const entries = [];
  let section = null;
  for (const match of html.matchAll(/<(h2|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = decodeHtml(match[2]);
    if (match[1].toLowerCase() === "h2") {
      section =
        /^(?:In Competition|Un Certain Regard|Out of Competition|Midnight Screenings|Cannes Premi[eè]re|Special Screenings|Family Screening)$/i.test(
          text,
        )
          ? text
          : null;
      continue;
    }
    if (!section) continue;
    const credit = text.match(
      /^(?:Opening film:\s*)?(.+?)\s+by\s+(.+?)(?:\s*\|.*|$)/i,
    );
    if (!credit) continue;
    entries.push({
      section: /Out of Competition$/i.test(credit[2])
        ? "Out of Competition"
        : section,
      originalTitle: credit[1].trim(),
      originalRecipient: credit[2]
        .replace(/\s*[–—-]\s*Out of Competition$/i, "")
        .trim(),
      isFeature: true,
      isOfficial: true,
      entryType: "feature",
      originalData: { creditLine: text },
    });
  }
  return entries;
}

function veniceAwards(html) {
  const entries = [];
  let section = null;
  for (const match of html.matchAll(/<(h4|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const raw = match[2];
    const text = decodeHtml(raw);
    if (match[1].toLowerCase() === "h4") {
      section =
        /^(?:Venezia \d+|Orizzonti|Venice Award for a Debut Film|Venice Spotlight|Venice Classics)$/i.test(
          text,
        )
          ? text
          : null;
      continue;
    }
    if (!section || /SHORT FILM|RESTORED FILM/i.test(text)) continue;
    const film = raw.match(/<em[^>]*>([\s\S]*?)<\/em>/i);
    if (!film) continue;
    const prefix = decodeHtml(raw.slice(0, film.index));
    const divider = prefix.match(
      /^(.*?)(?:\s+to:|\s+for Best Actress:|\s+for Best Actor:)(.*?)$/i,
    );
    if (!divider) continue;
    const awardType = /for Best (?:Actress|Actor):/i.test(prefix)
      ? prefix.match(/^(.*?for Best (?:Actress|Actor)):/i)?.[1]
      : divider[1];
    const recipient =
      divider[2].replace(/\s+(?:for|in) the film\s*$/i, "").trim() ||
      decodeHtml(raw.slice(film.index + film[0].length))
        .match(/^by\s+(.+?)(?:\s*\(|$)/i)?.[1]
        ?.trim() ||
      null;
    entries.push({
      section,
      originalTitle: decodeHtml(film[1]),
      originalRecipient: recipient,
      awardType: awardType?.trim(),
      isFeature: true,
      isOfficial: true,
      entryType: "feature",
      originalData: { awardLine: text },
    });
  }
  return entries;
}

function cannesAwards(html) {
  const entries = [];
  let section = null;
  let awardType = null;
  for (const match of html.matchAll(/<(h2|h5|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const raw = match[2];
    const body = decodeHtml(raw);
    if (match[1].toLowerCase() === "h2") {
      section =
        /^(?:Feature Films|Un Certain Regard|Cam[eé]ra d.or|Superior Technical Commission)$/i.test(
          body,
        )
          ? body
          : null;
      awardType = null;
      continue;
    }
    if (!section) continue;
    if (match[1].toLowerCase() === "h5") {
      awardType = body;
      continue;
    }
    // A named film link is the film identity; the preceding bold names are
    // often directors, writers or performers, including shared prizes.
    const film = [
      ...raw.matchAll(
        /<a\b[^>]*href=["'](https:\/\/www\.festival-cannes\.com\/(?:en\/)?f\/[^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi,
      ),
    ].find((item) => decodeHtml(item[2]));
    if (!film) continue;
    const originalTitle = decodeHtml(film[2]);
    const prefix = decodeHtml(raw.slice(0, film.index));
    const suffix = decodeHtml(raw.slice(film.index + film[0].length));
    let recipient =
      prefix.replace(/\s+(?:for|in)$/i, "").trim() ||
      suffix
        .match(
          /^directed by (.+?)(?:\s+Un Certain Regard|\s+\(1st film\)|$)/i,
        )?.[1]
        ?.trim() ||
      null;
    let label = awardType;
    if (section === "Superior Technical Commission") {
      const credit = prefix.match(
        /^(THE CST AWARD.*?)\s+is presented to\s+(.+?),\s+.+?\s+of$/i,
      );
      if (!credit) continue;
      label = credit[1];
      recipient = credit[2].trim();
    }
    if (!label) continue;
    entries.push({
      section,
      originalTitle,
      originalRecipient: recipient,
      awardType: label,
      isFeature: true,
      isOfficial: true,
      entryType: "feature",
      originalData: { awardType: label, awardCredit: body, filmUrl: film[1] },
    });
  }
  return entries;
}

function berlinaleAwards(html, year) {
  // The archive also embeds older editions. Only film links for this year count.
  const visible = html.replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const entries = [];
  const shortAwardBySection = new Map();
  for (const match of visible.matchAll(
    /<div class="award-list__item">([\s\S]*?)(?=<div class="award-list__item">|$)/g,
  )) {
    const block = match[1];
    const award = block.match(
      /<strong class="award-list__type">([\s\S]*?)<\/strong>/,
    )?.[1];
    const details = block.match(
      /<div class="award-list__details">\s*<p>([\s\S]*?)<\/p>/,
    )?.[1];
    const film = details?.match(
      new RegExp(`<a href="(/en/${year}/programme/[^"]+)">([\\s\\S]*?)<\\/a>`),
    );
    if (!award || !details || !film) continue;
    const section =
      [
        ...visible
          .slice(0, match.index)
          .matchAll(
            /<h2[^>]*class="award-list__headline[^"]*"[^>]*>([\s\S]*?)<\/h2>/g,
          ),
      ].at(-1)?.[1] ?? "Official awards";
    const sectionLabel = decodeHtml(section);
    const awardLabel = decodeHtml(award);
    if (!/special mention/i.test(awardLabel)) {
      shortAwardBySection.set(sectionLabel, /short/i.test(awardLabel));
    }
    const isShort =
      /short/i.test(sectionLabel) ||
      shortAwardBySection.get(sectionLabel) === true;
    const recipient = decodeHtml(
      details.slice(0, details.indexOf(film[0])),
    ).replace(/\s+(?:for|in)\s*:?\s*$/i, "");
    entries.push({
      section: sectionLabel,
      originalTitle: decodeHtml(film[2]),
      originalRecipient: recipient || null,
      awardType: awardLabel,
      isFeature: !isShort,
      isOfficial: true,
      entryType: "feature",
      originalData: {
        award: decodeHtml(award),
        details: decodeHtml(details),
        filmUrl: `https://www.berlinale.de${film[1]}`,
      },
    });
  }
  return entries;
}

function veniceSelection(html, year) {
  return [
    ...html.matchAll(
      /<article class="node node-film[^"]*">([\s\S]*?)<\/article>/g,
    ),
  ].flatMap((match) => {
    const block = match[1];
    const film = block.match(
      new RegExp(`href="(/en/cinema/${year}/([^/"]+)/[^"]+)"`),
    );
    const title = block.match(
      /<div class="lb-item-title">([\s\S]*?)<\/div>/,
    )?.[1];
    const description = block.match(
      /<div class="lb-description">([\s\S]*?)<\/div>/,
    )?.[1];
    if (!film || !title) return [];
    const duration = decodeHtml(description ?? "").match(/(\d+)\s*[’']/)?.[1];
    return [
      {
        section: film[2].replaceAll("-", " "),
        originalTitle: decodeHtml(title),
        originalRecipient:
          description
            ?.match(/<strong[^>]*>([\s\S]*?)<\/strong>/)?.[1]
            ?.trim() ?? null,
        awardType: null,
        isFeature: duration ? Number(duration) >= 40 : !/short/i.test(block),
        isOfficial: true,
        entryType: "feature",
        originalData: {
          filmUrl: `https://www.labiennale.org${film[1]}`,
          description: decodeHtml(description ?? ""),
        },
      },
    ];
  });
}

function sanSebastianSelection(html, year) {
  return html
    .split(/<div class="col-12 col-md-6 col-lg-4 col-xl-4 my-4"[^>]*>/)
    .slice(1)
    .flatMap((block) => {
      const title = block.match(
        /<div class="my-2 alink"[^>]*><a href="([^"]+)">([\s\S]*?)<\/a>/,
      );
      if (
        !title ||
        !title[1].startsWith(
          `/${year}/sections_and_films/official_selection/7/`,
        )
      )
        return [];
      const duration = block.match(
        /<!-- Duracion -->[\s\S]*?(\d+)\s*min\./,
      )?.[1];
      // Require an explicit feature runtime; episodic and unknown formats stay unimported.
      if (
        !duration ||
        Number(duration) <= 40 ||
        /\d+\s*(?:episodes|episodios)/i.test(decodeHtml(block))
      )
        return [];
      return [
        {
          section: "Official Selection",
          originalTitle: decodeHtml(title[2]),
          originalRecipient:
            decodeHtml(
              block.match(
                /<div class="border-bottom text-uppercase mb-2">([\s\S]*?)<\/div>/,
              )?.[1] ?? "",
            ) || null,
          awardType: null,
          isFeature: true,
          isOfficial: true,
          entryType: "feature",
          originalData: {
            filmUrl: new URL(title[1], "https://www.sansebastianfestival.com")
              .href,
            runtimeMinutes: Number(duration),
          },
        },
      ];
    });
}

export function parseFestivalHtml(festivalId, kind, html, year = 2026) {
  if (typeof html !== "string" || !html.trim()) {
    throw new Error(`Respuesta vacía de ${festivalId}`);
  }
  let entries = dataAttributeEntries(html, kind);
  if (!entries.length) entries = jsonLdEntries(html, kind);
  if (!entries.length && festivalId === "sundance" && kind === "awards") {
    entries = sundanceAwards(html);
  }
  if (!entries.length && festivalId === "sundance" && kind === "selection")
    entries = sundanceSelection(html);
  if (!entries.length && festivalId === "cannes" && kind === "selection")
    entries = cannesSelection(html);
  if (!entries.length && festivalId === "venice" && kind === "awards")
    entries = veniceAwards(html);
  if (!entries.length && festivalId === "cannes" && kind === "awards") {
    entries = cannesAwards(html);
  }
  if (!entries.length && festivalId === "berlinale" && kind === "awards")
    entries = berlinaleAwards(html, year);
  if (!entries.length && festivalId === "venice" && kind === "selection")
    entries = veniceSelection(html, year);
  if (!entries.length && festivalId === "san-sebastian" && kind === "selection")
    entries = sanSebastianSelection(html, year);
  return entries;
}

async function fetchPage(fetcher, url) {
  const response = await fetcher(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/json",
      "user-agent": "Runscars/1.0 (+https://runscars.app/fuentes)",
    },
  });
  if (!response.ok) throw new Error(`${url} respondió ${response.status}`);
  return response.text();
}

function sourcePublicationTime(html) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const field = attribute(tag, "property") ?? attribute(tag, "name");
    if (field !== "article:published_time") continue;
    const value = attribute(tag, "content");
    if (value && !Number.isNaN(Date.parse(value))) return value;
  }
  return null;
}

function isExpectedPendingAwardsMiss(connector, kind, capturedAt, error) {
  if (
    kind !== "awards" ||
    connector.edition?.awards_status !== "pending" ||
    !/respondió (?:404|410)$/.test(error instanceof Error ? error.message : "")
  ) {
    return false;
  }
  const endsOn = connector.edition?.ends_on;
  if (!endsOn) return true;
  const incidentAt = Date.parse(`${endsOn}T23:59:59Z`) + 86_400_000;
  return Date.parse(capturedAt) <= incidentAt;
}

async function officialAdapter({ connector, capturedAt, fetcher }) {
  const configuration = connector.configuration;
  const manifests = [];
  for (const kind of ["selection", "awards"]) {
    // Closed editions with a reviewed, versioned archive must not be replaced
    // by a dynamic page that exposes only part of the original programme.
    if (configuration.manual_archive_kinds?.includes(kind)) continue;
    const url = configuration[`${kind}_url`];
    if (!url) continue;
    let html;
    let contentType = "text/html";
    try {
      html = await fetchPage(fetcher, url);
    } catch (error) {
      if (isExpectedPendingAwardsMiss(connector, kind, capturedAt, error)) {
        continue;
      }
      throw error;
    }
    const year = Number(configuration.edition_id.split("-").at(-1));
    const entries = parseFestivalHtml(connector.festival_id, kind, html, year);
    if (
      connector.festival_id === "venice" &&
      kind === "selection" &&
      !entries.length
    ) {
      const sections = [
        ...new Set(
          [
            ...html.matchAll(
              new RegExp(
                `href="(/en/cinema/${year}/(?:venezia-\\d+-competition|venice-open-out-competition|orizzonti|venice-spotlight|biennale-college-cinema-0|special-screenings))"`,
                "g",
              ),
            ),
          ].map((match) => match[1]),
        ),
      ];
      if (!sections.length)
        throw new Error(
          "No se reconocieron las secciones de la selección de Venecia",
        );
      const receipts = [];
      for (const section of sections) {
        const sectionUrl = new URL(section, url).href;
        const sectionHtml = await fetchPage(fetcher, sectionUrl);
        const sectionEntries = parseFestivalHtml(
          "venice",
          "selection",
          sectionHtml,
          year,
        );
        if (!sectionEntries.length)
          throw new Error(`Sección sin películas reconocibles: ${sectionUrl}`);
        entries.push(...sectionEntries);
        receipts.push({ url: sectionUrl, body: sectionHtml });
      }
      html = JSON.stringify({ index: html, sections: receipts });
      contentType = "application/json";
    }
    const minimum = configuration.minimum_entries?.[kind] ?? 0;
    const eligibleCount = entries.filter(isEligibleFestivalEntry).length;
    if (eligibleCount < minimum) {
      throw new Error(
        `Captura parcial de ${connector.festival_id} (${kind}): ${eligibleCount} largometrajes; mínimo revisado ${minimum}`,
      );
    }
    if (!entries.length) continue;
    manifests.push({
      editionId: configuration.edition_id,
      kind,
      source: {
        url,
        title: `${connector.name} · ${kind}`,
        publishedAt: sourcePublicationTime(html),
      },
      capturedAt,
      extractorVersion: connector.extractor_version,
      entries,
      rawCapture: {
        contentType,
        body: html,
      },
    });
  }
  return manifests;
}

export const FESTIVAL_CONNECTORS = Object.fromEntries(
  [
    "sundance",
    "berlinale",
    "cannes",
    "locarno",
    "venice",
    "tiff",
    "san-sebastian",
    "telluride",
    "nyff",
  ].map((festivalId) => [`festival-${festivalId}`, officialAdapter]),
);
