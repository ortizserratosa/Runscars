import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Runscars",
    short_name: "Runscars",
    description:
      "Predicciones profesionales, datos cinematográficos y quinielas personales para seguir la carrera a los Oscar.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2efe6",
    theme_color: "#161616",
    icons: [
      {
        src: "/og.png",
        sizes: "1680x945",
        type: "image/png",
      },
    ],
  };
}
