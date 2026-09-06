import React from "react";
import {
  Package, AlertTriangle, ReceiptText, Wallet, Award, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { TIPOS, CHART_COLORS, DARK_GRID, DARK_TICK, DARK_TOOLTIP, DARK_TOOLTIP_ITEM, DARK_TOOLTIP_LABEL } from "../utils/constants.js";
import { round2, formatSoles, formatFecha } from "../utils/format.js";
import MetricCard from "../components/MetricCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import MovIcon from "../components/MovIcon.jsx";

export default function Dashboard({ productos, movimientos, ventas, setView }) {
  if (productos.length === 0) {
    return (
      <EmptyState
        dark
        icon={Package}
        title="Todavía no hay productos registrados"
        body="Registra los nombres y el tipo de cada producto (materia prima, en proceso, terminado o reventa) para agregarlos aquí uno por uno."
        actionLabel="Registrar el primer producto"
        onAction={() => setView("nuevo")}
      />
    );
  }

  const stockTotal = productos.reduce((s, p) => s + p.stock, 0);
  const sinStock = productos.filter((p) => p.stock === 0);
  const bajoMinimo = productos.filter((p) => p.stockMinimo != null && p.stock <= p.stockMinimo);
  const conMinimoDefinido = productos.filter((p) => p.stockMinimo != null);
  const porReponer = productos.filter((p) => p.stockMinimo != null && p.stock <= p.stockMinimo);

  const ventasTotalesSoles = round2(ventas.reduce((s, v) => s + v.total, 0));
  const ticketPromedio = ventas.length > 0 ? round2(ventasTotalesSoles / ventas.length) : 0;
  const efectivoTotal = round2(ventas.reduce((s, v) => s + (v.efectivo || 0), 0));
  const yapeTotal = round2(ventas.reduce((s, v) => s + (v.yape || 0), 0));
  const tarjetaTotal = round2(ventas.reduce((s, v) => s + (v.tarjeta || 0), 0));

  const productoTop = useMemoTop(ventas);

  const porTipo = TIPOS.map((t) => ({
    tipo: t,
    productos: productos.filter((p) => p.tipo === t).length,
  }));

  const bajoStockChart = [...productos]
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)
    .map((p) => ({
      nombre: `${p.producto}${p.talla !== "Única" ? " " + p.talla : ""}`.slice(0, 18),
      stock: p.stock,
      status: p.stockMinimo != null ? (p.stock <= p.stockMinimo ? "bajo" : "ok") : "sin_definir",
    }));

  const pagoData = [
    { name: "Efectivo", value: efectivoTotal },
    { name: "Yape", value: yapeTotal },
    { name: "Tarjeta", value: tarjetaTotal },
  ];
  const sinPagoRegistrado = efectivoTotal === 0 && yapeTotal === 0 && tarjetaTotal === 0;

  const recientes = [...movimientos].slice(-6).reverse();

  return (
    <div className="space-y-6">
      {/* Fila 1: métricas de stock */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard dark color={CHART_COLORS.info} icon={Package} label="Stock total" value={stockTotal} />
        <MetricCard dark color={CHART_COLORS.danger} icon={AlertTriangle} label="Bajo stock mínimo" value={bajoMinimo.length} />
        <MetricCard dark color={CHART_COLORS.warning} icon={AlertTriangle} label="Sin stock" value={sinStock.length} />
        <MetricCard dark color={CHART_COLORS.purple} icon={Package} label="Productos" value={productos.length} />
      </div>

      {/* Fila 2: métricas de ventas */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard dark color={CHART_COLORS.success} icon={Wallet} label="Ventas totales" value={formatSoles(ventasTotalesSoles)} />
        <MetricCard dark color={CHART_COLORS.purple} icon={ReceiptText} label="Ticket promedio" value={formatSoles(ticketPromedio)} />
        <MetricCard dark color={CHART_COLORS.primary} icon={Award} label="Producto más vendido" value={productoTop ? productoTop.nombre : "—"} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-stone-100 mb-1">Menor stock (top 8)</h2>
          <p className="text-xs text-stone-500 mb-3">Rojo: bajo el mínimo · Verde: por encima · Gris: sin mínimo definido</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bajoStockChart} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={DARK_GRID} />
              <XAxis type="number" tick={DARK_TICK} allowDecimals={false} />
              <YAxis type="category" dataKey="nombre" tick={DARK_TICK} width={110} />
              <Tooltip contentStyle={DARK_TOOLTIP} itemStyle={DARK_TOOLTIP_ITEM} labelStyle={DARK_TOOLTIP_LABEL} />
              <Bar dataKey="stock" radius={[0, 4, 4, 0]}>
                {bajoStockChart.map((d, i) => (
                  <Cell key={i} fill={d.status === "bajo" ? CHART_COLORS.danger : d.status === "ok" ? CHART_COLORS.success : CHART_COLORS.neutral} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-stone-100 mb-3">Forma de pago</h2>
          {sinPagoRegistrado ? (
            <div className="h-[170px] flex items-center justify-center text-sm text-stone-500">
              Aún no hay ventas con efectivo, Yape o tarjeta registrados.
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={170}>
                <PieChart>
                  <Pie data={pagoData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={72} paddingAngle={2} stroke="#1c1917" strokeWidth={2}>
                    <Cell fill={CHART_COLORS.success} />
                    <Cell fill={CHART_COLORS.purple} />
                    <Cell fill={CHART_COLORS.info} />
                  </Pie>
                  <Tooltip contentStyle={DARK_TOOLTIP} itemStyle={DARK_TOOLTIP_ITEM} formatter={(v) => `S/ ${v}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS.success }} />
                    <span className="text-stone-400">Efectivo</span>
                  </div>
                  <span className="font-semibold text-stone-100">{formatSoles(efectivoTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS.purple }} />
                    <span className="text-stone-400">Yape</span>
                  </div>
                  <span className="font-semibold text-stone-100">{formatSoles(yapeTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS.info }} />
                    <span className="text-stone-400">Tarjeta</span>
                  </div>
                  <span className="font-semibold text-stone-100">{formatSoles(tarjetaTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel de reposición estilo tarjetas de color */}
      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw size={15} className="text-stone-400" />
          <h2 className="text-sm font-semibold text-stone-100">Panel de reposición</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-emerald-950/60 border border-emerald-800 rounded-lg p-3">
            <p className="text-xs text-emerald-400 font-medium mb-1">Stock disponible</p>
            <p className="text-xl font-bold text-emerald-100">{stockTotal}</p>
          </div>
          <div className="bg-stone-800/60 border border-stone-700 rounded-lg p-3">
            <p className="text-xs text-stone-400 font-medium mb-1">Con mínimo definido</p>
            <p className="text-xl font-bold text-stone-100">{conMinimoDefinido.length} / {productos.length}</p>
          </div>
          <div className={`rounded-lg p-3 border ${porReponer.length > 0 ? "bg-red-950/60 border-red-800" : "bg-stone-800/60 border-stone-700"}`}>
            <p className={`text-xs font-medium mb-1 ${porReponer.length > 0 ? "text-red-400" : "text-stone-400"}`}>Por reponer</p>
            <p className={`text-xl font-bold ${porReponer.length > 0 ? "text-red-100" : "text-stone-100"}`}>{porReponer.length}</p>
          </div>
          <div className="bg-amber-950/60 border border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-400 font-medium mb-1">Sin stock</p>
            <p className="text-xl font-bold text-amber-100">{sinStock.length}</p>
          </div>
        </div>
        {porReponer.length > 0 && (
          <div className="mt-3 space-y-1">
            {porReponer.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs text-stone-300 bg-red-950/40 rounded px-2 py-1">
                <span>{p.producto}{p.talla !== "Única" ? ` - ${p.talla}` : ""}</span>
                <span className="font-semibold">{p.stock} / mín. {p.stockMinimo}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-stone-100 mb-3">Movimientos recientes</h2>
        {recientes.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay movimientos registrados.</p>
        ) : (
          <div className="space-y-2">
            {recientes.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <MovIcon tipo={m.tipo} />
                  <div className="min-w-0">
                    <p className="text-stone-200 truncate">{m.productoNombre}</p>
                    <p className="text-xs text-stone-500">{formatFecha(m.fecha)}</p>
                  </div>
                </div>
                <span className="text-stone-300 shrink-0 ml-2">{m.tipo === "ENTRADA" ? "+" : "-"}{m.cantidad}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function useMemoTop(ventas) {
  if (ventas.length === 0) return null;
  const counts = {};
  for (const v of ventas) {
    counts[v.producto] = (counts[v.producto] || 0) + v.cantidad;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries.length > 0 ? { nombre: entries[0][0], cantidad: entries[0][1] } : null;
}

