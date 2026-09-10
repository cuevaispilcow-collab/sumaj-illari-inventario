export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}


export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}


export function formatSoles(n) {
  const num = Number(n) || 0;
  return "S/ " + num.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


export function formatFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[m - 1]} ${y}`;
}


// Filtra una lista (ventas, movimientos, compras, producciones, pedidos...)
// para dejar solo lo que corresponde a una ubicación. Los registros
// antiguos, de antes de separar por ubicación, no tienen el campo
// "ubicacion" — esos se tratan como "sumaj_illari" (no se reasignan a
// ninguna otra ubicación). Esta regla vive en un solo lugar para que
// todas las pantallas filtren exactamente igual.
export function filtrarPorUbicacion(lista, ubicacion) {
  return (lista || []).filter((item) => (item.ubicacion || "sumaj_illari") === ubicacion);
}

// Filtra transferencias entre ubicaciones: a diferencia de filtrarPorUbicacion
// (que compara un solo campo "ubicacion"), una transferencia tiene que
// aparecer en el historial de SUS DOS ubicaciones involucradas — la que
// envía (origen) y la que recibe (destino).
export function filtrarTransferencias(lista, ubicacion) {
  return (lista || []).filter((t) => t.origen === ubicacion || t.destino === ubicacion);
}

