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
// "todas" es la vista consolidada de la gerente (ver el selector de
// ubicación) — ahí no se filtra nada, se devuelve todo junto.
export function filtrarPorUbicacion(lista, ubicacion) {
  if (ubicacion === "todas") return lista || [];
  return (lista || []).filter((item) => (item.ubicacion || "sumaj_illari") === ubicacion);
}

// Filtra transferencias entre ubicaciones: a diferencia de filtrarPorUbicacion
// (que compara un solo campo "ubicacion"), una transferencia tiene que
// aparecer en el historial de SUS DOS ubicaciones involucradas — la que
// envía (origen) y la que recibe (destino).
export function filtrarTransferencias(lista, ubicacion) {
  if (ubicacion === "todas") return lista || [];
  return (lista || []).filter((t) => t.origen === ubicacion || t.destino === ubicacion);
}

// Igual que filtrarTransferencias, pero para solicitudes de producto
// entre sedes: tiene que aparecer tanto para quien la pidió
// (solicitante) como para quien tiene que responderla (proveedor).
export function filtrarSolicitudes(lista, ubicacion) {
  if (ubicacion === "todas") return lista || [];
  return (lista || []).filter((s) => s.solicitante === ubicacion || s.proveedor === ubicacion);
}

// Ordena una lista de items (cada uno con un campo "valor") de mayor a
// menor, y calcula para cada uno qué % individual y acumulado
// representa del total — y si cae dentro del ~80% que concentra la
// mayor parte del valor (regla de Pareto/80-20). La usan tanto el
// análisis de gasto en Compras como el análisis ABC de inventario, para
// no tener la misma cuenta duplicada en dos lugares.
export function calcularPareto(items) {
  const lista = [...items].sort((a, b) => b.valor - a.valor);
  const granTotal = round2(lista.reduce((s, p) => s + p.valor, 0));
  let acumulado = 0;
  return lista.map((p) => {
    acumulado = round2(acumulado + p.valor);
    const pctIndividual = granTotal > 0 ? round2((p.valor / granTotal) * 100) : 0;
    const pctAcumulado = granTotal > 0 ? round2((acumulado / granTotal) * 100) : 0;
    const pctAcumuladoAntes = round2(pctAcumulado - pctIndividual);
    return { ...p, pctIndividual, pctAcumulado, enEl80: pctAcumuladoAntes < 80 };
  });
}

