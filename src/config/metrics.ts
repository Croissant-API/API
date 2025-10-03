import client from "prom-client";

// --- Histogramme Prometheus pour mesurer les temps de réponse HTTP ---
// - name : nom de la métrique exposée à Prometheus (unités en ms)
// - help : description lisible de la métrique
// - labelNames : dimensions permettant de segmenter les mesures (méthode HTTP, route, code HTTP)
// - buckets : intervalles en ms pour l'histogramme (permet d'agréger les temps par tranche)
export const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Durée des requêtes HTTP en ms",
  labelNames: ["method", "route", "status_code"],
  buckets: [50, 100, 200, 300, 400, 500, 1000, 2000, 5000]
});