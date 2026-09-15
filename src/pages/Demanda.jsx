import React, { useId } from "react";
import {
  Package, TrendingDown, TrendingUp, Award,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { DARK_GRID, DARK_TICK, DARK_TOOLTIP, DARK_TOOLTIP_ITEM, DARK_TOOLTIP_LABEL } from "../utils/constants.js";
import { ESTADO_COLORES, BAR_MAX_SIZE, useTemaChart } from "../utils/chartTheme.js";
import { round2, formatSoles } from "../utils/format.js";
import MetricCard from "../components/MetricCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Demanda({ ventas, productos }) {
  const temaChart = useTemaChart();
  const gradientId = `demanda-top10-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (ventas.length === 0) {
    return (
      <EmptyState
        dark
        icon={TrendingUp}
        title="Todavía no hay ventas registradas"
        body="Cuando registres ventas, aquí verás qué productos tienen más demanda."
      />
    );
  }

  const porProducto = {};
  ventas.forEach((v) => {
    const key = `${v.idProducto}-${v.producto}${v.talla && v.talla !== "Única" ? " - " + v.talla : ""}`;
    if (!porProducto[key]) {
      porProducto[key] = { nombre: key, unidades: 0, ingreso: 0 };
    }
    porProducto[key].unidades += v.cantidad;
    porProducto[key].ingreso += v.total;
  });

  const ranking = Object.values(porProducto)
    .map((r) => ({ ...r, ingreso: round2(r.ingreso) }))
    .sort((a, b) => b.unidades - a.unidades);

  const totalUnidades = ranking.reduce((s, r) => s + r.unidades, 0);
  const top10 = ranking.slice(0, 10);

  const stockPorId = {};
  productos.forEach((p) => { stockPorId[p.codigo] = p; });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard dark color={temaChart.serie[3]} icon={Package} label="Productos con demanda" value={ranking.length} />
        <MetricCard dark color={ESTADO_COLORES.warning} icon={TrendingDown} label="Unidades vendidas" value={totalUnidades} />
        <MetricCard dark color="marca" icon={Award} label="Más vendido" value={ranking[0]?.nombre || "—"} />
      </div>

      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-stone-100 mb-3">Top 10 productos con más demanda</h2>
        <ResponsiveContainer width="100%" height={Math.max(220, top10.length * 34)}>
          <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 20 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={temaChart.acento} stopOpacity={0.55} />
                <stop offset="100%" stopColor={temaChart.acento} stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={DARK_GRID} />
            <XAxis type="number" tick={DARK_TICK} allowDecimals={false} />
            <YAxis type="category" dataKey="nombre" tick={DARK_TICK} width={160} />
            <Tooltip contentStyle={DARK_TOOLTIP} itemStyle={DARK_TOOLTIP_ITEM} labelStyle={DARK_TOOLTIP_LABEL} />
            <Bar dataKey="unidades" fill={`url(#${gradientId})`} radius={[0, 4, 4, 0]} maxBarSize={BAR_MAX_SIZE} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm overflow-hidden">
        <h2 className="text-sm font-semibold text-stone-100 p-4 pb-0 mb-3">Ranking completo de demanda</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-500 border-b border-stone-800">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Producto</th>
              <th className="px-4 py-2 font-medium text-right">Unidades vendidas</th>
              <th className="px-4 py-2 font-medium text-right">% de demanda</th>
              <th className="px-4 py-2 font-medium text-right">Ingreso</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={r.nombre} className="border-b border-stone-800/60 last:border-0 hover:bg-stone-800/40">
                <td className="px-4 py-2 text-stone-500">{i + 1}</td>
                <td className="px-4 py-2 text-stone-200">{r.nombre}</td>
                <td className="px-4 py-2 text-right text-stone-200">{r.unidades}</td>
                <td className="px-4 py-2 text-right text-stone-400">
                  {totalUnidades > 0 ? round2((r.unidades / totalUnidades) * 100) : 0}%
                </td>
                <td className="px-4 py-2 text-right text-stone-200">{formatSoles(r.ingreso)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

