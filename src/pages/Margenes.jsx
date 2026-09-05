import React from "react";
import {
  AlertTriangle, ReceiptText, Wallet, Award, Percent,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { CHART_COLORS } from "../utils/constants.js";
import { round2, formatSoles } from "../utils/format.js";
import MetricCard from "../components/MetricCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Margenes({ productos, ventas }) {
  const ventasConCosto = ventas.filter((v) => v.costoUnitario != null);
  const ventasSinCosto = ventas.length - ventasConCosto.length;

  if (ventas.length === 0) {
    return (
      <EmptyState
        dark
        icon={Percent}
        title="Todavía no hay ventas registradas"
        body="Cuando registres ventas de productos que ya tengan un costo (desde 'Compras'), aquí verás el margen real de ganancia."
      />
    );
  }

  const porProducto = {};
  ventasConCosto.forEach((v) => {
    const key = `${v.idProducto}-${v.producto}`;
    if (!porProducto[key]) {
      porProducto[key] = { nombre: `${v.producto} (${v.idProducto})`, unidades: 0, ingreso: 0, costo: 0 };
    }
    porProducto[key].unidades += v.cantidad;
    porProducto[key].ingreso += v.total;
    porProducto[key].costo += v.costoUnitario * v.cantidad;
  });

  const ranking = Object.values(porProducto)
    .map((r) => ({
      ...r,
      ingreso: round2(r.ingreso),
      costo: round2(r.costo),
      margenSoles: round2(r.ingreso - r.costo),
      margenPct: r.ingreso > 0 ? round2(((r.ingreso - r.costo) / r.ingreso) * 100) : 0,
    }))
    .sort((a, b) => b.margenSoles - a.margenSoles);

  const ingresoTotal = round2(ranking.reduce((s, r) => s + r.ingreso, 0));
  const costoTotal = round2(ranking.reduce((s, r) => s + r.costo, 0));
  const margenBrutoTotal = round2(ingresoTotal - costoTotal);
  const margenPctTotal = ingresoTotal > 0 ? round2((margenBrutoTotal / ingresoTotal) * 100) : 0;
  const masRentable = ranking[0];

  return (
    <div className="space-y-6">
      {ventasSinCosto > 0 && (
        <div className="bg-amber-950/60 border border-amber-800 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            {ventasSinCosto} venta{ventasSinCosto !== 1 ? "s" : ""} no se incluyen en este análisis porque el producto todavía no tiene un costo registrado (ve a "Compras" para agregarlo).
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard dark color={CHART_COLORS.success} icon={Wallet} label="Margen bruto total" value={formatSoles(margenBrutoTotal)} />
        <MetricCard dark color={CHART_COLORS.purple} icon={Percent} label="Margen promedio" value={`${margenPctTotal}%`} />
        <MetricCard dark color={CHART_COLORS.info} icon={ReceiptText} label="Ingreso (con costo)" value={formatSoles(ingresoTotal)} />
        <MetricCard dark color={CHART_COLORS.primary} icon={Award} label="Más rentable" value={masRentable ? masRentable.nombre : "—"} />
      </div>

      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-stone-100 mb-3">Margen por producto (S/)</h2>
        <ResponsiveContainer width="100%" height={Math.max(220, ranking.length * 34)}>
          <BarChart data={ranking} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={DARK_GRID} />
            <XAxis type="number" tick={DARK_TICK} />
            <YAxis type="category" dataKey="nombre" tick={DARK_TICK} width={160} />
            <Tooltip contentStyle={DARK_TOOLTIP} itemStyle={DARK_TOOLTIP_ITEM} labelStyle={DARK_TOOLTIP_LABEL} formatter={(v) => `S/ ${v}`} />
            <Bar dataKey="margenSoles" radius={[0, 4, 4, 0]}>
              {ranking.map((r, i) => (
                <Cell key={i} fill={r.margenSoles >= 0 ? CHART_COLORS.success : CHART_COLORS.danger} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm overflow-hidden">
        <h2 className="text-sm font-semibold text-stone-100 p-4 pb-0 mb-3">Detalle de márgenes por producto</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-500 border-b border-stone-800">
              <th className="px-4 py-2 font-medium">Producto</th>
              <th className="px-4 py-2 font-medium text-right">Unidades</th>
              <th className="px-4 py-2 font-medium text-right">Ingreso</th>
              <th className="px-4 py-2 font-medium text-right">Costo</th>
              <th className="px-4 py-2 font-medium text-right">Margen S/</th>
              <th className="px-4 py-2 font-medium text-right">Margen %</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.nombre} className="border-b border-stone-800/60 last:border-0 hover:bg-stone-800/40">
                <td className="px-4 py-2 text-stone-200">{r.nombre}</td>
                <td className="px-4 py-2 text-right text-stone-200">{r.unidades}</td>
                <td className="px-4 py-2 text-right text-stone-300">{formatSoles(r.ingreso)}</td>
                <td className="px-4 py-2 text-right text-stone-400">{formatSoles(r.costo)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${r.margenSoles >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatSoles(r.margenSoles)}
                </td>
                <td className={`px-4 py-2 text-right font-semibold ${r.margenPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {r.margenPct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

