import React, { useState, useMemo } from "react";
import {
  Plus, XCircle, Truck,
} from "lucide-react";
import { todayStr, round2, formatSoles, formatFecha } from "../utils/format.js";
import EmptyState from "../components/EmptyState.jsx";
import SelectorProducto from "../components/SelectorProducto.jsx";
import { operarInventarioSeguro } from "../firestoreSync.js";

export default function Compras({ productos, movimientos, compras, onSave, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(todayStr());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const producto = productos.find((p) => p.id === productoId);
  const cant = Number(cantidad) || 0;
  const costo = Number(costoUnitario) || 0;
  const totalCalc = round2(cant * costo);

  function reset() {
    setProductoId(""); setCantidad(""); setCostoUnitario(""); setProveedor(""); setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;
    if (!productoId) return setError("Selecciona un producto.");
    if (!cantidad || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (costoUnitario === "" || costo < 0) return setError("Ingresa un costo unitario válido.");
    if (!proveedor.trim()) return setError("Ingresa el nombre del proveedor.");

    setEnviando(true);
    setError("");
    try {
      let costoFinal = costo;
      // El costo promedio ponderado depende del stock y costo que haya
      // JUSTO antes de guardar. Si dos compras del mismo producto se
      // registran casi al mismo tiempo, calcular esto con datos viejos
      // dejaría el costo promedio mal calculado — por eso se recalcula
      // adentro de la transacción, con el stock real del servidor.
      await operarInventarioSeguro(["productos", "compras", "movimientos"], (actuales) => {
        const prodReal = actuales.productos.find((p) => p.id === productoId);
        if (!prodReal) throw new Error("Ese producto ya no existe en el catálogo. Actualiza la página e inténtalo de nuevo.");

        const stockAnterior = prodReal.stock;
        const costoAnterior = prodReal.costoUnitario;
        const nuevoCosto = costoAnterior != null && stockAnterior > 0
          ? round2((stockAnterior * costoAnterior + cant * costo) / (stockAnterior + cant))
          : costo;
        costoFinal = nuevoCosto;

        const nuevosProductos = actuales.productos.map((p) =>
          p.id === productoId ? { ...p, stock: p.stock + cant, costoUnitario: nuevoCosto } : p
        );
        const compra = {
          id: `C${Date.now()}`,
          fecha, productoId, codigo: prodReal.codigo, producto: prodReal.producto, talla: prodReal.talla,
          tipo: prodReal.tipo, cantidad: cant, costoUnitario: costo, proveedor: proveedor.trim(), total: totalCalc,
        };
        const mov = {
          id: `M${Date.now()}`, fecha, tipo: "ENTRADA", productoId,
          productoNombre: `${prodReal.producto}${prodReal.talla !== "Única" ? " - " + prodReal.talla : ""}`,
          cantidad: cant, motivo: `Compra a ${proveedor.trim()}`,
        };

        return {
          productos: nuevosProductos,
          compras: [...actuales.compras, compra],
          movimientos: [...actuales.movimientos, mov],
        };
      });

      showToast("success", `Compra registrada. Costo actualizado a ${formatSoles(costoFinal)}.`);
      reset();
      setShowForm(false);
    } catch (err) {
      setError("No se pudo guardar la compra: " + (err && err.message ? err.message : String(err)));
    } finally {
      setEnviando(false);
    }
  }

  const porDia = useMemo(() => {
    const groups = {};
    for (const c of compras) {
      if (!groups[c.fecha]) groups[c.fecha] = [];
      groups[c.fecha].push(c);
    }
    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [compras]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700">Registro de compras</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-1.5"
        >
          <Plus size={15} /> Registrar compra
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-4 space-y-3">
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
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Proveedor</label>
                  <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Nombre del proveedor"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Producto (modelo · talla)</label>
                <SelectorProducto productos={productos} value={productoId} onChange={setProductoId} />
                {producto && (
                  <p className="text-xs text-stone-400 mt-1">
                    Tipo: {producto.tipo} · Stock actual: {producto.stock} {producto.unidad}
                    {producto.costoUnitario != null && <> · Costo actual: {formatSoles(producto.costoUnitario)} (promedio)</>}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad comprada</label>
                  <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Costo unitario (S/)</label>
                  <input type="number" min="0" step="0.5" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>

              <div className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-sm text-stone-600">Total de la compra</span>
                <span className="text-lg font-semibold text-stone-900">{formatSoles(totalCalc)}</span>
              </div>

              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <XCircle size={14} /> {error}
                </p>
              )}

              <button type="button" onClick={handleSubmit} disabled={enviando}
                className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition">
                {enviando ? "Guardando..." : "Guardar compra"}
              </button>
            </>
          )}
        </div>
      )}

      {compras.length === 0 ? (
        <EmptyState icon={Truck} title="Todavía no hay compras registradas" body="Cada compra que registres aquí suma al stock disponible y actualiza el costo promedio del producto." />
      ) : (
        <div className="space-y-4">
          {porDia.map(([fecha, items]) => {
            const totalDia = round2(items.reduce((s, c) => s + c.total, 0));
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
                        <th className="text-left px-3 py-1.5 font-medium">Producto</th>
                        <th className="text-left px-3 py-1.5 font-medium">Proveedor</th>
                        <th className="text-right px-3 py-1.5 font-medium">Cant.</th>
                        <th className="text-right px-3 py-1.5 font-medium">Costo unit.</th>
                        <th className="text-right px-3 py-1.5 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c) => (
                        <tr key={c.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                          <td className="px-3 py-1.5 text-stone-800">
                            {c.producto}{c.talla !== "Única" ? ` - ${c.talla}` : ""}
                            <span className="text-stone-400 font-mono text-xs ml-1.5">{c.codigo}</span>
                          </td>
                          <td className="px-3 py-1.5 text-stone-600">{c.proveedor}</td>
                          <td className="px-3 py-1.5 text-right text-stone-700">{c.cantidad}</td>
                          <td className="px-3 py-1.5 text-right text-stone-700">{formatSoles(c.costoUnitario)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-stone-900">{formatSoles(c.total)}</td>
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

