import React, { useState, useMemo } from "react";
import {
  Plus, XCircle, Trash2, ClipboardList, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { todayStr, round2, formatSoles, formatFecha } from "../utils/format.js";
import SelectorProducto from "../components/SelectorProducto.jsx";
import { operarInventarioSeguro } from "../firestoreSync.js";

export default function Produccion({ productos, movimientos, ventas, compras, producciones, pedidos, onSave, showToast, rol }) {
  const [tab, setTab] = useState("producir"); // "producir" | "recetas" | "pedidos"

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
        <button
          onClick={() => setTab("pedidos")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition inline-flex items-center gap-1.5 ${tab === "pedidos" ? "border-red-600 text-red-600" : "border-transparent text-stone-500 hover:text-stone-700"}`}
        >
          <ClipboardList size={15} /> Pedidos
        </button>
      </div>

      {tab === "recetas" ? (
        <RecetasEditor productos={productos} terminados={terminados} insumosDisponibles={insumosDisponibles} movimientos={movimientos} onSave={onSave} showToast={showToast} />
      ) : tab === "pedidos" ? (
        <PedidosPanel productos={productos} movimientos={movimientos} ventas={ventas} producciones={producciones} pedidos={pedidos || []} terminados={terminados} onSave={onSave} showToast={showToast} rol={rol} />
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


const ETAPAS = ["Tomado", "Corte", "Costura", "Acabado", "Completado"];

function PedidosPanel({ productos, movimientos, ventas, producciones, pedidos, terminados, onSave, showToast, rol }) {
  const [showForm, setShowForm] = useState(false);
  const [cliente, setCliente] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precioCotizado, setPrecioCotizado] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [completandoId, setCompletandoId] = useState(null);

  const producto = terminados.find((p) => p.id === productoId);
  const cant = Number(cantidad) || 0;
  const precio = Number(precioCotizado) || 0;

  function reset() {
    setCliente(""); setProductoId(""); setCantidad(""); setPrecioCotizado(""); setFechaEntrega(""); setError("");
  }

  // Tomar un pedido NO mueve stock todavía — es solo seguimiento (cliente,
  // precio cotizado, fecha de entrega). El stock y el costo real recién se
  // mueven cuando el pedido se marca como "Completado" (ver más abajo).
  async function handleCrear(e) {
    e.preventDefault();
    if (enviando) return;
    if (!cliente.trim()) return setError("Ingresa el nombre del cliente.");
    if (!productoId) return setError("Selecciona qué producto se va a fabricar.");
    if (!cantidad || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (!precioCotizado || precio < 0) return setError("Ingresa el precio cotizado (total del pedido).");
    if (!fechaEntrega) return setError("Ingresa la fecha de entrega comprometida.");
    if (!producto.receta || producto.receta.length === 0) {
      return setError("Este producto no tiene una Ficha técnica definida todavía. Ve a la pestaña 'Fichas técnicas' primero.");
    }

    setEnviando(true);
    setError("");
    try {
      const nuevoPedido = {
        id: `PED${Date.now()}`, fecha: todayStr(), cliente: cliente.trim(),
        productoId, codigo: producto.codigo, producto: producto.producto, talla: producto.talla,
        cantidad: cant, precioCotizado: precio, fechaEntrega, etapa: "Tomado",
      };
      await onSave(productos, movimientos, ventas, undefined, producciones, [...pedidos, nuevoPedido]);
      showToast("success", `Pedido de ${cliente.trim()} registrado.`);
      reset();
      setShowForm(false);
    } catch (err) {
      setError("No se pudo registrar el pedido: " + (err && err.message ? err.message : String(err)));
    } finally {
      setEnviando(false);
    }
  }

  async function avanzarEtapa(pedido, nuevaEtapa) {
    if (nuevaEtapa === "Completado") {
      return completarPedido(pedido);
    }
    const nuevosPedidos = pedidos.map((p) => (p.id === pedido.id ? { ...p, etapa: nuevaEtapa } : p));
    await onSave(productos, movimientos, ventas, undefined, producciones, nuevosPedidos);
    showToast("success", `Pedido de ${pedido.cliente} ahora en etapa "${nuevaEtapa}".`);
  }

  // Al completar un pedido pasan DOS cosas de negocio a la vez: se
  // fabrica (consume insumos según la Ficha técnica, como en Producir) y
  // se entrega al cliente (eso es una venta: descuenta el stock recién
  // producido y registra el ingreso). Todo en una sola transacción, para
  // que no quede "a medias" si algo falla a mitad de camino.
  async function completarPedido(pedido) {
    setCompletandoId(pedido.id);
    try {
      let margenFinal = 0;
      await operarInventarioSeguro(["productos", "movimientos", "producciones", "ventas", "pedidos"], (actuales) => {
        const terminadoReal = actuales.productos.find((p) => p.id === pedido.productoId);
        if (!terminadoReal) throw new Error("Ese producto ya no existe en el catálogo.");
        const receta = terminadoReal.receta || [];
        if (receta.length === 0) throw new Error("Este producto ya no tiene una Ficha técnica definida.");

        const consumo = receta.map((r) => {
          const mp = actuales.productos.find((p) => p.id === r.materiaPrimaId);
          const necesario = round2(r.cantidadPorUnidad * pedido.cantidad);
          return { materiaPrimaId: r.materiaPrimaId, materiaPrima: mp, necesario, costoUnitarioMP: mp?.costoUnitario ?? null };
        });
        const faltante = consumo.find((c) => !c.materiaPrima || c.materiaPrima.stock < c.necesario);
        if (faltante) {
          const nombre = faltante.materiaPrima ? faltante.materiaPrima.producto : "un insumo de la ficha técnica";
          const disponible = faltante.materiaPrima ? faltante.materiaPrima.stock : 0;
          throw new Error(`Stock insuficiente de ${nombre}. Ahora mismo solo hay ${disponible}.`);
        }

        const costoTotalReal = round2(consumo.reduce((s, c) => s + (c.costoUnitarioMP || 0) * c.necesario, 0));
        const costoUnitarioReal = pedido.cantidad > 0 ? round2(costoTotalReal / pedido.cantidad) : 0;
        const stockAnterior = terminadoReal.stock;
        const costoAnterior = terminadoReal.costoUnitario;
        const nuevoCostoPromedio = costoAnterior != null && stockAnterior > 0
          ? round2((stockAnterior * costoAnterior + pedido.cantidad * costoUnitarioReal) / (stockAnterior + pedido.cantidad))
          : costoUnitarioReal;

        // Stock: se descuentan los insumos; el producto terminado sube y
        // baja en el mismo movimiento porque se fabrica y se entrega en el
        // acto — el stock general de terminado no cambia, pero sí su costo
        // promedio (por eso se recalcula) y sí queda registro de ambos pasos.
        const nuevosProductos = actuales.productos.map((p) => {
          if (p.id === pedido.productoId) return { ...p, costoUnitario: nuevoCostoPromedio };
          const consumido = consumo.find((c) => c.materiaPrimaId === p.id);
          if (consumido) return { ...p, stock: round2(p.stock - consumido.necesario) };
          return p;
        });

        const nuevosMovimientos = [
          ...actuales.movimientos,
          ...consumo.map((c) => ({
            id: `M${Date.now()}-${c.materiaPrimaId}`, fecha: todayStr(), tipo: "SALIDA", productoId: c.materiaPrimaId,
            productoNombre: `${c.materiaPrima.producto}${c.materiaPrima.talla !== "Única" ? " - " + c.materiaPrima.talla : ""}`,
            cantidad: c.necesario, motivo: `Consumo para pedido de ${pedido.cliente}`,
          })),
          {
            id: `M${Date.now()}-prod`, fecha: todayStr(), tipo: "ENTRADA", productoId: pedido.productoId,
            productoNombre: `${terminadoReal.producto}${terminadoReal.talla !== "Única" ? " - " + terminadoReal.talla : ""}`,
            cantidad: pedido.cantidad, motivo: `Producción para pedido de ${pedido.cliente}`,
          },
          {
            id: `M${Date.now()}-venta`, fecha: todayStr(), tipo: "VENTA", productoId: pedido.productoId,
            productoNombre: `${terminadoReal.producto}${terminadoReal.talla !== "Única" ? " - " + terminadoReal.talla : ""}`,
            cantidad: pedido.cantidad, motivo: `Entrega de pedido a ${pedido.cliente}`,
          },
        ];

        const produccion = {
          id: `P${Date.now()}`, fecha: todayStr(), productoId: pedido.productoId, codigo: terminadoReal.codigo,
          producto: terminadoReal.producto, talla: terminadoReal.talla, cantidad: pedido.cantidad,
          costoUnitario: costoUnitarioReal, total: costoTotalReal,
          insumos: consumo.map((c) => ({ materiaPrimaId: c.materiaPrimaId, cantidad: c.necesario, costoUnitario: c.costoUnitarioMP })),
        };

        const precioUnitario = pedido.cantidad > 0 ? round2(pedido.precioCotizado / pedido.cantidad) : 0;
        const venta = {
          id: `V${Date.now()}`, fecha: todayStr(), idProducto: terminadoReal.codigo, producto: terminadoReal.producto,
          cantidad: pedido.cantidad, talla: terminadoReal.talla, descripcion: `Pedido - ${pedido.cliente}`,
          precio: precioUnitario, efectivo: 0, yape: 0, tarjeta: 0, total: pedido.precioCotizado,
          costoUnitario: costoUnitarioReal, pedidoId: pedido.id,
        };

        margenFinal = round2(pedido.precioCotizado - costoTotalReal);
        const nuevosPedidos = actuales.pedidos.map((p) =>
          p.id === pedido.id
            ? { ...p, etapa: "Completado", completadoEn: todayStr(), costoProduccion: costoTotalReal, margen: margenFinal }
            : p
        );

        return {
          productos: nuevosProductos,
          movimientos: nuevosMovimientos,
          producciones: [...actuales.producciones, produccion],
          ventas: [...actuales.ventas, venta],
          pedidos: nuevosPedidos,
        };
      });

      showToast("success", `Pedido de ${pedido.cliente} completado y entregado. Margen: ${formatSoles(margenFinal)}.`);
    } catch (err) {
      showToast("error", "No se pudo completar el pedido: " + (err && err.message ? err.message : String(err)));
    } finally {
      setCompletandoId(null);
    }
  }

  const pendientes = useMemo(
    () => pedidos.filter((p) => p.etapa !== "Completado").sort((a, b) => (a.fechaEntrega < b.fechaEntrega ? -1 : 1)),
    [pedidos]
  );
  const completados = useMemo(
    () => pedidos.filter((p) => p.etapa === "Completado").sort((a, b) => (a.completadoEn < b.completadoEn ? 1 : -1)),
    [pedidos]
  );

  function diasParaEntrega(fechaEntrega) {
    const dias = Math.ceil((new Date(fechaEntrega + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);
    return dias;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700">Pedidos de clientes</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-1.5"
        >
          <Plus size={15} /> Tomar pedido
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-4 space-y-3">
          {terminados.length === 0 ? (
            <p className="text-sm text-stone-500">No hay productos Terminado/En proceso en el catálogo todavía.</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Cliente</label>
                <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre de la empresa o persona"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Producto a fabricar</label>
                <SelectorProducto productos={terminados} value={productoId} onChange={setProductoId} />
                {producto && (!producto.receta || producto.receta.length === 0) && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Este producto no tiene Ficha técnica todavía — defínela primero en esa pestaña.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad</label>
                  <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Precio cotizado (S/, total)</label>
                  <input type="number" min="0" step="0.5" value={precioCotizado} onChange={(e) => setPrecioCotizado(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Fecha de entrega</label>
                  <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <XCircle size={14} /> {error}
                </p>
              )}

              <button type="button" onClick={handleCrear} disabled={enviando}
                className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition">
                {enviando ? "Guardando..." : "Registrar pedido"}
              </button>
              <p className="text-xs text-stone-400">Tomar el pedido todavía no descuenta materia prima — eso pasa recién cuando lo marques como "Completado".</p>
            </>
          )}
        </div>
      )}

      {pendientes.length === 0 ? (
        <p className="text-sm text-stone-400 py-6 text-center">No hay pedidos pendientes.</p>
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-4 py-2 border-b border-stone-200">
            <span className="text-sm font-semibold text-stone-700">Pendientes ({pendientes.length}) — ordenados por fecha de entrega más próxima</span>
          </div>
          <div className="divide-y divide-stone-100">
            {pendientes.map((p) => {
              const dias = diasParaEntrega(p.fechaEntrega);
              const urgente = dias <= 3;
              const vencido = dias < 0;
              return (
                <div key={p.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800">{p.cliente}</p>
                    <p className="text-xs text-stone-500">
                      {p.producto}{p.talla !== "Única" ? ` - ${p.talla}` : ""} · {p.cantidad} unid. · Entrega: {formatFecha(p.fechaEntrega)}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                    vencido ? "bg-red-100 text-red-700" : urgente ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"
                  }`}>
                    {vencido ? `Vencido hace ${Math.abs(dias)}d` : dias === 0 ? "Entrega hoy" : `Faltan ${dias}d`}
                  </span>
                  <select
                    value={p.etapa}
                    onChange={(e) => avanzarEtapa(p, e.target.value)}
                    disabled={completandoId === p.id}
                    className="px-2 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {ETAPAS.map((et) => (
                      <option key={et} value={et}>{et}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {completados.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-4 py-2 border-b border-stone-200">
            <span className="text-sm font-semibold text-stone-700">Completados</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-stone-500 border-b border-stone-100">
                  <th className="text-left px-4 py-1.5 font-medium">Cliente</th>
                  <th className="text-left px-4 py-1.5 font-medium">Producto</th>
                  <th className="text-right px-4 py-1.5 font-medium">Cant.</th>
                  <th className="text-right px-4 py-1.5 font-medium">Precio cotizado</th>
                  {rol === "gerente" && <th className="text-right px-4 py-1.5 font-medium">Margen</th>}
                </tr>
              </thead>
              <tbody>
                {completados.map((p) => (
                  <tr key={p.id} className="border-b border-stone-50 last:border-0">
                    <td className="px-4 py-1.5 text-stone-800 inline-flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-green-600" /> {p.cliente}
                    </td>
                    <td className="px-4 py-1.5 text-stone-600">{p.producto}{p.talla !== "Única" ? ` - ${p.talla}` : ""}</td>
                    <td className="px-4 py-1.5 text-right text-stone-700">{p.cantidad}</td>
                    <td className="px-4 py-1.5 text-right font-semibold text-stone-900">{formatSoles(p.precioCotizado)}</td>
                    {rol === "gerente" && (
                      <td className={`px-4 py-1.5 text-right font-semibold ${p.margen >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {formatSoles(p.margen)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
