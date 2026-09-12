import React, { useState, useMemo } from "react";
import {
  ArrowLeftRight, Plus, XCircle,
} from "lucide-react";
import { todayStr, round2, formatFecha } from "../utils/format.js";
import { UBICACIONES } from "../utils/constants.js";
import EmptyState from "../components/EmptyState.jsx";
import SelectorProducto from "../components/SelectorProducto.jsx";
import { operarInventarioSeguro, registrarAuditoria } from "../firestoreSync.js";

const NOMBRE_UBICACION = Object.fromEntries(UBICACIONES.map((u) => [u.id, u.nombre]));

// Lista corta a propósito (una lista larga hace que la gente elija lo
// primero que ve). "otro" siempre existe como salida de escape — sin
// ella, la gente terminaría escribiendo cualquier cosa en el motivo
// que sí existe. El "codigo" es lo que se guarda para poder analizar
// después (ej. cuánto se pierde por merma) sin depender de que el
// texto visible se escriba siempre igual — el mismo principio que ya
// usamos con los ids de ubicación: el texto puede cambiar, el código no.
const MOTIVOS_ENTRADA = [
  { codigo: "ajuste_inventario", texto: "Ajuste por inventario físico" },
  { codigo: "devolucion_cliente", texto: "Devolución de cliente" },
  { codigo: "otro", texto: "Otro" },
];
const MOTIVOS_SALIDA = [
  { codigo: "ajuste_inventario", texto: "Ajuste por inventario físico" },
  { codigo: "merma", texto: "Merma o producto dañado" },
  { codigo: "otro", texto: "Otro" },
];

export default function Movimientos({ productos, movimientos, onSave, onSaveInventarios, showToast, nombre, rol, ubicacion, esConsolidado, nombreVista }) {
  const [tipo, setTipo] = useState("ENTRADA");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(todayStr());
  const [motivoCodigo, setMotivoCodigo] = useState("");
  const [motivoOtro, setMotivoOtro] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const producto = productos.find((p) => p.id === productoId);
  const motivosDisponibles = tipo === "ENTRADA" ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA;

  // La lista de motivos depende del tipo (Entrada/Salida) — si se
  // cambia de uno a otro, la selección anterior ya no tiene sentido
  // (ej. "Devolución de cliente" no aplica a una Salida), así que se
  // limpia para forzar a elegir de nuevo, en vez de dejar seleccionado
  // algo que no corresponde.
  function cambiarTipo(nuevoTipo) {
    setTipo(nuevoTipo);
    setMotivoCodigo("");
    setMotivoOtro("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (guardando) return;
    if (!productoId) return setError("Selecciona un producto.");
    if (!producto) return setError("Ese producto ya no existe en el catálogo. Actualiza la página e inténtalo de nuevo.");
    const cant = Number(cantidad);
    if (!cantidad || isNaN(cant) || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (tipo === "SALIDA" && producto && producto.stock < cant) {
      return setError(`Stock insuficiente. Solo hay ${producto.stock} ${producto.unidad}.`);
    }
    if (!motivoCodigo) return setError("Selecciona un motivo.");
    if (motivoCodigo === "otro" && !motivoOtro.trim()) return setError("Escribe el motivo.");
    const motivoTexto = motivoCodigo === "otro" ? motivoOtro.trim() : (motivosDisponibles.find((m) => m.codigo === motivoCodigo)?.texto || "");

    const claveInventario = `${productoId}__${ubicacion}`;

    setGuardando(true);
    setError("");
    try {
      await operarInventarioSeguro(["inventarios", "movimientos"], (actuales) => {
        const invActual = actuales.inventarios.find((i) => i.id === claveInventario);
        const stockActual = invActual ? invActual.stock : (producto?.stock || 0);
        const delta = tipo === "ENTRADA" ? cant : -cant;
        if (tipo === "SALIDA" && stockActual < cant) {
          throw new Error(`Stock insuficiente. Ahora mismo solo hay ${stockActual} ${producto?.unidad || ""} (puede que alguien más lo haya movido).`);
        }

        const nuevoInv = {
          id: claveInventario, varianteId: productoId, ubicacion,
          stock: round2(stockActual + delta),
          stockMinimo: invActual ? invActual.stockMinimo : (producto?.stockMinimo ?? null),
          fechaIncorporacion: invActual ? invActual.fechaIncorporacion : (producto?.fechaIncorporacion || todayStr()),
        };
        const nuevosInventarios = invActual
          ? actuales.inventarios.map((i) => (i.id === claveInventario ? nuevoInv : i))
          : [...actuales.inventarios, nuevoInv];

        const mov = {
          id: `M${Date.now()}`, fecha, tipo, productoId, ubicacion,
          productoNombre: `${producto.producto}${producto.talla !== "Única" ? " - " + producto.talla : ""}`,
          cantidad: cant, motivo: motivoTexto, motivoCodigo,
        };

        return { inventarios: nuevosInventarios, movimientos: [...actuales.movimientos, mov] };
      });

      showToast("success", `${tipo === "ENTRADA" ? "Entrada" : "Salida"} registrada. Stock actualizado.`);
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "MOVIMIENTO", ubicacion,
        detalle: `${tipo === "ENTRADA" ? "Entrada" : "Salida"} de ${cant} ${producto?.producto || ""}${producto?.talla && producto.talla !== "Única" ? " - " + producto.talla : ""}${motivoTexto ? " — " + motivoTexto : ""}`,
      }).catch(() => {});
      setCantidad(""); setMotivoCodigo(""); setMotivoOtro(""); setError("");
    } catch (err) {
      setError(err && err.message ? err.message : "No se pudo registrar el movimiento. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const historial = useMemo(
    () => [...(movimientos || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (a.id < b.id ? 1 : -1))),
    [movimientos]
  );

  if (productos.length === 0) {
    return <EmptyState icon={ArrowLeftRight} title="No hay productos todavía" body="Registra al menos un producto antes de poder anotar entradas o salidas." />;
  }

  return (
    <div className="space-y-6">
    <div className="max-w-lg">
      {esConsolidado ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Estás viendo {nombreVista}. Elige una sede específica arriba (en el menú) para poder registrar un movimiento — en modo consolidado no hay a dónde atribuirlo.
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de movimiento</label>
          <div className="grid grid-cols-2 gap-2">
            {["ENTRADA", "SALIDA"].map((t) => (
              <button type="button" key={t} onClick={() => cambiarTipo(t)}
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
          <label className="block text-xs font-medium text-stone-600 mb-1">Motivo</label>
          <div className="grid grid-cols-3 gap-2">
            {motivosDisponibles.map((m) => (
              <button type="button" key={m.codigo} onClick={() => setMotivoCodigo(m.codigo)}
                className={`py-2 px-1 rounded text-xs font-medium border transition ${
                  motivoCodigo === m.codigo ? "bg-red-600 text-white border-red-600" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
                }`}>
                {m.texto}
              </button>
            ))}
          </div>
          {motivoCodigo === "otro" && (
            <input autoFocus value={motivoOtro} onChange={(e) => setMotivoOtro(e.target.value)} placeholder="Escribe el motivo"
              className="w-full mt-2 px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
          )}
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
      )}
    </div>

    <div>
      <h3 className="text-sm font-semibold text-stone-600 mb-2">Historial</h3>
      {historial.length === 0 ? (
        <p className="text-sm text-stone-400 py-6 text-center">Todavía no hay entradas ni salidas registradas.</p>
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  {esConsolidado && <th className="text-left px-4 py-2 font-medium text-stone-600">Sede</th>}
                  <th className="text-left px-4 py-2 font-medium text-stone-600">Fecha</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600">Tipo</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600">Producto</th>
                  <th className="text-right px-4 py-2 font-medium text-stone-600">Cant.</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((m) => (
                  <tr key={m.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                    {esConsolidado && <td className="px-4 py-2 text-stone-500">{NOMBRE_UBICACION[m.ubicacion] || NOMBRE_UBICACION.sumaj_illari}</td>}
                    <td className="px-4 py-2 text-stone-600 whitespace-nowrap">{formatFecha(m.fecha)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.tipo === "ENTRADA" ? "bg-teal-100 text-teal-700" : "bg-stone-100 text-stone-600"}`}>
                        {m.tipo === "ENTRADA" ? "Entrada" : m.tipo === "SALIDA" ? "Salida" : m.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-stone-800">{m.productoNombre}</td>
                    <td className="px-4 py-2 text-right text-stone-700">{m.cantidad}</td>
                    <td className="px-4 py-2 text-stone-500">{m.motivo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

