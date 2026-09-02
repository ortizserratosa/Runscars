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
    theme_color: "#171a17",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/runscars-avatar.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
