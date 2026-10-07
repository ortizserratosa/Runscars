import { normalizeIdentity } from "./core.mjs";
import { fetchResponse } from "../network.mjs";
import { filmFromText } from "./professional-predictions.mjs";

export const VARIETY_CATEGORIES = Object.freeze({
  "best-picture": "Best Picture",
  directing: "Best Director",
  actor: "Best Actor",
  actress: "Best Actress",
  "supporting-actor": "Best Supporting Actor",
  "supporting-actress": "Best Supporting Actress",
  "original-screenplay": "Best Original Screenplay",
  "adapted-screenplay": "Best Adapted Screenplay",
});

function text(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([a-f0-9]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(
      /&(?:amp|quot|apos|nbsp);/g,
      (raw) =>
        ({ "&amp;": "&", "&quot;": '"', "&apos;": "'", "&nbsp;": " " })[raw],
    )
    .replace(/\s+/g, " ")
    .trim();
}

function attribute(tag, name) {
  return (
    tag
      .match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))
      ?.slice(1)
      .find((value) => value !== undefined) ?? null
  );
}

function meta(html, name) {
  const tag = [...html.matchAll(/<meta\b[^>]*>/gi)].find(
    (match) =>
      (attribute(match[0], "property") ?? attribute(match[0], "name")) === name,
  )?.[0];
  return tag ? text(attribute(tag, "content")) : null;
}

function categoryUrl(value, categoryId, ceremonyYear) {
  const slug = VARIETY_CATEGORIES[categoryId]
    ?.toLowerCase()
    .replaceAll(" ", "-");
  if (!slug) throw new Error("Variety: categoría no reconocida");
  const url = new URL(value, "https://variety.com/");
  const pattern =
    categoryId === "best-picture"
      ? new RegExp(`^/lists/${ceremonyYear}-oscars-${slug}-predictions/$`)
      : new RegExp(
          `^/feature/${ceremonyYear}-oscars-${slug}-predictions-\\d+/$`,
        );
  if (
    url.protocol !== "https:" ||
    url.hostname !== "variety.com" ||
    !pattern.test(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error("Variety: URL de categoría o temporada no válida");
  return url.toString();
}

export function discoverVarietyCategoryUrls(
  html,
  ceremonyYear = 2027,
  requestedCategoryId = null,
) {
  const categories = {};
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attribute(match[0], "href");
    if (!href) continue;
    for (const categoryId of requestedCategoryId
      ? [requestedCategoryId]
      : Object.keys(VARIETY_CATEGORIES)) {
      try {
        const url = categoryUrl(href, categoryId, ceremonyYear);
        if (categories[categoryId] && categories[categoryId] !== url)
          throw new Error(`Variety: enlaces ambiguos para ${categoryId}`);
        categories[categoryId] = url;
      } catch (error) {
        if (error.message.includes("ambiguos")) throw error;
      }
    }
  }
  return categories;
}

function chartUrl(value, previousUrl = null) {
  const url = new URL(value, previousUrl ?? undefined);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "datawrapper.dwcdn.net" ||
    !/^\/[a-zA-Z0-9]{5}\/\d+\/$/.test(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error("Variety: iframe público no reconocido");
  if (
    previousUrl &&
    new URL(previousUrl).pathname.split("/")[1] !== url.pathname.split("/")[1]
  )
    throw new Error("Variety: el redirect cambió de tabla");
  return url.toString();
}

// Read a JSON object embedded in a public script without executing JavaScript.
function embeddedObject(html, assignment) {
  const start = html.indexOf(assignment);
  if (start < 0) return null;
  const opening = html.indexOf("{", start + assignment.length);
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = opening; opening >= 0 && index < html.length; index += 1) {
    const char = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0)
      return JSON.parse(html.slice(opening, index + 1));
  }
  throw new Error("Variety: JSON público incompleto");
}

export function discoverVarietyChartUrl(html) {
  let content = html;
  const galleryScript = html.match(
    /<script\b[^>]*id=["']pmc-lists-front-js-extra["'][^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];
  if (galleryScript) {
    const gallery = embeddedObject(galleryScript, "var pmcGalleryExports =");
    content += (gallery?.gallery ?? [])
      .map((item) => item.description ?? "")
      .join("\n");
  }
  const urls = new Set();
  for (const match of content.matchAll(/<iframe\b[^>]*>/gi)) {
    const src = attribute(match[0], "src");
    if (!src || !src.startsWith("https://datawrapper.dwcdn.net/")) continue;
    urls.add(chartUrl(src));
  }
  if (urls.size !== 1)
    throw new Error("Variety: falta una tabla inequívoca de predicciones");
  return [...urls][0];
}

export function varietyChartRedirect(html, previousUrl) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attribute(match[0], "http-equiv")?.toLowerCase() !== "refresh")
      continue;
    const value = attribute(match[0], "content")?.match(
      /^\s*0\s*;\s*url\s*=\s*(.+?)\s*$/i,
    )?.[1];
    if (!value) throw new Error("Variety: redirect de tabla no reconocido");
    return chartUrl(value, previousUrl);
  }
  return null;
}

function chartProperties(html) {
  const encoded = html.match(
    /window\.__DW_SVELTE_PROPS__\s*=\s*JSON\.parse\(("(?:\\.|[^"\\])*")\)/,
  )?.[1];
  if (!encoded)
    throw new Error("Variety: faltan metadatos públicos de la tabla");
  return JSON.parse(JSON.parse(encoded));
}

function csvRows(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else field += char;
    } else if (char === '"' && !field && !closedQuote) quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      closedQuote = false;
    } else {
      if (closedQuote || char === '"')
        throw new Error("Variety: CSV mal formado");
      field += char;
    }
  }
  if (quoted) throw new Error("Variety: CSV truncado");
  if (field || row.length || closedQuote) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function updatedDate(value, capturedAt) {
  const match = value.match(/^Updated ([A-Z][a-z]+)\.? (\d{1,2}), (\d{4})$/);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months.indexOf(match?.[1]?.slice(0, 3));
  if (!match || month < 0)
    throw new Error("Variety: falta fecha editorial de actualización");
  const result = new Date(
    Date.UTC(Number(match[3]), month, Number(match[2])),
  ).toISOString();
  if (
    new Date(result).getUTCMonth() !== month ||
    Date.parse(result) > Date.parse(capturedAt)
  )
    throw new Error("Variety: fecha editorial no válida o futura");
  return result;
}

export function parseVarietyFixture(
  { articleHtml, chartHtml, csv, iframeUrl, resolvedChartUrl, datasetUrl },
  {
    capturedAt,
    endpointUrl,
    categoryId,
    ceremonyYear = 2027,
    seasonId = "oscars-2027",
    connectorId = `variety-${categoryId}-predictions`,
  },
) {
  if (
    seasonId !== `oscars-${ceremonyYear}` ||
    !Number.isFinite(Date.parse(capturedAt))
  )
    throw new Error("Variety: temporada o captura no válida");
  const canonicalTag = [...articleHtml.matchAll(/<link\b[^>]*>/gi)].find(
    (match) => attribute(match[0], "rel") === "canonical",
  )?.[0];
  const canonicalUrl = categoryUrl(
    attribute(canonicalTag ?? "", "href") ?? endpointUrl,
    categoryId,
    ceremonyYear,
  );
  if (canonicalUrl !== categoryUrl(endpointUrl, categoryId, ceremonyYear))
    throw new Error("Variety: canonical inesperada");
  const author = meta(articleHtml, "author");
  if (author !== "Clayton Davis")
    throw new Error("Variety: autor no verificado");
  if (discoverVarietyChartUrl(articleHtml) !== chartUrl(iframeUrl))
    throw new Error("Variety: iframe ajeno al artículo");
  const finalUrl = chartUrl(resolvedChartUrl, iframeUrl);
  if (datasetUrl !== new URL("dataset.csv", finalUrl).toString())
    throw new Error("Variety: CSV ajeno a la tabla");
  const props = chartProperties(chartHtml);
  const chart = props.chart;
  const description = chart?.metadata?.describe;
  const title = `${ceremonyYear} Oscars Predictions: ${VARIETY_CATEGORIES[categoryId]}`;
  if (
    chart?.title !== title ||
    chart.type !== "tables" ||
    props.published !== true ||
    props.isPreview !== false ||
    chart.publicId !== new URL(finalUrl).pathname.split("/")[1] ||
    chart.publicUrl !== finalUrl ||
    !/Variety[’']s latest ranking of the (?:Academy Awards )?contenders/i.test(
      description?.intro ?? "",
    ) ||
    (description.byline && description.byline !== author) ||
    (description["source-name"] && description["source-name"] !== "Variety") ||
    props.assets?.["dataset.csv"]?.url !== "dataset.csv"
  )
    throw new Error(
      "Variety: categoría, intención o procedencia de tabla no válida",
    );
  const rows = csvRows(csv.replace(/^\uFEFF/, ""));
  const columns = rows.shift();
  const expectedColumns =
    categoryId === "best-picture"
      ? ["Rank", "Film", "Distributor", "Producer(s)"]
      : categoryId === "directing"
        ? ["Rank", "Director(s)", "Film", "Distributor"]
        : categoryId.endsWith("screenplay")
          ? ["Rank", "Film", "Writer(s)", "Distributor"]
          : ["Rank", "Performer", "Film", "Distributor"];
  if (JSON.stringify(columns) !== JSON.stringify(expectedColumns))
    throw new Error("Variety: columnas no reconocidas");
  const ranked = [];
  const seen = new Set();
  let tier = null;
  let publicationDate = null;
  let updateLabel = null;
  let reachedCatalogue = false;
  const tiers = [
    "AND THE PREDICTED NOMINEES ARE",
    "NEXT IN LINE",
    "OTHER TOP-TIER CONTENDERS",
    "ALSO IN CONTENTION",
  ];
  for (const row of rows) {
    if (row.every((cell) => !cell)) continue;
    if (row.length !== columns.length)
      throw new Error("Variety: fila CSV incompleta");
    if (/^ELIGIBLE\b/.test(row[0]) && row.slice(1).every((cell) => !cell)) {
      reachedCatalogue = true;
      break;
    }
    if (row.slice(1).every((cell) => !cell)) {
      if (tiers.includes(row[0])) {
        tier = row[0];
        continue;
      }
      if (row[0].startsWith("Updated ") && !publicationDate) {
        publicationDate = updatedDate(row[0], capturedAt);
        updateLabel = row[0];
        continue;
      }
      throw new Error("Variety: cabecera de ranking no reconocida");
    }
    const rank = Number(row[0]);
    if (!tier || !/^\d+$/.test(row[0]) || rank !== ranked.length + 1)
      throw new Error("Variety: posiciones no consecutivas");
    const cells = Object.fromEntries(
      columns.map((column, index) => [column, row[index]]),
    );
    const filmSubject = filmFromText(text(cells.Film));
    const personValue = text(cells.Performer ?? cells["Director(s)"]);
    if (
      !filmSubject ||
      ([
        "actor",
        "actress",
        "supporting-actor",
        "supporting-actress",
        "directing",
      ].includes(categoryId) &&
        !personValue)
    )
      throw new Error("Variety: candidatura incompleta");
    const identity = normalizeIdentity(`${personValue}|${filmSubject}`);
    if (seen.has(identity)) throw new Error("Variety: candidatura duplicada");
    seen.add(identity);
    ranked.push({
      rank,
      cells,
      tier,
      filmSubject,
      peopleSubjects:
        categoryId === "directing"
          ? personValue.split(/\s+(?:and|&)\s+/i)
          : personValue
            ? [personValue]
            : [],
    });
  }
  if (
    !reachedCatalogue ||
    !publicationDate ||
    ranked.length < (categoryId === "best-picture" ? 10 : 5)
  )
    throw new Error("Variety: ranking o fecha incompletos");
  const captured = new Date(capturedAt).toISOString();
  return {
    connectorId,
    sourceId: "variety",
    extractorVersion: "variety-datawrapper-v1",
    seasonId,
    capturedAt: captured,
    sourceUrl: canonicalUrl,
    publications: [
      {
        externalId: new URL(canonicalUrl).pathname.replace(/^\/|\/$/g, ""),
        canonicalUrl,
        title,
        author,
        publishedAt: publicationDate,
        capturedAt: captured,
        isMutable: true,
        originalData: {
          source_id: "variety",
          canonical_url: canonicalUrl,
          title,
          author,
          publication_date: publicationDate,
          editorial_update_label: updateLabel,
          article_publication_date: meta(articleHtml, "article:published_time"),
          article_modification_date: meta(articleHtml, "article:modified_time"),
          iframe_url: iframeUrl,
          resolved_chart_url: finalUrl,
          chart_publication_date: chart.publishedAt ?? null,
          chart_modification_date: chart.lastModifiedAt ?? null,
          order_statement: description.intro,
          dataset_url: datasetUrl,
          category_id: categoryId,
          columns,
          ranking_rows: ranked.map(({ cells, tier }) => ({ cells, tier })),
        },
        observations: ranked.map(
          ({ rank, cells, tier, filmSubject, peopleSubjects }) => ({
            dataType: "prediction_ordered",
            subject: peopleSubjects.length
              ? `${peopleSubjects.join(" and ")} — ${filmSubject}`
              : filmSubject,
            filmSubject,
            peopleSubjects,
            workTitle: null,
            originalValue: {
              rank,
              list_length: ranked.length,
              raw: cells,
              source_tier: tier,
              order_evidence: "explicit-rank-column",
              film_subject: filmSubject,
              people_subjects: peopleSubjects,
            },
            originalScale: null,
            categoryId,
            predictionIntention: "nomination",
            participates: true,
          }),
        ),
      },
    ],
  };
}

export async function runVarietyConnector({
  connector,
  capturedAt,
  fetcher = fetch,
}) {
  const categoryId = connector.configuration.category_id;
  const ceremonyYear = connector.configuration.ceremony_year ?? 2027;
  const timeoutMs =
    Number(connector.configuration.request_timeout_ms) || 15_000;
  const request = {
    headers: { Accept: "text/html", "User-Agent": "Runscars/0.1" },
  };
  const fetchText = async (url) =>
    (await fetchResponse(url, request, fetcher, { timeoutMs })).text();
  const indexUrl =
    connector.configuration.discovery_url ?? connector.endpoint_url;
  const categoryUrls = discoverVarietyCategoryUrls(
    await fetchText(indexUrl),
    ceremonyYear,
    categoryId,
  );
  const endpointUrl = categoryUrls[categoryId];
  if (!endpointUrl)
    throw new Error(`Variety: falta publicación para ${categoryId}`);
  const articleHtml = await fetchText(endpointUrl);
  const iframeUrl = discoverVarietyChartUrl(articleHtml);
  let resolvedChartUrl = iframeUrl;
  let chartHtml;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    chartHtml = await fetchText(resolvedChartUrl);
    const redirect = varietyChartRedirect(chartHtml, resolvedChartUrl);
    if (!redirect) break;
    if (attempt === 3)
      throw new Error("Variety: demasiadas versiones redirigidas");
    resolvedChartUrl = redirect;
  }
  const datasetUrl = new URL("dataset.csv", resolvedChartUrl).toString();
  const csv = await fetchText(datasetUrl);
  const batch = parseVarietyFixture(
    { articleHtml, chartHtml, csv, iframeUrl, resolvedChartUrl, datasetUrl },
    {
      capturedAt,
      endpointUrl,
      categoryId,
      ceremonyYear,
      seasonId: connector.configuration.season_id,
      connectorId: connector.id,
    },
  );
  return {
    ...batch,
    discovery: {
      mode: "category-datawrapper",
      indexUrl,
      checkedAt: batch.capturedAt,
      publicationUrls: [endpointUrl],
      latestCategoryUrls: { [categoryId]: endpointUrl },
      skippedUrls: [],
      iframeUrl,
      resolvedChartUrl,
      datasetUrl,
    },
  };
}
