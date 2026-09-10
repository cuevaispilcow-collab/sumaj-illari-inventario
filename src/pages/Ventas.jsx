import React, { useState, useMemo } from "react";
import {
  AlertTriangle, Plus, XCircle, ReceiptText,
} from "lucide-react";
import { todayStr, round2, formatSoles, formatFecha } from "../utils/format.js";
import { UBICACIONES } from "../utils/constants.js";
import EmptyState from "../components/EmptyState.jsx";
import SelectorProducto from "../components/SelectorProducto.jsx";
import { operarInventarioSeguro, registrarAuditoria } from "../firestoreSync.js";

const NOMBRE_UBICACION = Object.fromEntries(UBICACIONES.map((u) => [u.id, u.nombre]));

export default function Ventas({ productos, movimientos, ventas, onSave, onSaveInventarios, showToast, nombre, rol, ubicacion, esConsolidado }) {
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(todayStr());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [efectivo, setEfectivo] = useState("");
  const [yape, setYape] = useState("");
  const [tarjeta, setTarjeta] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const producto = productos.find((p) => p.id === productoId);
  const cant = Number(cantidad) || 0;
  const prec = Number(precio) || 0;
  const totalCalc = round2(cant * prec);
  const pagoSum = round2((Number(efectivo) || 0) + (Number(yape) || 0) + (Number(tarjeta) || 0));
  const pagoDescuadrado = (efectivo !== "" || yape !== "" || tarjeta !== "") && totalCalc > 0 && pagoSum !== totalCalc;
  const precioBajoMinimo = producto && producto.precioMinimo != null && prec > 0 && prec < producto.precioMinimo;

  function reset() {
    setProductoId(""); setCantidad(""); setDescripcion(""); setPrecio("");
    setEfectivo(""); setYape(""); setTarjeta(""); setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (guardando) return;
    if (!productoId) return setError("Selecciona un producto.");
    if (!cantidad || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (!precio || prec < 0) return setError("Ingresa un precio válido.");

    // Validación rápida en pantalla, con lo que ya está cargado (para
    // avisar temprano). La validación que realmente cuenta pasa dentro
    // de la transacción de abajo, contra el stock real del servidor en
    // ese instante — así dos ventas simultáneas del mismo producto
    // nunca se pisan entre sí.
    if (producto && producto.stock < cant) {
      return setError(`Stock insuficiente. Solo hay ${producto.stock} ${producto.unidad}.`);
    }

    const claveInventario = `${productoId}__${ubicacion}`;

    setGuardando(true);
    setError("");
    try {
      await operarInventarioSeguro(["inventarios", "ventas", "movimientos"], (actuales) => {
        // "costos" se lee (ver más abajo) pero no se escribe acá.
        const invActual = actuales.inventarios.find((i) => i.id === claveInventario);
        // Si todavía no existe un registro de inventario para esta
        // ubicación (ej. primera venta desde que separamos por
        // ubicación), se usa el stock que ya traía el producto como
        // punto de partida — así no se pierde nada de lo que ya existía.
        const stockBase = invActual ? invActual.stock : (producto?.stock || 0);
        if (stockBase < cant) {
          throw new Error(`Stock insuficiente. Ahora mismo solo hay ${stockBase} ${producto?.unidad || ""} (puede que alguien más acabe de vender).`);
        }

        const nuevoInv = {
          id: claveInventario, varianteId: productoId, ubicacion,
          stock: round2(stockBase - cant),
          stockMinimo: invActual ? invActual.stockMinimo : (producto?.stockMinimo ?? null),
          fechaIncorporacion: invActual ? invActual.fechaIncorporacion : (producto?.fechaIncorporacion || todayStr()),
        };
        const nuevosInventarios = invActual
          ? actuales.inventarios.map((i) => (i.id === claveInventario ? nuevoInv : i))
          : [...actuales.inventarios, nuevoInv];

        // El costo unitario vive aparte, en "costos" (protegido — ver la
        // tarea de seguridad del costo unitario). Se lee solo para
        // copiarlo dentro de esta venta puntual (para poder calcular el
        // margen después); la venta no lo cambia, así que no hace falta
        // reescribir nada en "costos" acá.
        const costoActual = actuales.costos.find((c) => c.id === claveInventario);
        const costoParaVenta = costoActual ? costoActual.costoUnitario : (producto?.costoUnitario ?? null);

        const venta = {
          id: `V${Date.now()}`,
          fecha, idProducto: producto.codigo, producto: producto.producto, ubicacion,
          cantidad: cant, talla: producto.talla, descripcion: descripcion || producto.descripcion || "",
          precio: prec, efectivo: Number(efectivo) || 0, yape: Number(yape) || 0, tarjeta: Number(tarjeta) || 0, total: totalCalc,
          costoUnitario: costoParaVenta,
        };
        const mov = {
          id: `M${Date.now()}`, fecha, tipo: "VENTA", productoId, ubicacion,
          productoNombre: `${producto.producto}${producto.talla !== "Única" ? " - " + producto.talla : ""}`,
          cantidad: cant, motivo: "Venta",
        };

        return {
          inventarios: nuevosInventarios,
          ventas: [...actuales.ventas, venta],
          movimientos: [...actuales.movimientos, mov],
        };
      }, ["costos"]);

      showToast("success", "Venta registrada. Stock actualizado.");
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "VENTA", ubicacion,
        detalle: `Vendió ${cant} ${producto?.producto || ""}${producto?.talla && producto.talla !== "Única" ? " - " + producto.talla : ""} — S/ ${totalCalc.toFixed(2)}`,
      }).catch(() => {});
      reset();
      setShowForm(false);
    } catch (err) {
      setError(err && err.message ? err.message : "No se pudo registrar la venta. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const porDia = useMemo(() => {
    const groups = {};
    for (const v of ventas) {
      if (!groups[v.fecha]) groups[v.fecha] = [];
      groups[v.fecha].push(v);
    }
    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [ventas]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700">Registro de ventas</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-1.5"
        >
          <Plus size={15} /> Registrar venta
        </button>
      </div>

      {showForm && esConsolidado && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Estás viendo el consolidado de todas las sedes. Elige una sede específica arriba (en el menú) para poder registrar una venta — en modo consolidado no hay a dónde atribuirla.
        </div>
      )}
      {showForm && !esConsolidado && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 shadow-sm p-4 space-y-3">
          {productos.length === 0 ? (
            <p className="text-sm text-stone-500">
              No hay productos en el catálogo todavía. Ve a la pestaña "Nuevo producto" para registrar el primero.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Fecha</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad</label>
                  <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="1"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Producto (ID · talla)</label>
                <SelectorProducto productos={productos} value={productoId} onChange={setProductoId} />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Descripción (opcional)</label>
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Color, detalle específico de esta venta"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Precio unitario (S/)</label>
                  <input type="number" min="0" step="0.5" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0.00"
                    className={`w-full px-3 py-2 rounded-lg border text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 ${precioBajoMinimo ? "border-amber-400 focus:ring-amber-500" : "border-stone-300 focus:ring-red-500"}`} />
                  {precioBajoMinimo && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> Por debajo del mínimo (S/ {producto.precioMinimo}).
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Efectivo (S/)</label>
                  <input type="number" min="0" step="0.5" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Yape (S/)</label>
                  <input type="number" min="0" step="0.5" value={yape} onChange={(e) => setYape(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Tarjeta (S/)</label>
                  <input type="number" min="0" step="0.5" value={tarjeta} onChange={(e) => setTarjeta(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>

              <div className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-sm text-stone-600">Total (cantidad × precio)</span>
                <span className="text-lg font-semibold text-stone-900">{formatSoles(totalCalc)}</span>
              </div>

              {pagoDescuadrado && (
                <p className="text-sm text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Efectivo + Yape + Tarjeta ({formatSoles(pagoSum)}) no coincide con el total ({formatSoles(totalCalc)}). Revisa antes de guardar.
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <XCircle size={14} /> {error}
                </p>
              )}

              <button type="button" onClick={handleSubmit} disabled={guardando}
                className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition">
                {guardando ? "Guardando..." : "Guardar venta"}
              </button>
            </>
          )}
        </form>
      )}

      {ventas.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Todavía no hay ventas registradas" body="Cada venta que registres aquí descuenta el stock automáticamente." />
      ) : (
        <div className="space-y-4">
          {porDia.map(([fecha, items]) => {
            const totalDia = round2(items.reduce((s, v) => s + v.total, 0));
            return (
              <div key={fecha} className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
                <div className="bg-stone-50 px-4 py-2 flex items-center justify-between border-b border-stone-200">
                  <span className="text-sm font-semibold text-stone-700 capitalize">{formatFecha(fecha)}</span>
                  <span className="text-sm font-semibold text-stone-900">Total: {formatSoles(totalDia)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-stone-500 border-b border-stone-100">
                        {esConsolidado && <th className="text-left px-3 py-1.5 font-medium">Sede</th>}
                        <th className="text-left px-3 py-1.5 font-medium">ID producto</th>
                        <th className="text-left px-3 py-1.5 font-medium">Producto</th>
                        <th className="text-left px-3 py-1.5 font-medium">Talla</th>
                        <th className="text-left px-3 py-1.5 font-medium">Descripción</th>
                        <th className="text-right px-3 py-1.5 font-medium">Cant.</th>
                        <th className="text-right px-3 py-1.5 font-medium">Precio</th>
                        <th className="text-right px-3 py-1.5 font-medium">Efectivo</th>
                        <th className="text-right px-3 py-1.5 font-medium">Yape</th>
                        <th className="text-right px-3 py-1.5 font-medium">Tarjeta</th>
                        <th className="text-right px-3 py-1.5 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((v) => (
                        <tr key={v.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                          {esConsolidado && <td className="px-3 py-1.5 text-stone-500">{NOMBRE_UBICACION[v.ubicacion] || NOMBRE_UBICACION.sumaj_illari}</td>}
                          <td className="px-3 py-1.5 text-stone-500 font-mono text-xs">{v.idProducto}</td>
                          <td className="px-3 py-1.5 text-stone-800">{v.producto}</td>
                          <td className="px-3 py-1.5 text-stone-500">{v.talla}</td>
                          <td className="px-3 py-1.5 text-stone-500">{v.descripcion}</td>
                          <td className="px-3 py-1.5 text-right text-stone-700">{v.cantidad}</td>
                          <td className="px-3 py-1.5 text-right text-stone-700">{formatSoles(v.precio)}</td>
                          <td className="px-3 py-1.5 text-right text-stone-500">{v.efectivo ? formatSoles(v.efectivo) : "-"}</td>
                          <td className="px-3 py-1.5 text-right text-stone-500">{v.yape ? formatSoles(v.yape) : "-"}</td>
                          <td className="px-3 py-1.5 text-right text-stone-500">{v.tarjeta ? formatSoles(v.tarjeta) : "-"}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-stone-900">{formatSoles(v.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

