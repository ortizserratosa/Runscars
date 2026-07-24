import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the Runscars home without starter metadata", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /RUNSCARS/);
  assert.match(html, /La carrera/);
  assert.match(html, /con los recibos/);
  assert.match(html, /The Odyssey/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("renders all phase 2 routes", async () => {
  const expectations = [
    ["/temporadas/2027", /Ocho carreras/],
    ["/temporadas/2027/mejor-pelicula", /Consenso de nominación/],
    ["/peliculas/the-odyssey", /Valores originales/],
    ["/fuentes/awardswatch", /Top 10 publicado/],
  ];

  for (const [path, content] of expectations) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), content, path);
  }
});

test("keeps the three signals visibly separated", async () => {
  const response = await render("/");
  const html = await response.text();
  assert.match(html, /Predicciones/);
  assert.match(html, /Crítica/);
  assert.match(html, /Tu ranking/);
  assert.match(html, /sin mezclarlas/);
});

test("exposes every phase 2 exit-gate control and receipt", async () => {
  const category = await render("/temporadas/2027/mejor-pelicula");
  const categoryHtml = await category.text();
  assert.match(categoryHtml, /The Odyssey/);
  assert.match(categoryHtml, /97[,.]5/);
  assert.match(categoryHtml, /AwardsWatch/);
  assert.match(categoryHtml, /04 JUL/i);
  assert.match(categoryHtml, /23 JUL/i);
  assert.match(categoryHtml, /Subir/);
  assert.match(categoryHtml, /Marcar vista/);

  const film = await render("/peliculas/the-odyssey");
  const filmHtml = await film.text();
  assert.match(filmHtml, /5\/5/);
  assert.match(filmHtml, /94%/);
  assert.match(filmHtml, /88\/100/);
  assert.match(filmHtml, /No participa/);
});
