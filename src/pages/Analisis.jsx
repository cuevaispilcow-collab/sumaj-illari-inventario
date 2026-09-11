import React from "react";
import {
  Package, TrendingDown, TrendingUp, RefreshCw, Repeat, AlertTriangle,
} from "lucide-react";
import {
  Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, AreaChart, Area, ComposedChart, Line,
} from "recharts";
import { CHART_COLORS, DARK_GRID, DARK_TICK, DARK_TOOLTIP, DARK_TOOLTIP_ITEM, DARK_TOOLTIP_LABEL } from "../utils/constants.js";
import { round2, formatSoles } from "../utils/format.js";
import MetricCard from "../components/MetricCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Analisis({ productos, movimientos, ventas }) {
  if (productos.length === 0) {
    return (
      <EmptyState
        dark
        icon={Package}
        title="Todavía no hay datos para analizar"
        body="Registra productos, ventas y movimientos para ver aquí el panel de análisis por categoría."
      />
    );
  }

  const stockTotal = productos.reduce((s, p) => s + p.stock, 0);
  const unidadesVendidas = ventas.reduce((s, v) => s + v.cantidad, 0);
  const unidadesCompradas = movimientos
    .filter((m) => m.tipo === "ENTRADA")
    .reduce((s, m) => s + m.cantidad, 0);

  let rotacionDias = null;
  if (ventas.length > 0 && unidadesVendidas > 0) {
    const fechas = ventas.map((v) => new Date(v.fecha).getTime()).filter((t) => !isNaN(t));
    if (fechas.length > 0) {
      const min = Math.min(...fechas);
      const max = Math.max(...fechas);
      const diasPeriodo = Math.max(1, Math.round((max - min) / 86400000) + 1);
      const velocidadDiaria = unidadesVendidas / diasPeriodo;
      rotacionDias = velocidadDiaria > 0 ? round2(stockTotal / velocidadDiaria) : null;
    }
  }

  // Rotación anual (veces) = costo de lo vendido ÷ valor del inventario.
  // Responde una pregunta distinta a "Días de stock disponible": no
  // "para cuánto me alcanza al ritmo actual", sino "qué tan eficiente es
  // mi plata invertida en inventario" — un número bajo es capital
  // dormido. No tenemos una foto histórica del inventario (solo el
  // stock de HOY), así que usamos el inventario ACTUAL como aproximación
  // al promedio del período — una simplificación común cuando no hay
  // ese dato, no el promedio "de libro" — y anualizamos el costo de lo
  // vendido según el rango real de fechas de venta que ya existen, para
  // que el número sea comparable al estándar de "veces al año".
  const ventasConCosto = ventas.filter((v) => v.costoUnitario != null);
  const ventasSinCostoRotacion = ventas.length - ventasConCosto.length;
  const productosConCostoRotacion = productos.filter((p) => p.costoUnitario != null);
  const productosSinCostoRotacion = productos.length - productosConCostoRotacion.length;
  const valorInventarioActual = round2(productosConCostoRotacion.reduce((s, p) => s + p.stock * p.costoUnitario, 0));

  let diasPeriodoCogs = null;
  const cogsPorClave = {};
  if (ventasConCosto.length > 0) {
    const fechasCosto = ventasConCosto.map((v) => new Date(v.fecha).getTime()).filter((t) => !isNaN(t));
    if (fechasCosto.length > 0) {
      diasPeriodoCogs = Math.max(1, Math.round((Math.max(...fechasCosto) - Math.min(...fechasCosto)) / 86400000) + 1);
    }
    for (const v of ventasConCosto) {
      const key = `${v.idProducto}__${v.talla}`;
      cogsPorClave[key] = (cogsPorClave[key] || 0) + v.costoUnitario * v.cantidad;
    }
  }
  const cogsTotal = round2(Object.values(cogsPorClave).reduce((s, c) => s + c, 0));

  let rotacionAnual = null;
  if (valorInventarioActual > 0 && diasPeriodoCogs != null) {
    rotacionAnual = round2(((cogsTotal / diasPeriodoCogs) * 365) / valorInventarioActual);
  }

  // Por producto, ordenado de MENOR a MAYOR rotación — lo que menos
  // rota (capital más dormido) aparece primero. Los que ya no tienen
  // stock actual no se pueden calcular (dividir por cero), así que
  // quedan marcados aparte, al final.
  const rotacionPorProducto = productosConCostoRotacion
    .map((p) => {
      const key = `${p.codigo}__${p.talla}`;
      const cogs = round2(cogsPorClave[key] || 0);
      const valorActual = round2((p.stock || 0) * p.costoUnitario);
      const rotacion = valorActual > 0 && diasPeriodoCogs != null
        ? round2(((cogs / diasPeriodoCogs) * 365) / valorActual)
        : null;
      return {
        id: p.id, nombre: `${p.producto}${p.talla !== "Única" ? " - " + p.talla : ""}`, codigo: p.codigo,
        valorActual, rotacion,
      };
    })
    .sort((a, b) => {
      if (a.rotacion == null && b.rotacion == null) return 0;
      if (a.rotacion == null) return 1;
      if (b.rotacion == null) return -1;
      return a.rotacion - b.rotacion;
    });

  const categorias = [...new Set(productos.map((p) => p.categoria))];
  const porCategoria = categorias
    .map((cat) => {
      const prods = productos.filter((p) => p.categoria === cat);
      const stock = prods.reduce((s, p) => s + p.stock, 0);
      const conMin = prods.filter((p) => p.stockMinimo != null);
      const minimo = conMin.length > 0 ? conMin.reduce((s, p) => s + p.stockMinimo, 0) : null;
      return { categoria: cat, stock, minimo };
    })
    .sort((a, b) => b.stock - a.stock);

  const demandaPorMes = {};
  ventas.forEach((v) => {
    const mes = v.fecha ? v.fecha.slice(0, 7) : "—";
    demandaPorMes[mes] = (demandaPorMes[mes] || 0) + v.cantidad;
  });
  const demandaData = Object.entries(demandaPorMes)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, cantidad]) => ({ mes, cantidad }));

  const conMinimoDefinido = productos.filter((p) => p.stockMinimo != null);
  const invMinimo = conMinimoDefinido.reduce((s, p) => s + p.stockMinimo, 0);
  const invSeguridad = Math.max(0, stockTotal - invMinimo);
  const porReponerLista = productos.filter((p) => p.stockMinimo != null && p.stock <= p.stockMinimo);
  const porReponer = porReponerLista.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard dark color={CHART_COLORS.info} icon={Package} label="Stock disponible" value={stockTotal} />
        <MetricCard dark color={CHART_COLORS.purple} icon={RefreshCw} label="Días de stock disponible" value={rotacionDias != null ? rotacionDias : "—"} />
        <MetricCard dark color={CHART_COLORS.warning} icon={TrendingDown} label="Unidades vendidas" value={unidadesVendidas} />
        <MetricCard dark color={CHART_COLORS.success} icon={TrendingUp} label="Unidades compradas" value={unidadesCompradas} />
      </div>

      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-1">
          <Repeat size={15} className="text-stone-400" />
          <h2 className="text-sm font-semibold text-stone-100">Rotación anual de inventario (veces)</h2>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          Costo de lo vendido ÷ valor del inventario actual, anualizado. Un número bajo indica capital dormido — dinero invertido en stock que casi no se mueve.
        </p>
        {(ventasSinCostoRotacion > 0 || productosSinCostoRotacion > 0) && (
          <p className="text-xs text-amber-400 bg-amber-950/60 border border-amber-800 rounded-lg px-3 py-2 mb-3 flex items-start gap-1.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            No incluye {productosSinCostoRotacion > 0 && `${productosSinCostoRotacion} producto${productosSinCostoRotacion !== 1 ? "s" : ""} sin costo registrado`}
            {productosSinCostoRotacion > 0 && ventasSinCostoRotacion > 0 && " ni "}
            {ventasSinCostoRotacion > 0 && `${ventasSinCostoRotacion} venta${ventasSinCostoRotacion !== 1 ? "s" : ""} de productos sin costo`}.
          </p>
        )}
        {diasPeriodoCogs == null ? (
          <p className="text-sm text-stone-400 bg-stone-800/60 border border-stone-700 rounded-lg p-3">
            Todavía no hay ninguna venta con costo registrado{ventasSinCostoRotacion > 0 ? ` (las ${ventasSinCostoRotacion} venta${ventasSinCostoRotacion !== 1 ? "s" : ""} que sí existen son de productos sin costo)` : ""} — no se puede calcular la rotación, ni la general ni por producto. En cuanto haya al menos una venta de un producto con costo, va a aparecer acá.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-stone-800/60 border border-stone-700 rounded-lg p-3">
                <p className="text-xs text-stone-400 font-medium mb-1">Rotación general</p>
                <p className="text-xl font-bold text-stone-100">
                  {rotacionAnual != null ? `${rotacionAnual}x / año` : "Sin inventario valorizado"}
                </p>
              </div>
              <div className="bg-stone-800/60 border border-stone-700 rounded-lg p-3">
                <p className="text-xs text-stone-400 font-medium mb-1">Valor de inventario (con costo)</p>
                <p className="text-xl font-bold text-stone-100">{formatSoles(valorInventarioActual)}</p>
              </div>
            </div>
            <p className="text-xs text-stone-500 mb-3">
              Calculado sobre {diasPeriodoCogs} día{diasPeriodoCogs !== 1 ? "s" : ""} de historial de ventas con costo — cuanto menos historial, menos confiable la proyección anual.
            </p>
            {rotacionPorProducto.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-500 border-b border-stone-800">
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 font-medium text-right">Valor en stock</th>
                      <th className="px-3 py-2 font-medium text-right">Rotación anual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rotacionPorProducto.map((r) => (
                      <tr key={r.id} className="border-b border-stone-800/60 last:border-0 hover:bg-stone-800/40">
                        <td className="px-3 py-1.5 text-stone-200">{r.nombre} <span className="text-stone-500 font-mono text-xs">{r.codigo}</span></td>
                        <td className="px-3 py-1.5 text-right text-stone-300">{formatSoles(r.valorActual)}</td>
                        <td className={`px-3 py-1.5 text-right font-semibold ${r.rotacion == null ? "text-stone-500" : r.rotacion < 1 ? "text-red-400" : "text-emerald-400"}`}>
                          {r.rotacion != null ? `${r.rotacion}x` : "sin stock"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-stone-100 mb-3">Stock por categoría</h2>
          {(() => {
            const paleta = [CHART_COLORS.info, CHART_COLORS.success, CHART_COLORS.purple, CHART_COLORS.warning, CHART_COLORS.primary, CHART_COLORS.neutral];
            const totalCat = porCategoria.reduce((s, c) => s + c.stock, 0);
            return (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="45%" height={190}>
                  <PieChart>
                    <Pie data={porCategoria} dataKey="stock" nameKey="categoria" innerRadius={42} outerRadius={80} paddingAngle={2} stroke="#0c0a09" strokeWidth={2}>
                      {porCategoria.map((d, i) => (
                        <Cell key={i} fill={paleta[i % paleta.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={DARK_TOOLTIP} itemStyle={DARK_TOOLTIP_ITEM} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 flex-1 min-w-0">
                  {porCategoria.map((d, i) => (
                    <div key={d.categoria} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: paleta[i % paleta.length] }} />
                        <span className="text-stone-300 truncate">{d.categoria}</span>
                      </div>
                      <span className="text-stone-400 shrink-0">
                        {totalCat > 0 ? round2((d.stock / totalCat) * 100) : 0}% · {d.stock}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-stone-100 mb-3">Demanda en el tiempo</h2>
          {demandaData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-stone-500">
              Aún no hay ventas registradas.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={demandaData} margin={{ left: 0, right: 10 }}>
                <defs>
                  <linearGradient id="demandaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.purple} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={CHART_COLORS.purple} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={DARK_GRID} />
                <XAxis dataKey="mes" tick={DARK_TICK} />
                <YAxis tick={DARK_TICK} allowDecimals={false} />
                <Tooltip contentStyle={DARK_TOOLTIP} itemStyle={DARK_TOOLTIP_ITEM} labelStyle={DARK_TOOLTIP_LABEL} />
                <Area type="monotone" dataKey="cantidad" stroke={CHART_COLORS.purple} fill="url(#demandaFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-stone-100 mb-1">Inventario óptimo por categoría</h2>
        <p className="text-xs text-stone-500 mb-3">Barra: stock actual · Línea: stock mínimo (categorías con mínimo definido)</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={porCategoria} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={DARK_GRID} />
            <XAxis dataKey="categoria" tick={DARK_TICK} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={DARK_TICK} allowDecimals={false} />
            <Tooltip contentStyle={DARK_TOOLTIP} itemStyle={DARK_TOOLTIP_ITEM} labelStyle={DARK_TOOLTIP_LABEL} />
            <Bar dataKey="stock" radius={[4, 4, 0, 0]}>
              {porCategoria.map((d, i) => (
                <Cell key={i} fill={d.minimo != null && d.stock <= d.minimo ? CHART_COLORS.danger : CHART_COLORS.success} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="minimo" stroke="#f5f5f4" strokeDasharray="4 3" dot={{ r: 3 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2.5 h-2.5 rounded-full ${porReponer === 0 ? "bg-emerald-500" : "bg-red-500"}`} />
          <h2 className="text-sm font-semibold text-stone-100">
            {porReponer === 0 ? "Stock óptimo" : "Hay productos por reponer"}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-emerald-950/60 border border-emerald-800 rounded-lg p-3">
            <p className="text-xs text-emerald-400 font-medium mb-1">Inv. disponible</p>
            <p className="text-xl font-bold text-emerald-100">{stockTotal}</p>
          </div>
          <div className="bg-stone-800/60 border border-stone-700 rounded-lg p-3">
            <p className="text-xs text-stone-400 font-medium mb-1">Inv. mínimo</p>
            <p className="text-xl font-bold text-stone-100">{invMinimo}</p>
          </div>
          <div className="bg-blue-950/60 border border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-400 font-medium mb-1">Inv. seguridad</p>
            <p className="text-xl font-bold text-blue-100">{invSeguridad}</p>
          </div>
          <div className={`rounded-lg p-3 border ${porReponer > 0 ? "bg-red-950/60 border-red-800" : "bg-stone-800/60 border-stone-700"}`}>
            <p className={`text-xs font-medium mb-1 ${porReponer > 0 ? "text-red-400" : "text-stone-400"}`}>Por reponer</p>
            <p className={`text-xl font-bold ${porReponer > 0 ? "text-red-100" : "text-stone-100"}`}>{porReponer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

