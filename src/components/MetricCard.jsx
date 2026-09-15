import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { useTemaChart } from "../utils/chartTheme.js";

// `comparativo` (opcional): { pct, direccion: "up"|"down", etiqueta }.
// Solo se muestra si viene informado — si no hay suficiente historial
// para compararlo con algo, quien arma la tarjeta simplemente no manda
// este dato, en vez de inventar un porcentaje.
//
// `sparklineData` (opcional): array de números (ej. venta por día de
// los últimos 14 días). Con menos de 4 puntos no se dibuja — una línea
// de 2 o 3 puntos no muestra ninguna tendencia real, sería decoración
// vacía (mismo criterio que ya usamos con la Rotación de inventario).
export default function MetricCard({ icon: Icon, label, value, tone = "default", dark = false, color, hint, comparativo, sparklineData }) {
  const temaChart = useTemaChart();
  const c = color === "marca" ? temaChart.acento : (color || "#DC2626");

  if (dark) {
    return (
      <div className="bg-stone-900 rounded-2xl border border-stone-800 shadow-xl shadow-black/20 p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</span>
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: c + "26" }}>
            <Icon size={18} style={{ color: c }} />
          </div>
        </div>
        <p className="text-3xl font-bold text-stone-50 tracking-tight truncate">{value}</p>
        {comparativo && (
          <div className={`inline-flex items-center gap-1 mt-2 text-xs font-semibold ${comparativo.direccion === "up" ? "text-emerald-400" : "text-red-400"}`}>
            {comparativo.direccion === "up" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(comparativo.pct)}% vs {comparativo.etiqueta || "mes pasado"}
          </div>
        )}
        {hint && <p className="text-[10px] text-stone-400 mt-1">{hint}</p>}
        {sparklineData && sparklineData.length >= 4 && (
          <div className="h-8 mt-3 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData.map((v) => ({ v }))} margin={{ top: 2, bottom: 2 }}>
                <Line type="monotone" dataKey="v" stroke={c} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }
  const toneClasses = { default: "text-stone-900", danger: "text-red-600", warning: "text-amber-600" };
  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-4">
      <div className="flex items-center gap-2 text-stone-500 mb-1">
        <Icon size={16} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-semibold ${toneClasses[tone]}`}>{value}</p>
      {hint && <p className="text-[10px] text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}
