function decodeHtml(value) {
  return value
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&#8217;", "’")
    .replaceAll("&nbsp;", " ")
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
  const blocks = html.matchAll(
    /<(?:h4|p)[^>]*>([\s\S]*?(?:was presented to|was awarded to|went to)[\s\S]*?)<\/(?:h4|p)>/gi,
  );
  for (const [raw] of blocks) {
    const text = decodeHtml(raw);
    const parts = text.split(/ was (?:presented|awarded) to | went to /i);
    if (parts.length !== 2) continue;
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
      awardType: parts[0].trim(),
      isFeature: !/short film/i.test(parts[0]),
      isOfficial: true,
      entryType: "feature",
      originalData: { text },
    });
  }
  return entries;
}

function cannesAwards(html) {
  const entries = [];
  const pattern = /<h5[^>]*>([\s\S]*?)<\/h5>([\s\S]*?)(?=<h5|<h2|<h3|$)/gi;
  for (const match of html.matchAll(pattern)) {
    const awardType = decodeHtml(match[1]);
    const body = decodeHtml(match[2]);
    if (!awardType || !body) continue;
    const title = body
      .split(/\s+(?:directed by|for|in)\s+/i)
      .at(0)
      ?.trim();
    if (!title) continue;
    entries.push({
      section: /Un Certain Regard/i.test(html.slice(0, match.index))
        ? "Un Certain Regard"
        : /Cam[eé]ra d.or/i.test(html.slice(0, match.index))
          ? "Caméra d’or"
          : "Feature Films",
      originalTitle: title,
      originalRecipient: body.slice(title.length).trim() || null,
      awardType,
      isFeature: !/short/i.test(
        `${awardType} ${html.slice(Math.max(0, match.index - 120), match.index)}`,
      ),
      isOfficial: true,
      entryType: "feature",
      originalData: { awardType, body },
    });
  }
  return entries;
}

function berlinaleAwards(html, year) {
  // The archive also embeds older editions. Only film links for this year count.
  const visible = html.replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const entries = [];
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
    const recipient = decodeHtml(
      details.slice(0, details.indexOf(film[0])),
    ).replace(/\s+(?:for|in)\s*$/i, "");
    entries.push({
      section: decodeHtml(section),
      originalTitle: decodeHtml(film[2]),
      originalRecipient: recipient || null,
      awardType: decodeHtml(award),
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

export function parseFestivalHtml(festivalId, kind, html, year = 2026) {
  if (typeof html !== "string" || !html.trim()) {
    throw new Error(`Respuesta vacía de ${festivalId}`);
  }
  let entries = dataAttributeEntries(html, kind);
  if (!entries.length) entries = jsonLdEntries(html, kind);
  if (!entries.length && festivalId === "sundance" && kind === "awards") {
    entries = sundanceAwards(html);
  }
  if (!entries.length && festivalId === "cannes" && kind === "awards") {
    entries = cannesAwards(html);
  }
  if (!entries.length && festivalId === "berlinale" && kind === "awards")
    entries = berlinaleAwards(html, year);
  if (!entries.length && festivalId === "venice" && kind === "selection")
    entries = veniceSelection(html, year);
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
    if (!entries.length) continue;
    manifests.push({
      editionId: configuration.edition_id,
      kind,
      source: {
        url,
        title: `${connector.name} · ${kind}`,
        publishedAt: null,
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
