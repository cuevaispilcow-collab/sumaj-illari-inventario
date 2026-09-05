import React, { useState } from "react";
import {
  Plus, XCircle, Trash2,
} from "lucide-react";
import { todayStr, round2, formatSoles, formatFecha } from "../utils/format.js";
import SelectorProducto from "../components/SelectorProducto.jsx";
import { operarInventarioSeguro } from "../firestoreSync.js";

export default function Produccion({ productos, movimientos, compras, producciones, onSave, showToast }) {
  const [tab, setTab] = useState("producir"); // "producir" | "recetas"

  const terminados = productos.filter((p) => p.tipo === "Terminado" || p.tipo === "En proceso");
  const materiasPrimas = productos.filter((p) => p.tipo === "Materia prima");
  const insumosDisponibles = productos.filter((p) => p.tipo === "Materia prima" || p.tipo === "En proceso");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-stone-200">
        <button
          onClick={() => setTab("producir")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === "producir" ? "border-red-600 text-red-600" : "border-transparent text-stone-500 hover:text-stone-700"}`}
        >
          Producir
        </button>
        <button
          onClick={() => setTab("recetas")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === "recetas" ? "border-red-600 text-red-600" : "border-transparent text-stone-500 hover:text-stone-700"}`}
        >
          Fichas técnicas
        </button>
      </div>

      {tab === "recetas" ? (
        <RecetasEditor productos={productos} terminados={terminados} insumosDisponibles={insumosDisponibles} movimientos={movimientos} onSave={onSave} showToast={showToast} />
      ) : (
        <ProducirForm productos={productos} movimientos={movimientos} producciones={producciones} terminados={terminados} onSave={onSave} showToast={showToast} />
      )}
    </div>
  );
}


function RecetasEditor({ productos, terminados, insumosDisponibles, movimientos, onSave, showToast }) {
  const [terminadoId, setTerminadoId] = useState("");
  const [materiaPrimaId, setMateriaPrimaId] = useState("");
  const [cantidadPorUnidad, setCantidadPorUnidad] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const terminado = productos.find((p) => p.id === terminadoId);
  const receta = terminado?.receta || [];
  // No se puede usar el mismo producto como insumo de sí mismo.
  const opcionesInsumo = insumosDisponibles.filter((p) => p.id !== terminadoId);

  function agregarIngrediente() {
    setError("");
    if (!materiaPrimaId) return setError("Selecciona un insumo (materia prima o en proceso).");
    const cant = Number(cantidadPorUnidad);
    if (!cantidadPorUnidad || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (receta.some((r) => r.materiaPrimaId === materiaPrimaId)) {
      return setError("Ese insumo ya está en la ficha técnica. Elimínalo primero si quieres cambiar la cantidad.");
    }
    const nuevaReceta = [...receta, { materiaPrimaId, cantidadPorUnidad: cant }];
    guardarReceta(nuevaReceta);
    setMateriaPrimaId("");
    setCantidadPorUnidad("");
  }

  function quitarIngrediente(materiaPrimaIdAQuitar) {
    const nuevaReceta = receta.filter((r) => r.materiaPrimaId !== materiaPrimaIdAQuitar);
    guardarReceta(nuevaReceta);
  }

  async function guardarReceta(nuevaReceta) {
    const newProductos = productos.map((p) => (p.id === terminadoId ? { ...p, receta: nuevaReceta } : p));
    try {
      setGuardando(true);
      await onSave(newProductos, movimientos);
      showToast("success", "Ficha técnica actualizada.");
    } catch (err) {
      setError("No se pudo guardar: " + (err && err.message ? err.message : String(err)));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Producto terminado</label>
        {terminados.length === 0 ? (
          <p className="text-sm text-stone-500">No hay productos de tipo "Terminado" o "En proceso" en el catálogo todavía.</p>
        ) : (
          <SelectorProducto productos={terminados} value={terminadoId} onChange={setTerminadoId} placeholder="Busca el producto terminado..." />
        )}
      </div>

      {terminado && (
        <>
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-stone-600 mb-2">
              Ficha técnica — para producir 1 unidad de {terminado.producto}{terminado.talla !== "Única" ? ` (${terminado.talla})` : ""} se necesita:
            </p>
            {receta.length === 0 ? (
              <p className="text-sm text-stone-400">Todavía no tiene ficha técnica. Agrega materia prima abajo.</p>
            ) : (
              <ul className="space-y-1.5">
                {receta.map((r) => {
                  const mp = productos.find((p) => p.id === r.materiaPrimaId);
                  return (
                    <li key={r.materiaPrimaId} className="flex items-center justify-between text-sm bg-white rounded px-3 py-1.5 border border-stone-200">
                      <span className="text-stone-700">
                        {mp ? `${mp.producto}${mp.talla !== "Única" ? ` (${mp.talla})` : ""}` : "(producto eliminado)"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-stone-500">{r.cantidadPorUnidad} {mp?.unidad || ""}</span>
                        <button onClick={() => quitarIngrediente(r.materiaPrimaId)} className="text-stone-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Agregar insumo (materia prima o en proceso)</label>
              {opcionesInsumo.length === 0 ? (
                <p className="text-xs text-stone-400">No hay productos de tipo "Materia prima" o "En proceso" disponibles.</p>
              ) : (
                <SelectorProducto productos={opcionesInsumo} value={materiaPrimaId} onChange={setMateriaPrimaId} placeholder="Busca el insumo..." />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad por unidad producida</label>
              <input type="number" min="0" step="0.01" value={cantidadPorUnidad} onChange={(e) => setCantidadPorUnidad(e.target.value)} placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <XCircle size={14} /> {error}
            </p>
          )}

          <button type="button" onClick={agregarIngrediente} disabled={guardando}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition inline-flex items-center gap-1.5">
            <Plus size={15} /> Agregar a la ficha técnica
          </button>
        </>
      )}
    </div>
  );
}


function ProducirForm({ productos, movimientos, producciones, terminados, onSave, showToast }) {
  const [fecha, setFecha] = useState(todayStr());
  const [terminadoId, setTerminadoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const terminado = productos.find((p) => p.id === terminadoId);
  const receta = terminado?.receta || [];
  const cant = Number(cantidad) || 0;

  const consumo = receta.map((r) => {
    const mp = productos.find((p) => p.id === r.materiaPrimaId);
    const necesario = round2(r.cantidadPorUnidad * cant);
    return {
      ...r,
      materiaPrima: mp,
      necesario,
      suficiente: mp ? mp.stock >= necesario : false,
      costoUnitarioMP: mp?.costoUnitario ?? null,
    };
  });

  const hayInsuficiente = consumo.some((c) => !c.suficiente);
  const costoTotalCalc = round2(consumo.reduce((s, c) => s + (c.costoUnitarioMP || 0) * c.necesario, 0));
  const costoUnitarioResultante = cant > 0 ? round2(costoTotalCalc / cant) : 0;
  const faltaCostoDeAlgunInsumo = consumo.some((c) => c.costoUnitarioMP == null) && consumo.length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;
    if (!terminadoId) return setError("Selecciona un producto terminado.");
    if (receta.length === 0) return setError("Este producto no tiene una ficha técnica definida. Ve a la pestaña 'Fichas técnicas' primero.");
    if (!cantidad || cant <= 0) return setError("Ingresa una cantidad a producir válida, mayor a cero.");
    if (hayInsuficiente) return setError("No hay suficiente stock de uno o más insumos para esta producción.");

    setEnviando(true);
    setError("");
    try {
      let costoFinal = costoUnitarioResultante;
      // Se vuelve a calcular todo (consumo, costos, suficiencia de stock)
      // adentro de la transacción, con los datos reales del servidor en
      // ese instante — así, si alguien más acaba de vender o producir
      // algo de estos mismos insumos, esta producción no se guarda con
      // números desactualizados ni deja el stock en negativo.
      await operarInventarioSeguro(["productos", "movimientos", "producciones"], (actuales) => {
        const terminadoReal = actuales.productos.find((p) => p.id === terminadoId);
        if (!terminadoReal) throw new Error("Ese producto ya no existe en el catálogo. Actualiza la página e inténtalo de nuevo.");
        const recetaReal = terminadoReal.receta || [];
        if (recetaReal.length === 0) throw new Error("Este producto ya no tiene una ficha técnica definida.");

        const consumoReal = recetaReal.map((r) => {
          const mp = actuales.productos.find((p) => p.id === r.materiaPrimaId);
          const necesario = round2(r.cantidadPorUnidad * cant);
          return { ...r, materiaPrima: mp, necesario, costoUnitarioMP: mp?.costoUnitario ?? null };
        });

        const faltante = consumoReal.find((c) => !c.materiaPrima || c.materiaPrima.stock < c.necesario);
        if (faltante) {
          const nombre = faltante.materiaPrima ? faltante.materiaPrima.producto : "un insumo de la ficha técnica";
          const disponible = faltante.materiaPrima ? faltante.materiaPrima.stock : 0;
          throw new Error(`Stock insuficiente de ${nombre}. Ahora mismo solo hay ${disponible} (puede que alguien más lo haya usado).`);
        }

        const costoTotalReal = round2(consumoReal.reduce((s, c) => s + (c.costoUnitarioMP || 0) * c.necesario, 0));
        const costoUnitarioReal = cant > 0 ? round2(costoTotalReal / cant) : 0;
        const stockAnterior = terminadoReal.stock;
        const costoAnterior = terminadoReal.costoUnitario;
        const nuevoCosto = costoAnterior != null && stockAnterior > 0
          ? round2((stockAnterior * costoAnterior + cant * costoUnitarioReal) / (stockAnterior + cant))
          : costoUnitarioReal;
        costoFinal = nuevoCosto;

        const nuevosProductos = actuales.productos.map((p) => {
          if (p.id === terminadoId) return { ...p, stock: p.stock + cant, costoUnitario: nuevoCosto };
          const consumido = consumoReal.find((c) => c.materiaPrimaId === p.id);
          if (consumido) return { ...p, stock: round2(p.stock - consumido.necesario) };
          return p;
        });

        const nuevosMovimientos = [
          ...actuales.movimientos,
          ...consumoReal.map((c) => ({
            id: `M${Date.now()}-${c.materiaPrimaId}`, fecha, tipo: "SALIDA", productoId: c.materiaPrimaId,
            productoNombre: `${c.materiaPrima.producto}${c.materiaPrima.talla !== "Única" ? " - " + c.materiaPrima.talla : ""}`,
            cantidad: c.necesario, motivo: `Consumo para producción de ${terminadoReal.producto}`,
          })),
          {
            id: `M${Date.now()}-prod`, fecha, tipo: "ENTRADA", productoId: terminadoId,
            productoNombre: `${terminadoReal.producto}${terminadoReal.talla !== "Única" ? " - " + terminadoReal.talla : ""}`,
            cantidad: cant, motivo: "Producción",
          },
        ];

        const produccion = {
          id: `P${Date.now()}`, fecha, productoId: terminadoId, codigo: terminadoReal.codigo,
          producto: terminadoReal.producto, talla: terminadoReal.talla, cantidad: cant,
          costoUnitario: costoUnitarioReal, total: costoTotalReal,
          insumos: consumoReal.map((c) => ({ materiaPrimaId: c.materiaPrimaId, cantidad: c.necesario, costoUnitario: c.costoUnitarioMP })),
        };

        return {
          productos: nuevosProductos,
          movimientos: nuevosMovimientos,
          producciones: [...actuales.producciones, produccion],
        };
      });

      showToast("success", `Producción registrada. Costo actualizado a ${formatSoles(costoFinal)}.`);
      setTerminadoId(""); setCantidad(""); setError("");
    } catch (err) {
      setError(err && err.message ? err.message : "No se pudo guardar la producción. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-4 space-y-3">
        {terminados.length === 0 ? (
          <p className="text-sm text-stone-500">No hay productos de tipo "Terminado" o "En proceso" en el catálogo todavía.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad a producir</label>
                <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Producto a producir</label>
              <SelectorProducto productos={terminados} value={terminadoId} onChange={setTerminadoId} placeholder="Busca el producto terminado..." />
            </div>

            {terminado && receta.length === 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Este producto no tiene una ficha técnica definida todavía. Ve a la pestaña "Fichas técnicas" para configurar qué materia prima usa.
              </p>
            )}

            {terminado && receta.length > 0 && cant > 0 && (
              <div className="bg-stone-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-stone-600">Materia prima que se va a consumir:</p>
                {consumo.map((c) => (
                  <div key={c.materiaPrimaId} className="flex items-center justify-between text-sm">
                    <span className="text-stone-700">{c.materiaPrima?.producto || "(producto eliminado)"}</span>
                    <span className={c.suficiente ? "text-stone-600" : "text-red-600 font-semibold"}>
                      {c.necesario} {c.materiaPrima?.unidad} {!c.suficiente && `(solo hay ${c.materiaPrima?.stock})`}
                    </span>
                  </div>
                ))}
                <div className="border-t border-stone-200 pt-2 flex items-center justify-between text-sm font-semibold">
                  <span className="text-stone-700">Costo total estimado</span>
                  <span className="text-stone-900">{formatSoles(costoTotalCalc)} ({formatSoles(costoUnitarioResultante)}/unidad)</span>
                </div>
                {faltaCostoDeAlgunInsumo && (
                  <p className="text-xs text-amber-700">
                    Uno o más insumos no tienen costo registrado todavía (ve a "Compras"), así que este costo está incompleto.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <XCircle size={14} /> {error}
              </p>
            )}

            <button type="button" onClick={handleSubmit} disabled={enviando || hayInsuficiente}
              className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition">
              {enviando ? "Guardando..." : "Registrar producción"}
            </button>
          </>
        )}
      </div>

      {producciones.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <h2 className="text-sm font-semibold text-stone-700 p-4 pb-0 mb-3">Historial de producción</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-stone-500 border-b border-stone-100">
                <th className="text-left px-4 py-1.5 font-medium">Fecha</th>
                <th className="text-left px-4 py-1.5 font-medium">Producto</th>
                <th className="text-right px-4 py-1.5 font-medium">Cantidad</th>
                <th className="text-right px-4 py-1.5 font-medium">Costo unit.</th>
                <th className="text-right px-4 py-1.5 font-medium">Costo total</th>
              </tr>
            </thead>
            <tbody>
              {[...producciones].reverse().map((p) => (
                <tr key={p.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                  <td className="px-4 py-1.5 text-stone-500">{formatFecha(p.fecha)}</td>
                  <td className="px-4 py-1.5 text-stone-800">{p.producto}{p.talla !== "Única" ? ` - ${p.talla}` : ""}</td>
                  <td className="px-4 py-1.5 text-right text-stone-700">{p.cantidad}</td>
                  <td className="px-4 py-1.5 text-right text-stone-700">{formatSoles(p.costoUnitario)}</td>
                  <td className="px-4 py-1.5 text-right font-semibold text-stone-900">{formatSoles(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

