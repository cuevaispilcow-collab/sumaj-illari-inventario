import { round2, todayStr } from "./format.js";
import { UBICACIONES } from "./constants.js";

const NOMBRE_UBICACION = Object.fromEntries(UBICACIONES.map((u) => [u.id, u.nombre]));

// Calcula el efecto de mover "cantidad" unidades de un producto desde
// "origen" a "destino": cómo queda el inventario de cada lado (con el
// promedio ponderado de costo en el destino — mismo criterio que ya usa
// Compras cuando llega mercadería a un costo distinto al que ya había),
// y los registros de movimiento/transferencia que hay que guardar.
//
// No escribe nada por sí sola — la usan tanto "Registrar transferencia"
// (directo) como "Entregar" una solicitud, cada una dentro de su propia
// operarInventarioSeguro(), para no tener esta lógica duplicada en dos
// lugares que se puedan desincronizar con el tiempo.
//
// `producto`: el objeto con nombre/talla/codigo/unidad (esos datos no
// cambian según la ubicación, así que sirve cualquier versión ya
// cargada en pantalla). `variantes`: el catálogo crudo, para el stock
// antiguo de "sumaj_illari" de antes de separar por ubicación — NO se
// usa el stock/costo de `producto` porque puede venir de una ubicación
// distinta a `origen` (ej. la gerente mirando el consolidado).
export function calcularTransferencia({ inventariosActuales, variantes, producto, productoId, cantidad, origen, destino, usuario }) {
  const varianteRaw = (variantes || []).find((v) => v.id === productoId);
  if (!producto || !varianteRaw) {
    throw new Error("Ese producto ya no existe en el catálogo. Actualiza la página e inténtalo de nuevo.");
  }

  const claveOrigen = `${productoId}__${origen}`;
  const claveDestino = `${productoId}__${destino}`;

  const invOrigenActual = inventariosActuales.find((i) => i.id === claveOrigen);
  const stockOrigenBase = origen === "sumaj_illari" ? (varianteRaw.stock || 0) : 0;
  const stockOrigen = invOrigenActual ? invOrigenActual.stock : stockOrigenBase;
  if (stockOrigen < cantidad) {
    throw new Error(`Stock insuficiente. Ahora mismo solo hay ${stockOrigen} ${producto.unidad || ""} en ${NOMBRE_UBICACION[origen] || origen} (puede que alguien más lo haya movido).`);
  }
  const costoOrigenBase = origen === "sumaj_illari" ? (varianteRaw.costoUnitario ?? null) : null;
  const costoOrigen = invOrigenActual ? invOrigenActual.costoUnitario : costoOrigenBase;
  const stockMinimoOrigenBase = origen === "sumaj_illari" ? (varianteRaw.stockMinimo ?? null) : null;

  // El destino puede no tener registro de inventario todavía para este
  // producto (ej. la primera vez que Tienda X recibe algo).
  const invDestinoActual = inventariosActuales.find((i) => i.id === claveDestino);
  const stockDestinoBase = destino === "sumaj_illari" ? (varianteRaw.stock || 0) : 0;
  const costoDestinoBase = destino === "sumaj_illari" ? (varianteRaw.costoUnitario ?? null) : null;
  const stockDestino = invDestinoActual ? invDestinoActual.stock : stockDestinoBase;
  const costoDestinoActual = invDestinoActual ? invDestinoActual.costoUnitario : costoDestinoBase;

  const nuevoCostoDestino = costoDestinoActual != null && stockDestino > 0
    ? round2((stockDestino * costoDestinoActual + cantidad * (costoOrigen ?? 0)) / (stockDestino + cantidad))
    : costoOrigen;

  const nuevoInvOrigen = {
    id: claveOrigen, varianteId: productoId, ubicacion: origen,
    stock: round2(stockOrigen - cantidad),
    stockMinimo: invOrigenActual ? invOrigenActual.stockMinimo : stockMinimoOrigenBase,
    costoUnitario: costoOrigen,
    fechaIncorporacion: invOrigenActual ? invOrigenActual.fechaIncorporacion : (varianteRaw.fechaIncorporacion || todayStr()),
  };
  const nuevoInvDestino = {
    id: claveDestino, varianteId: productoId, ubicacion: destino,
    stock: round2(stockDestino + cantidad),
    costoUnitario: nuevoCostoDestino,
    stockMinimo: invDestinoActual ? invDestinoActual.stockMinimo : null,
    fechaIncorporacion: invDestinoActual ? invDestinoActual.fechaIncorporacion : todayStr(),
  };

  const nuevosInventarios = [
    ...inventariosActuales.filter((i) => i.id !== claveOrigen && i.id !== claveDestino),
    nuevoInvOrigen, nuevoInvDestino,
  ];

  const nombreProd = `${producto.producto}${producto.talla !== "Única" ? " - " + producto.talla : ""}`;
  const ahora = Date.now();
  const movSalida = {
    id: `M${ahora}S`, fecha: todayStr(), tipo: "SALIDA", productoId, ubicacion: origen,
    productoNombre: nombreProd, cantidad, motivo: `Transferencia a ${NOMBRE_UBICACION[destino] || destino}`,
  };
  const movEntrada = {
    id: `M${ahora}E`, fecha: todayStr(), tipo: "ENTRADA", productoId, ubicacion: destino,
    productoNombre: nombreProd, cantidad, motivo: `Transferencia desde ${NOMBRE_UBICACION[origen] || origen}`,
  };
  const transferencia = {
    id: `T${ahora}`, fecha: todayStr(), productoId, codigo: producto.codigo, productoNombre: nombreProd,
    cantidad, origen, destino, usuario: usuario || "?",
  };

  return { nuevosInventarios, movSalida, movEntrada, transferencia };
}
