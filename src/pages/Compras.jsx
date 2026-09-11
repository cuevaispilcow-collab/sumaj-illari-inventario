import React, { useState, useMemo } from "react";
import {
  Plus, XCircle, Truck, BarChart3, AlertTriangle, PieChart,
} from "lucide-react";
import { todayStr, round2, formatSoles, formatFecha, calcularPareto } from "../utils/format.js";
import { UBICACIONES } from "../utils/constants.js";
import EmptyState from "../components/EmptyState.jsx";
import SelectorProducto from "../components/SelectorProducto.jsx";
import { operarInventarioSeguro, registrarAuditoria } from "../firestoreSync.js";

const NOMBRE_UBICACION = Object.fromEntries(UBICACIONES.map((u) => [u.id, u.nombre]));

export default function Compras({ productos, movimientos, compras, onSave, onSaveInventarios, showToast, nombre, rol, ubicacion, esConsolidado }) {
  const [tab, setTab] = useState("registro"); // "registro" | "pareto"
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(todayStr());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [precioMinimo, setPrecioMinimo] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const producto = productos.find((p) => p.id === productoId);
  const cant = Number(cantidad) || 0;
  const costo = Number(costoUnitario) || 0;
  const totalCalc = round2(cant * costo);

  function reset() {
    setProductoId(""); setCantidad(""); setCostoUnitario(""); setPrecioMinimo(""); setProveedor(""); setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;
    if (!productoId) return setError("Selecciona un producto.");
    if (!producto) return setError("Ese producto ya no existe en el catálogo. Actualiza la página e inténtalo de nuevo.");
    if (!cantidad || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (costoUnitario === "" || costo < 0) return setError("Ingresa un costo unitario válido.");
    if (!proveedor.trim()) return setError("Ingresa el nombre del proveedor.");
    const pMin = precioMinimo.trim() === "" ? null : Number(precioMinimo);
    if (precioMinimo.trim() !== "" && (isNaN(pMin) || pMin < 0)) {
      return setError("El precio mínimo de venta debe ser un número válido.");
    }

    const claveInventario = `${productoId}__${ubicacion}`;

    setEnviando(true);
    setError("");
    try {
      let costoFinal = costo;
      // El costo promedio ponderado depende del stock y costo que haya
      // JUSTO antes de guardar, EN ESTA UBICACIÓN — cada ubicación lleva
      // su propio costo. Si dos compras del mismo producto se registran
      // casi al mismo tiempo, calcular esto con datos viejos dejaría el
      // costo promedio mal calculado — por eso se recalcula adentro de
      // la transacción, con el dato real del servidor.
      const colecciones = pMin != null ? ["inventarios", "costos", "compras", "movimientos", "productos"] : ["inventarios", "costos", "compras", "movimientos"];
      await operarInventarioSeguro(colecciones, (actuales) => {
        const invActual = actuales.inventarios.find((i) => i.id === claveInventario);
        const stockAnterior = invActual ? invActual.stock : (producto?.stock || 0);
        const costoActual = actuales.costos.find((c) => c.id === claveInventario);
        const costoAnterior = costoActual ? costoActual.costoUnitario : (producto?.costoUnitario ?? null);
        const nuevoCosto = costoAnterior != null && stockAnterior > 0
          ? round2((stockAnterior * costoAnterior + cant * costo) / (stockAnterior + cant))
          : costo;
        costoFinal = nuevoCosto;

        const nuevoInv = {
          id: claveInventario, varianteId: productoId, ubicacion,
          stock: round2(stockAnterior + cant),
          stockMinimo: invActual ? invActual.stockMinimo : (producto?.stockMinimo ?? null),
          fechaIncorporacion: invActual ? invActual.fechaIncorporacion : (producto?.fechaIncorporacion || todayStr()),
        };
        const nuevosInventarios = invActual
          ? actuales.inventarios.map((i) => (i.id === claveInventario ? nuevoInv : i))
          : [...actuales.inventarios, nuevoInv];

        const nuevoCostoReg = { id: claveInventario, varianteId: productoId, ubicacion, costoUnitario: nuevoCosto };
        const nuevosCostos = costoActual
          ? actuales.costos.map((c) => (c.id === claveInventario ? nuevoCostoReg : c))
          : [...actuales.costos, nuevoCostoReg];

        const compra = {
          id: `C${Date.now()}`,
          fecha, productoId, codigo: producto.codigo, producto: producto.producto, talla: producto.talla, ubicacion,
          tipo: producto.tipo, cantidad: cant, costoUnitario: costo, proveedor: proveedor.trim(), total: totalCalc,
        };
        const mov = {
          id: `M${Date.now()}`, fecha, tipo: "ENTRADA", productoId, ubicacion,
          productoNombre: `${producto.producto}${producto.talla !== "Única" ? " - " + producto.talla : ""}`,
          cantidad: cant, motivo: `Compra a ${proveedor.trim()}`,
        };

        const resultado = {
          inventarios: nuevosInventarios,
          costos: nuevosCostos,
          compras: [...actuales.compras, compra],
          movimientos: [...actuales.movimientos, mov],
        };
        // El precio mínimo de venta SÍ es compartido entre ubicaciones
        // (no cambia según dónde se compre), así que se guarda en el
        // producto/variante, no en el inventario de esta ubicación.
        if (pMin != null) {
          resultado.productos = actuales.productos.map((p) => (p.id === productoId ? { ...p, precioMinimo: pMin } : p));
        }
        return resultado;
      });

      showToast("success", `Compra registrada. Costo actualizado a ${formatSoles(costoFinal)}.`);
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "COMPRA", ubicacion,
        detalle: `Compró ${cant} ${producto?.producto || ""}${producto?.talla && producto.talla !== "Única" ? " - " + producto.talla : ""} a ${proveedor.trim()} — S/ ${totalCalc.toFixed(2)}`,
      }).catch(() => {});
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

  // Análisis 80/20 (Pareto): agrupa todo lo comprado por producto, ordena
  // de mayor a menor gasto, y marca cuáles concentran el 80% del total —
  // esos son los que más conviene vigilar o negociar con el proveedor.
  const pareto = useMemo(() => {
    const porProducto = {};
    for (const c of compras) {
      if (!porProducto[c.productoId]) {
        porProducto[c.productoId] = { productoId: c.productoId, nombre: `${c.producto}${c.talla !== "Única" ? " - " + c.talla : ""}`, codigo: c.codigo, valor: 0 };
      }
      porProducto[c.productoId].valor += c.total;
    }
    return calcularPareto(Object.values(porProducto).map((p) => ({ ...p, valor: round2(p.valor) })));
  }, [compras]);

  // Análisis ABC de inventario: el mismo mecanismo de Pareto, pero sobre
  // el VALOR del stock actual (stock × costo), no sobre lo gastado en
  // comprarlo. Sirve para saber qué productos concentran el dinero que
  // hoy está inmovilizado en el inventario. Los productos sin costo
  // registrado no se pueden valorizar, así que quedan afuera (se avisa
  // cuántos son, en vez de mezclarlos como si valieran S/ 0).
  const productosConCosto = useMemo(() => productos.filter((p) => p.costoUnitario != null), [productos]);
  const productosSinCostoAbc = productos.length - productosConCosto.length;
  const abcInventario = useMemo(() => {
    const items = productosConCosto
      .map((p) => ({
        productoId: p.id, nombre: `${p.producto}${p.talla !== "Única" ? " - " + p.talla : ""}`, codigo: p.codigo,
        valor: round2((p.stock || 0) * p.costoUnitario),
      }))
      .filter((p) => p.valor > 0); // sin stock no aporta valor, no tiene sentido rankearlo
    return calcularPareto(items);
  }, [productosConCosto]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <button onClick={() => setTab("registro")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${tab === "registro" ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"}`}>
            Registro de compras
          </button>
          <button onClick={() => setTab("pareto")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition inline-flex items-center gap-1 ${tab === "pareto" ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"}`}>
            <BarChart3 size={13} /> Análisis 80/20
          </button>
          <button onClick={() => setTab("abc")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition inline-flex items-center gap-1 ${tab === "abc" ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"}`}>
            <PieChart size={13} /> ABC de inventario
          </button>
        </div>
        {tab === "registro" && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-1.5"
          >
            <Plus size={15} /> Registrar compra
          </button>
        )}
      </div>

      {tab === "pareto" ? (
        pareto.length === 0 ? (
          <EmptyState icon={BarChart3} title="Todavía no hay compras para analizar" body="En cuanto registres compras, aquí vas a ver qué productos concentran el 80% de tu gasto." />
        ) : (
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
            <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200">
              <p className="text-sm text-stone-600">
                Los productos marcados en rojo son los que concentran aproximadamente el <strong>80% de todo lo que has comprado</strong>. Son los que más conviene vigilar de cerca o negociar con el proveedor.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-stone-600">Producto</th>
                    <th className="text-right px-4 py-2 font-medium text-stone-600">Gastado</th>
                    <th className="text-right px-4 py-2 font-medium text-stone-600">% del total</th>
                    <th className="text-right px-4 py-2 font-medium text-stone-600">% acumulado</th>
                    <th className="text-center px-4 py-2 font-medium text-stone-600">Zona</th>
                  </tr>
                </thead>
                <tbody>
                  {pareto.map((p) => (
                    <tr key={p.productoId} className={`border-b border-stone-50 last:border-0 ${p.enEl80 ? "bg-red-50/40" : ""}`}>
                      <td className="px-4 py-2 text-stone-800">
                        {p.nombre} <span className="text-stone-400 font-mono text-xs ml-1">{p.codigo}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-stone-900">{formatSoles(p.valor)}</td>
                      <td className="px-4 py-2 text-right text-stone-600">{p.pctIndividual}%</td>
                      <td className="px-4 py-2 text-right text-stone-600">{p.pctAcumulado}%</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.enEl80 ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-500"}`}>
                          {p.enEl80 ? "80%" : "20%"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : tab === "abc" ? (
        <>
          {productosSinCostoAbc > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 mb-4">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {productosSinCostoAbc} producto{productosSinCostoAbc !== 1 ? "s" : ""} sin costo registrado no se {productosSinCostoAbc !== 1 ? "incluyen" : "incluye"} en este análisis (ve a "Compras" para registrarles un costo).
              </p>
            </div>
          )}
          {abcInventario.length === 0 ? (
            <EmptyState icon={PieChart} title="Todavía no hay inventario para analizar" body="En cuanto tengas stock con costo registrado, aquí vas a ver qué productos concentran el 80% del valor inmovilizado." />
          ) : (
            <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
              <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200">
                <p className="text-sm text-stone-600">
                  Los productos marcados en rojo (zona A) concentran aproximadamente el <strong>80% del valor hoy inmovilizado en inventario</strong> ({ubicacion === "todas" ? "consolidado" : "esta sede"}). Son los que más conviene vigilar de cerca.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-stone-600">Producto</th>
                      <th className="text-right px-4 py-2 font-medium text-stone-600">Valor en stock</th>
                      <th className="text-right px-4 py-2 font-medium text-stone-600">% del total</th>
                      <th className="text-right px-4 py-2 font-medium text-stone-600">% acumulado</th>
                      <th className="text-center px-4 py-2 font-medium text-stone-600">Zona</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abcInventario.map((p) => (
                      <tr key={p.productoId} className={`border-b border-stone-50 last:border-0 ${p.enEl80 ? "bg-red-50/40" : ""}`}>
                        <td className="px-4 py-2 text-stone-800">
                          {p.nombre} <span className="text-stone-400 font-mono text-xs ml-1">{p.codigo}</span>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-stone-900">{formatSoles(p.valor)}</td>
                        <td className="px-4 py-2 text-right text-stone-600">{p.pctIndividual}%</td>
                        <td className="px-4 py-2 text-right text-stone-600">{p.pctAcumulado}%</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.enEl80 ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-500"}`}>
                            {p.enEl80 ? "A" : "B/C"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
      <>
      {showForm && esConsolidado && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Estás viendo el consolidado de todas las sedes. Elige una sede específica arriba (en el menú) para poder registrar una compra — en modo consolidado no hay a dónde atribuirla.
        </div>
      )}
      {showForm && !esConsolidado && (
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
                    {producto.precioMinimo != null && <> · Precio mínimo actual: {formatSoles(producto.precioMinimo)}</>}
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

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Precio mínimo de venta (S/, opcional)</label>
                <input type="number" min="0" step="0.5" value={precioMinimo} onChange={(e) => setPrecioMinimo(e.target.value)} placeholder="Dejar vacío para no cambiar el mínimo actual"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                <p className="text-xs text-stone-400 mt-1">Si lo defines, Ventas avisará si alguien intenta vender este producto por debajo de este precio.</p>
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
                        {esConsolidado && <th className="text-left px-3 py-1.5 font-medium">Sede</th>}
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
                          {esConsolidado && <td className="px-3 py-1.5 text-stone-500">{NOMBRE_UBICACION[c.ubicacion] || NOMBRE_UBICACION.sumaj_illari}</td>}
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
      </>
      )}
    </div>
  );
}

