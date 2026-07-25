import Link from "next/link";

export default function FilmNotFound() {
  return (
    <main className="page-shell section-block">
      <p className="section-index">PELÍCULA NO ENCONTRADA</p>
      <h1>Esta ficha todavía no existe.</h1>
      <p>
        Solo mostramos películas presentes en el catálogo verificado de la
        temporada.
      </p>
      <Link className="primary-button" href="/temporadas/2027">
        Volver a la temporada
      </Link>
    </main>
  );
}
