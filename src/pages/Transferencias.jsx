import React, { useState } from "react";
import {
  ArrowRightLeft, Plus, XCircle, AlertTriangle, Search, ArrowUpRight, ArrowDownLeft, Check, Clock,
} from "lucide-react";
import { todayStr, formatFecha } from "../utils/format.js";
import { UBICACIONES } from "../utils/constants.js";
import EmptyState from "../components/EmptyState.jsx";
import SelectorProducto from "../components/SelectorProducto.jsx";
import { operarInventarioSeguro, registrarAuditoria } from "../firestoreSync.js";
import { calcularTransferencia } from "../utils/transferenciaLogica.js";

const NOMBRE_UBICACION = Object.fromEntries(UBICACIONES.map((u) => [u.id, u.nombre]));
const EMPRESA_UBICACION = Object.fromEntries(UBICACIONES.map((u) => [u.id, u.empresa]));

const ETIQUETA_ESTADO = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-700" },
  entregado: { label: "Entregado", color: "bg-teal-100 text-teal-700" },
  rechazado: { label: "Rechazado", color: "bg-stone-100 text-stone-500" },
};

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

export default function Transferencias({ productos, variantes, inventarios, transferencias, solicitudes, showToast, nombre, rol, ubicacion, esConsolidado }) {
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [destino, setDestino] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [consultaAbierta, setConsultaAbierta] = useState(false);
  const [respondiendoId, setRespondiendoId] = useState(null);

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
      await operarInventarioSeguro(["inventarios", "costos", "movimientos", "transferencias"], (actuales) => {
        const { nuevosInventarios, nuevosCostos, movSalida, movEntrada, transferencia } = calcularTransferencia({
          inventariosActuales: actuales.inventarios, costosActuales: actuales.costos, variantes, producto, productoId,
          cantidad: cant, origen: ubicacion, destino, usuario: nombre,
        });
        return {
          inventarios: nuevosInventarios,
          costos: nuevosCostos,
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

  // Crea una solicitud por cada sede con cantidad > 0 — todas juntas, en
  // una sola operación. No mueve stock: eso pasa recién cuando la sede
  // que la recibe la marca como "Entregado" (ver entregarSolicitud).
  async function crearSolicitudes(pId, cantidadesPorSede) {
    const prod = productos.find((p) => p.id === pId);
    if (!prod) {
      showToast("error", "Ese producto ya no existe en el catálogo.");
      return;
    }
    const entradas = Object.entries(cantidadesPorSede).filter(([, c]) => Number(c) > 0);
    if (entradas.length === 0) return;
    const nombreProd = `${prod.producto}${prod.talla !== "Única" ? " - " + prod.talla : ""}`;

    try {
      await operarInventarioSeguro(["solicitudes"], (actuales) => {
        const ahora = Date.now();
        const nuevas = entradas.map(([proveedor, c], i) => ({
          id: `S${ahora}-${i}`, fecha: todayStr(), productoId: pId, codigo: prod.codigo, productoNombre: nombreProd,
          cantidad: Number(c), solicitante: ubicacion, proveedor, estado: "pendiente", usuarioSolicito: nombre || "?",
        }));
        return { solicitudes: [...actuales.solicitudes, ...nuevas] };
      });
      showToast("success", entradas.length === 1 ? "Solicitud enviada." : `${entradas.length} solicitudes enviadas.`);
      entradas.forEach(([proveedor, c]) => {
        registrarAuditoria({
          fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "SOLICITUD_CREADA", ubicacion,
          detalle: `Solicitó ${c} ${nombreProd} a ${NOMBRE_UBICACION[proveedor]}`,
        }).catch(() => {});
      });
    } catch (err) {
      showToast("error", "No se pudo enviar la solicitud: " + (err && err.message ? err.message : String(err)));
    }
  }

  // Entregar: revalida el stock con el dato REAL del servidor en este
  // instante (no el que había cuando se pidió — puede que alguien haya
  // vendido esas unidades mientras tanto), y recién ahí mueve el stock,
  // reutilizando el mismo cálculo que "Registrar transferencia". El
  // origen es la sede guardada en la solicitud (quien entrega), no la
  // que se esté mirando ahora — por eso esto funciona igual en modo
  // consolidado.
  async function entregarSolicitud(solicitud) {
    setRespondiendoId(solicitud.id);
    try {
      await operarInventarioSeguro(["inventarios", "costos", "movimientos", "transferencias", "solicitudes"], (actuales) => {
        const actual = actuales.solicitudes.find((s) => s.id === solicitud.id);
        if (!actual) throw new Error("Esta solicitud ya no existe.");
        if (actual.estado !== "pendiente") throw new Error("Esta solicitud ya fue respondida.");

        const prod = productos.find((p) => p.id === solicitud.productoId);
        const { nuevosInventarios, nuevosCostos, movSalida, movEntrada, transferencia } = calcularTransferencia({
          inventariosActuales: actuales.inventarios, costosActuales: actuales.costos, variantes, producto: prod, productoId: solicitud.productoId,
          cantidad: solicitud.cantidad, origen: solicitud.proveedor, destino: solicitud.solicitante, usuario: nombre,
        });

        const nuevasSolicitudes = actuales.solicitudes.map((s) =>
          s.id === solicitud.id
            ? { ...s, estado: "entregado", usuarioRespondio: nombre || "?", fechaRespuesta: todayStr(), transferenciaId: transferencia.id }
            : s
        );

        return {
          inventarios: nuevosInventarios,
          costos: nuevosCostos,
          movimientos: [...actuales.movimientos, movSalida, movEntrada],
          transferencias: [...actuales.transferencias, transferencia],
          solicitudes: nuevasSolicitudes,
        };
      });
      showToast("success", `Entregado: ${solicitud.cantidad} ${solicitud.productoNombre} a ${NOMBRE_UBICACION[solicitud.solicitante]}.`);
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "SOLICITUD_ENTREGADA", ubicacion: solicitud.proveedor,
        detalle: `Entregó ${solicitud.cantidad} ${solicitud.productoNombre} a ${NOMBRE_UBICACION[solicitud.solicitante]}`,
      }).catch(() => {});
    } catch (err) {
      showToast("error", err && err.message ? err.message : "No se pudo entregar la solicitud.");
    } finally {
      setRespondiendoId(null);
    }
  }

  async function rechazarSolicitud(solicitud) {
    setRespondiendoId(solicitud.id);
    try {
      await operarInventarioSeguro(["solicitudes"], (actuales) => {
        const actual = actuales.solicitudes.find((s) => s.id === solicitud.id);
        if (!actual) throw new Error("Esta solicitud ya no existe.");
        if (actual.estado !== "pendiente") throw new Error("Esta solicitud ya fue respondida.");
        const nuevasSolicitudes = actuales.solicitudes.map((s) =>
          s.id === solicitud.id ? { ...s, estado: "rechazado", usuarioRespondio: nombre || "?", fechaRespuesta: todayStr() } : s
        );
        return { solicitudes: nuevasSolicitudes };
      });
      showToast("success", "Solicitud rechazada.");
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "SOLICITUD_RECHAZADA", ubicacion: solicitud.proveedor,
        detalle: `Rechazó la solicitud de ${solicitud.cantidad} ${solicitud.productoNombre} de ${NOMBRE_UBICACION[solicitud.solicitante]}`,
      }).catch(() => {});
    } catch (err) {
      showToast("error", err && err.message ? err.message : "No se pudo rechazar la solicitud.");
    } finally {
      setRespondiendoId(null);
    }
  }

  const historialTransferencias = [...(transferencias || [])].sort((a, b) => (a.id < b.id ? 1 : -1));
  const historialSolicitudes = [...(solicitudes || [])].sort((a, b) => (a.id < b.id ? 1 : -1));

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

      <div>
        <h3 className="text-sm font-semibold text-stone-600 mb-2">
          Solicitudes {esConsolidado ? "(todas las sedes)" : `(${NOMBRE_UBICACION[ubicacion]})`}
        </h3>
        {historialSolicitudes.length === 0 ? (
          <EmptyState icon={Clock} title="Todavía no hay solicitudes" body="Cuando pidas producto a otra sede (o te lo pidan a vos) desde 'Consultar en otras sedes', va a aparecer acá." />
        ) : (
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-stone-600">Fecha</th>
                    <th className="text-left px-4 py-2 font-medium text-stone-600">Producto</th>
                    <th className="text-right px-4 py-2 font-medium text-stone-600">Cant.</th>
                    <th className="text-left px-4 py-2 font-medium text-stone-600">De → A</th>
                    <th className="text-left px-4 py-2 font-medium text-stone-600">Estado</th>
                    <th className="text-right px-4 py-2 font-medium text-stone-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historialSolicitudes.map((s) => {
                    const puedoResponder = s.estado === "pendiente" && (esConsolidado || s.proveedor === ubicacion);
                    const respondiendo = respondiendoId === s.id;
                    const etiqueta = ETIQUETA_ESTADO[s.estado] || ETIQUETA_ESTADO.pendiente;
                    return (
                      <tr key={s.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                        <td className="px-4 py-2 text-stone-600 whitespace-nowrap">{formatFecha(s.fecha)}</td>
                        <td className="px-4 py-2 text-stone-800">
                          {s.productoNombre} <span className="text-stone-400 font-mono text-xs ml-1">{s.codigo}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-stone-700">{s.cantidad}</td>
                        <td className="px-4 py-2 text-stone-600 whitespace-nowrap">
                          {NOMBRE_UBICACION[s.solicitante] || s.solicitante}
                          <ArrowRightLeft size={11} className="inline mx-1 text-stone-400" />
                          {NOMBRE_UBICACION[s.proveedor] || s.proveedor}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${etiqueta.color}`}>{etiqueta.label}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {puedoResponder ? (
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => entregarSolicitud(s)}
                                disabled={respondiendo}
                                className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-60 transition inline-flex items-center gap-1"
                              >
                                <Check size={12} /> Entregar
                              </button>
                              <button
                                onClick={() => rechazarSolicitud(s)}
                                disabled={respondiendo}
                                className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-60 transition"
                              >
                                Rechazar
                              </button>
                            </div>
                          ) : s.usuarioRespondio ? (
                            <span className="text-xs text-stone-400">{s.usuarioRespondio}</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
        {historialTransferencias.length === 0 ? (
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
                  {historialTransferencias.map((t) => {
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
          esConsolidado={esConsolidado}
          onSolicitar={crearSolicitudes}
          onClose={() => setConsultaAbierta(false)}
        />
      )}
    </div>
  );
}

// Consulta puntual: cuánto stock hay de UN producto en las otras sedes,
// y desde acá mismo, pedir cantidades a una o varias de esas sedes en
// una sola acción. A propósito no existe ninguna forma de listar el
// catálogo completo de otra ubicación desde acá — solo se puede
// preguntar por un producto a la vez, y solo se muestra la cantidad
// (nunca costo, precio ni margen).
function ConsultaOtrasSedes({ productos, variantes, inventarios, ubicacion, esConsolidado, onSolicitar, onClose }) {
  const [productoId, setProductoId] = useState("");
  const [cantidades, setCantidades] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const producto = productos.find((p) => p.id === productoId);
  const varianteRaw = (variantes || []).find((v) => v.id === productoId);
  const otras = UBICACIONES.filter((u) => u.id !== ubicacion);

  function cambiarProducto(id) {
    setProductoId(id);
    setCantidades({});
    setError("");
  }

  async function enviarSolicitud() {
    setError("");
    const entradas = Object.entries(cantidades).filter(([, v]) => v.trim() !== "");
    if (entradas.length === 0) return setError("Ingresa al menos una cantidad para pedir.");
    for (const [, v] of entradas) {
      const n = Number(v);
      if (isNaN(n) || n <= 0) return setError("Las cantidades deben ser números válidos, mayores a cero.");
    }
    setEnviando(true);
    const cantidadesPorSede = Object.fromEntries(entradas.map(([k, v]) => [k, Number(v)]));
    await onSolicitar(productoId, cantidadesPorSede);
    setEnviando(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg p-5 max-w-sm w-full">
        <h3 className="font-semibold text-stone-900 mb-1">Consultar en otras sedes</h3>
        <p className="text-sm text-stone-500 mb-4">
          Elige un producto para ver cuánto stock hay en las otras ubicaciones{!esConsolidado && " y pedir cantidades"}.
        </p>

        <SelectorProducto productos={productos} value={productoId} onChange={cambiarProducto} />

        {producto && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-stone-700 font-medium">
              {producto.id} <span className="text-stone-400 font-normal">({producto.producto}{producto.talla !== "Única" ? ` talla ${producto.talla}` : ""})</span>
            </p>
            <div className="space-y-1.5">
              {otras.map((u) => {
                const stock = stockEnUbicacion(varianteRaw, u.id, inventarios);
                return (
                  <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm">
                    <span className="text-stone-600 shrink-0">{u.nombre}</span>
                    <div className="flex items-center gap-2">
                      {stock > 0 ? (
                        <span className="font-semibold text-stone-900 whitespace-nowrap">{stock} {producto.unidad}</span>
                      ) : (
                        <span className="text-stone-400 whitespace-nowrap">sin stock</span>
                      )}
                      {!esConsolidado && (
                        <input
                          type="number" min="0" placeholder="pedir"
                          value={cantidades[u.id] || ""}
                          onChange={(e) => setCantidades({ ...cantidades, [u.id]: e.target.value })}
                          className="w-16 px-1.5 py-1 rounded border border-stone-300 text-xs text-stone-800 bg-white text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {esConsolidado && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Elige una sede específica arriba (en el menú) para poder pedir producto — en modo consolidado no hay a dónde recibirlo.
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <XCircle size={14} /> {error}
              </p>
            )}

            {!esConsolidado && (
              <button type="button" onClick={enviarSolicitud} disabled={enviando}
                className="w-full py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition">
                {enviando ? "Enviando..." : "Pedir cantidades ingresadas"}
              </button>
            )}
          </div>
        )}

        <button onClick={onClose} className="w-full py-2 mt-3 rounded-lg border border-stone-300 text-sm font-medium text-stone-600 hover:bg-stone-50">
          Cerrar
        </button>
      </div>
    </div>
  );
}
