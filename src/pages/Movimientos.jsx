import React, { useState } from "react";
import {
  ArrowLeftRight, Plus, XCircle,
} from "lucide-react";
import { todayStr } from "../utils/format.js";
import EmptyState from "../components/EmptyState.jsx";
import SelectorProducto from "../components/SelectorProducto.jsx";
import { operarInventarioSeguro } from "../firestoreSync.js";

export default function Movimientos({ productos, movimientos, onSave, showToast }) {
  const [tipo, setTipo] = useState("ENTRADA");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(todayStr());
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const producto = productos.find((p) => p.id === productoId);

  async function handleSubmit(e) {
    e.preventDefault();
    if (guardando) return;
    if (!productoId) return setError("Selecciona un producto.");
    const cant = Number(cantidad);
    if (!cantidad || isNaN(cant) || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (tipo === "SALIDA" && producto && producto.stock < cant) {
      return setError(`Stock insuficiente. Solo hay ${producto.stock} ${producto.unidad}.`);
    }

    setGuardando(true);
    setError("");
    try {
      await operarInventarioSeguro(["productos", "movimientos"], (actuales) => {
        const variante = actuales.productos.find((p) => p.id === productoId);
        if (!variante) throw new Error("Ese producto ya no existe en el catálogo. Actualiza la página e inténtalo de nuevo.");
        const prodReal = { ...(actuales.modelos.find((m) => m.codigo === variante.codigo) || {}), ...variante };
        const delta = tipo === "ENTRADA" ? cant : -cant;
        if (tipo === "SALIDA" && prodReal.stock < cant) {
          throw new Error(`Stock insuficiente. Ahora mismo solo hay ${prodReal.stock} ${prodReal.unidad} (puede que alguien más lo haya movido).`);
        }

        const nuevosProductos = actuales.productos.map((p) =>
          p.id === productoId ? { ...p, stock: p.stock + delta } : p
        );
        const mov = {
          id: `M${Date.now()}`, fecha, tipo, productoId,
          productoNombre: `${prodReal.producto}${prodReal.talla !== "Única" ? " - " + prodReal.talla : ""}`,
          cantidad: cant, motivo,
        };

        return { productos: nuevosProductos, movimientos: [...actuales.movimientos, mov] };
      }, ["modelos"]);

      showToast("success", `${tipo === "ENTRADA" ? "Entrada" : "Salida"} registrada. Stock actualizado.`);
      setCantidad(""); setMotivo(""); setError("");
    } catch (err) {
      setError(err && err.message ? err.message : "No se pudo registrar el movimiento. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (productos.length === 0) {
    return <EmptyState icon={ArrowLeftRight} title="No hay productos todavía" body="Registra al menos un producto antes de poder anotar entradas o salidas." />;
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de movimiento</label>
          <div className="grid grid-cols-2 gap-2">
            {["ENTRADA", "SALIDA"].map((t) => (
              <button type="button" key={t} onClick={() => setTipo(t)}
                className={`py-2 rounded text-sm font-medium border transition ${
                  tipo === t ? "bg-red-600 text-white border-red-600" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
                }`}>
                {t === "ENTRADA" ? "Entrada" : "Salida"}
              </button>
            ))}
          </div>
        </div>

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
            <label className="block text-xs font-medium text-stone-600 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Motivo (opcional)</label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: ajuste por conteo, transferencia, producto dañado"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>

        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <XCircle size={14} /> {error}
          </p>
        )}

        <button type="button" onClick={handleSubmit} disabled={guardando}
          className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition flex items-center justify-center gap-2">
          <Plus size={16} /> {guardando ? "Guardando..." : "Registrar movimiento"}
        </button>
      </form>
    </div>
  );
}

