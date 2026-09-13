#!/usr/bin/env bash
# Prueba la ruta que trae el dólar sin que tengas que escribir el
# secreto en la terminal —y por lo tanto sin que quede en el historial—.
# Lo lee de .env.local.
#
#   ./scripts/probar-cron.sh                        # contra local
#   ./scripts/probar-cron.sh https://tu-app.vercel.app
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
destino="${1:-http://localhost:3000}"

[ -f "$raiz/.env.local" ] || { echo "No encuentro .env.local" >&2; exit 1; }

secreto="$(grep -E '^CRON_SECRET=' "$raiz/.env.local" | head -1 | cut -d= -f2- | tr -d "\"' ")"
[ -n "$secreto" ] || { echo "Falta CRON_SECRET en .env.local" >&2; exit 1; }

echo "Pidiendo $destino/api/cotizaciones …"
codigo="$(curl -s -o /tmp/cron-respuesta.txt -w '%{http_code}' \
  -H "Authorization: Bearer $secreto" "$destino/api/cotizaciones")"

echo "HTTP $codigo"
cat /tmp/cron-respuesta.txt; echo

case "$codigo" in
  200) echo "Anduvo: las cotizaciones quedaron guardadas." ;;
  401) echo "El secreto de acá no coincide con el del servidor." ;;
  500) echo "Al servidor le falta CRON_SECRET en sus variables." ;;
  502) echo "No se pudo consultar DolarApi. La de ayer sigue sirviendo." ;;
  *)   echo "Respuesta inesperada." ;;
esac
