import React, { useState } from "react";
import {
  ArrowRightLeft, Plus, XCircle, AlertTriangle, Search, ArrowUpRight, ArrowDownLeft,
} from "lucide-react";
import { todayStr, round2, formatFecha } from "../utils/format.js";
import { UBICACIONES } from "../utils/constants.js";
import EmptyState from "../components/EmptyState.jsx";
import SelectorProducto from "../components/SelectorProducto.jsx";
import { operarInventarioSeguro, registrarAuditoria } from "../firestoreSync.js";

const NOMBRE_UBICACION = Object.fromEntries(UBICACIONES.map((u) => [u.id, u.nombre]));
const EMPRESA_UBICACION = Object.fromEntries(UBICACIONES.map((u) => [u.id, u.empresa]));

// Cuánto stock tiene un producto en una ubicación específica, para
// ubicaciones que NO son la de quien está usando la app ahora mismo
// (por eso necesita el producto "crudo" del catálogo, con su stock
// antiguo de antes de separar por ubicación — ver App.jsx →
// productosCompletos, que aplica exactamente el mismo criterio pero
// para la ubicación de quien mira la pantalla).
function stockEnUbicacion(varianteRaw, ubicacionId, inventarios) {
  if (!varianteRaw) return 0;
  const inv = (inventarios || []).find((i) => i.id === `${varianteRaw.id}__${ubicacionId}`);
  if (inv) return inv.stock || 0;
  return ubicacionId === "sumaj_illari" ? (varianteRaw.stock || 0) : 0;
}

export default function Transferencias({ productos, variantes, inventarios, transferencias, showToast, nombre, rol, ubicacion, esConsolidado }) {
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [destino, setDestino] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [consultaAbierta, setConsultaAbierta] = useState(false);

  const producto = productos.find((p) => p.id === productoId);
  const destinosDisponibles = UBICACIONES.filter((u) => u.id !== ubicacion);
  const esEntreEmpresas = destino && EMPRESA_UBICACION[destino] !== EMPRESA_UBICACION[ubicacion];

  async function handleSubmit(e) {
    e.preventDefault();
    if (guardando) return;
    if (!productoId) return setError("Selecciona un producto.");
    if (!producto) return setError("Ese producto ya no existe en el catálogo. Actualiza la página e inténtalo de nuevo.");
    if (!destino) return setError("Selecciona a qué ubicación envías.");
    const cant = Number(cantidad);
    if (!cantidad || isNaN(cant) || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (producto.stock < cant) {
      return setError(`Stock insuficiente. Solo hay ${producto.stock} ${producto.unidad} en ${NOMBRE_UBICACION[ubicacion]}.`);
    }

    setGuardando(true);
    setError("");
    try {
      await operarInventarioSeguro(["inventarios", "movimientos", "transferencias"], (actuales) => {
        const claveOrigen = `${productoId}__${ubicacion}`;
        const claveDestino = `${productoId}__${destino}`;

        const invOrigenActual = actuales.inventarios.find((i) => i.id === claveOrigen);
        const stockOrigen = invOrigenActual ? invOrigenActual.stock : (producto?.stock || 0);
        if (stockOrigen < cant) {
          throw new Error(`Stock insuficiente. Ahora mismo solo hay ${stockOrigen} ${producto?.unidad || ""} en ${NOMBRE_UBICACION[ubicacion]} (puede que alguien más lo haya movido).`);
        }
        const costoOrigen = invOrigenActual ? invOrigenActual.costoUnitario : (producto?.costoUnitario ?? null);

        // El destino puede no tener registro de inventario todavía para
        // este producto (ej. la primera vez que Tienda X recibe algo).
        const invDestinoActual = actuales.inventarios.find((i) => i.id === claveDestino);
        const varianteRaw = (variantes || []).find((v) => v.id === productoId);
        const stockDestinoBase = destino === "sumaj_illari" ? (varianteRaw?.stock || 0) : 0;
        const costoDestinoBase = destino === "sumaj_illari" ? (varianteRaw?.costoUnitario ?? null) : null;
        const stockDestino = invDestinoActual ? invDestinoActual.stock : stockDestinoBase;
        const costoDestinoActual = invDestinoActual ? invDestinoActual.costoUnitario : costoDestinoBase;

        // Promedio ponderado — el mismo mecanismo que ya usa "Compras"
        // cuando llega mercadería a un costo distinto al que ya había.
        // Si el destino no tenía nada de este producto, el promedio da
        // exactamente el costo del origen.
        const nuevoCostoDestino = costoDestinoActual != null && stockDestino > 0
          ? round2((stockDestino * costoDestinoActual + cant * (costoOrigen ?? 0)) / (stockDestino + cant))
          : costoOrigen;

        const nuevoInvOrigen = {
          id: claveOrigen, varianteId: productoId, ubicacion,
          stock: round2(stockOrigen - cant),
          stockMinimo: invOrigenActual ? invOrigenActual.stockMinimo : (producto?.stockMinimo ?? null),
          costoUnitario: costoOrigen,
          fechaIncorporacion: invOrigenActual ? invOrigenActual.fechaIncorporacion : (producto?.fechaIncorporacion || todayStr()),
        };
        const nuevoInvDestino = {
          id: claveDestino, varianteId: productoId, ubicacion: destino,
          stock: round2(stockDestino + cant),
          costoUnitario: nuevoCostoDestino,
          stockMinimo: invDestinoActual ? invDestinoActual.stockMinimo : null,
          fechaIncorporacion: invDestinoActual ? invDestinoActual.fechaIncorporacion : todayStr(),
        };

        const nuevosInventarios = [
          ...actuales.inventarios.filter((i) => i.id !== claveOrigen && i.id !== claveDestino),
          nuevoInvOrigen, nuevoInvDestino,
        ];

        const nombreProd = `${producto.producto}${producto.talla !== "Única" ? " - " + producto.talla : ""}`;
        const ahora = Date.now();
        const movSalida = {
          id: `M${ahora}S`, fecha: todayStr(), tipo: "SALIDA", productoId, ubicacion,
          productoNombre: nombreProd, cantidad: cant, motivo: `Transferencia a ${NOMBRE_UBICACION[destino]}`,
        };
        const movEntrada = {
          id: `M${ahora}E`, fecha: todayStr(), tipo: "ENTRADA", productoId, ubicacion: destino,
          productoNombre: nombreProd, cantidad: cant, motivo: `Transferencia desde ${NOMBRE_UBICACION[ubicacion]}`,
        };
        const transferencia = {
          id: `T${ahora}`, fecha: todayStr(), productoId, codigo: producto.codigo, productoNombre: nombreProd,
          cantidad: cant, origen: ubicacion, destino, usuario: nombre || "?",
        };

        return {
          inventarios: nuevosInventarios,
          movimientos: [...actuales.movimientos, movSalida, movEntrada],
          transferencias: [...actuales.transferencias, transferencia],
        };
      });

      showToast("success", `Transferencia registrada: ${cant} ${producto.unidad} a ${NOMBRE_UBICACION[destino]}.`);
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "TRANSFERENCIA", ubicacion,
        detalle: `Transferencia de ${cant} ${producto?.producto || ""}${producto?.talla && producto.talla !== "Única" ? " - " + producto.talla : ""} de ${NOMBRE_UBICACION[ubicacion]} a ${NOMBRE_UBICACION[destino]}`,
      }).catch(() => {});
      setCantidad(""); setError("");
    } catch (err) {
      setError(err && err.message ? err.message : "No se pudo registrar la transferencia. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const historial = [...(transferencias || [])].sort((a, b) => (a.id < b.id ? 1 : -1));

  if (productos.length === 0) {
    return <EmptyState icon={ArrowRightLeft} title="No hay productos todavía" body="Registra al menos un producto antes de poder transferir stock entre ubicaciones." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-stone-800">Transferencias entre ubicaciones</h2>
        <button
          type="button"
          onClick={() => setConsultaAbierta(true)}
          className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-50 transition inline-flex items-center gap-1.5"
        >
          <Search size={15} /> Consultar en otras sedes
        </button>
      </div>

      {esConsolidado ? (
        <div className="max-w-lg bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Estás viendo el consolidado de todas las sedes. Elige una sede específica arriba (en el menú) para poder registrar una transferencia — en modo consolidado no hay un origen desde el cual enviar.
        </div>
      ) : (
      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Producto</label>
            <SelectorProducto productos={productos} value={productoId} onChange={setProductoId} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad</label>
              <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="1"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Enviar a</label>
              <select value={destino} onChange={(e) => setDestino(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Selecciona...</option>
                {destinosDisponibles.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {esEntreEmpresas && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Esta transferencia es entre empresas distintas ({EMPRESA_UBICACION[ubicacion]} ↔ {EMPRESA_UBICACION[destino]}) — verifica si requiere guía de remisión.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <XCircle size={14} /> {error}
            </p>
          )}

          <button type="button" onClick={handleSubmit} disabled={guardando}
            className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition flex items-center justify-center gap-2">
            <Plus size={16} /> {guardando ? "Guardando..." : "Registrar transferencia"}
          </button>
        </form>
      </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-stone-600 mb-2">Historial ({esConsolidado ? "todas las sedes" : NOMBRE_UBICACION[ubicacion]})</h3>
        {historial.length === 0 ? (
          <EmptyState icon={ArrowRightLeft} title="Todavía no hay transferencias" body="Acá vas a ver las transferencias enviadas y recibidas por esta ubicación." />
        ) : (
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-stone-600">Fecha</th>
                    <th className="text-left px-4 py-2 font-medium text-stone-600">Producto</th>
                    <th className="text-right px-4 py-2 font-medium text-stone-600">Cant.</th>
                    <th className="text-left px-4 py-2 font-medium text-stone-600">Movimiento</th>
                    <th className="text-left px-4 py-2 font-medium text-stone-600">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((t) => {
                    const enviada = t.origen === ubicacion;
                    return (
                      <tr key={t.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                        <td className="px-4 py-2 text-stone-600 whitespace-nowrap">{formatFecha(t.fecha)}</td>
                        <td className="px-4 py-2 text-stone-800">
                          {t.productoNombre} <span className="text-stone-400 font-mono text-xs ml-1">{t.codigo}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-stone-700">{t.cantidad}</td>
                        <td className="px-4 py-2">
                          {esConsolidado ? (
                            <span className="inline-flex items-center gap-1 text-stone-600">
                              {NOMBRE_UBICACION[t.origen] || t.origen} <ArrowRightLeft size={12} className="text-stone-400" /> {NOMBRE_UBICACION[t.destino] || t.destino}
                            </span>
                          ) : enviada ? (
                            <span className="inline-flex items-center gap-1 text-red-700">
                              <ArrowUpRight size={13} /> Enviado a {NOMBRE_UBICACION[t.destino] || t.destino}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-teal-700">
                              <ArrowDownLeft size={13} /> Recibido de {NOMBRE_UBICACION[t.origen] || t.origen}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-stone-600">{t.usuario}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {consultaAbierta && (
        <ConsultaOtrasSedes
          productos={productos}
          variantes={variantes}
          inventarios={inventarios}
          ubicacion={ubicacion}
          onClose={() => setConsultaAbierta(false)}
        />
      )}
    </div>
  );
}

// Consulta puntual: cuánto stock hay de UN producto en las otras sedes.
// A propósito no existe ninguna forma de listar el catálogo completo de
// otra ubicación desde acá — solo se puede preguntar por un producto a
// la vez, y solo se muestra la cantidad (nunca costo, precio ni margen).
function ConsultaOtrasSedes({ productos, variantes, inventarios, ubicacion, onClose }) {
  const [productoId, setProductoId] = useState("");
  const producto = productos.find((p) => p.id === productoId);
  const varianteRaw = (variantes || []).find((v) => v.id === productoId);
  const otras = UBICACIONES.filter((u) => u.id !== ubicacion);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg p-5 max-w-sm w-full">
        <h3 className="font-semibold text-stone-900 mb-1">Consultar en otras sedes</h3>
        <p className="text-sm text-stone-500 mb-4">Elige un producto para ver cuánto stock hay en las otras ubicaciones.</p>

        <SelectorProducto productos={productos} value={productoId} onChange={setProductoId} />

        {producto && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-stone-700 font-medium">
              {producto.id} <span className="text-stone-400 font-normal">({producto.producto}{producto.talla !== "Única" ? ` talla ${producto.talla}` : ""})</span>
            </p>
            <div className="space-y-1.5">
              {otras.map((u) => {
                const stock = stockEnUbicacion(varianteRaw, u.id, inventarios);
                return (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm">
                    <span className="text-stone-600">{u.nombre}</span>
                    {stock > 0 ? (
                      <span className="font-semibold text-stone-900">{stock} {producto.unidad}</span>
                    ) : (
                      <span className="text-stone-400">sin stock</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button onClick={onClose} className="w-full py-2 mt-4 rounded-lg border border-stone-300 text-sm font-medium text-stone-600 hover:bg-stone-50">
          Cerrar
        </button>
      </div>
    </div>
  );
}
