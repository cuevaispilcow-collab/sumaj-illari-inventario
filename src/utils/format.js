import { sedesDeVista } from "./constants.js";

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


// Cuántos días faltan para una fecha (negativo si ya pasó). La usa
// Producción para saber si un pedido está por vencer o ya venció, y el
// panel de alertas del Dashboard para lo mismo — una sola fórmula para
// no tener el mismo cálculo de fechas duplicado en dos lugares.
export function diasHasta(fechaISO) {
  return Math.ceil((new Date(fechaISO + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);
}


export function formatFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[m - 1]} ${y}`;
}


// Filtra una lista (ventas, movimientos, compras, producciones, pedidos,
// auditoría...) para dejar solo lo que corresponde a una vista — una
// sede puntual, una empresa completa, o el consolidado ("todas"). Los
// registros antiguos, de antes de separar por ubicación, no tienen el
// campo "ubicacion" — esos se tratan como "sumaj_illari".
//
// Un registro es visible en una vista si TODAS las sedes que representa
// (normalmente una sola) están dentro de las sedes de esa vista. Esto
// hace que un registro normal (una sola sede real) se vea exactamente
// igual que siempre, y de paso resuelve bien el único caso donde un
// registro representa más de una sede a la vez (ej. la auditoría de una
// compra distribuida entre varias sedes, guardada con la vista que
// estaba activa en ese momento): aparece en el consolidado y en su
// propia vista de empresa, pero no se cuela en una sede puntual.
export function filtrarPorUbicacion(lista, ubicacion) {
  const sedesVista = new Set(sedesDeVista(ubicacion));
  return (lista || []).filter((item) => {
    const sedesItem = sedesDeVista(item.ubicacion || "sumaj_illari");
    return sedesItem.every((s) => sedesVista.has(s));
  });
}

// Filtra transferencias entre ubicaciones: a diferencia de filtrarPorUbicacion
// (que compara un solo campo "ubicacion"), una transferencia tiene que
// aparecer en el historial de SUS DOS ubicaciones involucradas — la que
// envía (origen) y la que recibe (destino). Origen y destino son
// siempre una sede real puntual (nunca "todas" ni una empresa), así que
// alcanza con ver si alguna de las dos está entre las sedes de la vista.
export function filtrarTransferencias(lista, ubicacion) {
  const sedesVista = new Set(sedesDeVista(ubicacion));
  return (lista || []).filter((t) => sedesVista.has(t.origen) || sedesVista.has(t.destino));
}

// Igual que filtrarTransferencias, pero para solicitudes de producto
// entre sedes: tiene que aparecer tanto para quien la pidió
// (solicitante) como para quien tiene que responderla (proveedor).
export function filtrarSolicitudes(lista, ubicacion) {
  const sedesVista = new Set(sedesDeVista(ubicacion));
  return (lista || []).filter((s) => sedesVista.has(s.solicitante) || sedesVista.has(s.proveedor));
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

// El promedio ponderado que se usa cada vez que ENTRA stock a un costo
// distinto al que ya había (comprar, recibir una transferencia, producir):
// si ya había stock con costo conocido, se promedia con lo nuevo; si no
// había nada (o no se conocía el costo), el costo nuevo pasa a ser
// directamente el costo de lo que entra. Una sola fórmula para Compras,
// Producción y Transferencias, para que el día que haya que ajustarla
// (ej. al incorporar costeo con mano de obra e indirectos) no haga falta
// acordarse de actualizarla en varios lugares a la vez.
export function promedioPonderado(stockActual, costoActual, cantidadEntrante, costoEntrante) {
  return costoActual != null && stockActual > 0
    ? round2((stockActual * costoActual + cantidadEntrante * costoEntrante) / (stockActual + cantidadEntrante))
    : costoEntrante;
}

