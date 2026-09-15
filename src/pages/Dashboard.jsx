import React from "react";
import {
  Package, AlertTriangle, ReceiptText, Wallet, Award, RefreshCw, Banknote, CheckCircle2, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { TIPOS, DARK_GRID, DARK_TICK, DARK_TOOLTIP, DARK_TOOLTIP_ITEM, DARK_TOOLTIP_LABEL } from "../utils/constants.js";
import { ESTADO_COLORES, BAR_MAX_SIZE, useTemaChart } from "../utils/chartTheme.js";
import { round2, formatSoles, formatFecha, diasHasta } from "../utils/format.js";
import MetricCard from "../components/MetricCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import MovIcon from "../components/MovIcon.jsx";

// Cuántas filas como máximo se muestran de cada TIPO de alerta — a
// propósito es un límite chico: el objetivo de este panel es que se
// pueda mirar en 5 segundos al entrar. Si hubiera 40 avisos, nadie lo
// miraría; mejor mostrar los primeros y decir "y N más".
const MAX_POR_TIPO = 5;

export default function Dashboard({ productos, movimientos, ventas, setView, esConsolidado, valorizacionPorSede, nombreVista, pedidos, solicitudesPendientes, alertasSinStock, alertasBajoMinimo, onIrAPedidos }) {
  const temaChart = useTemaChart();
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
  const conMinimoDefinido = productos.filter((p) => p.stockMinimo != null);

  // Panel de alertas: lo primero que se ve al entrar, para que abrir el
  // sistema tenga un motivo todos los días. Orden de urgencia (definido
  // junto con la gerente): vencidos → vence pronto → solicitudes
  // pendientes → sin stock → bajo mínimo.
  //
  // "Sin stock" y "bajo mínimo" llegan ya calculados sede por sede desde
  // App.jsx (no sobre el total combinado de la vista): en vista
  // múltiple, una sede podría estar en cero mientras otra tiene de
  // sobra, y el total combinado se vería "bien" y escondería el
  // problema real — por eso cada alerta indica de qué sede es.
  // "Entregado" es el final del flujo nuevo (producción y entrega
  // separadas); "Completado" es el final del flujo VIEJO (de antes de
  // separarlas) — un pedido "Listo para entregar" todavía cuenta como
  // pendiente acá: si ya se venció su fecha de entrega y sigue sin
  // entregarse, sigue siendo tan urgente como uno recién tomado.
  const pedidosPendientes = (pedidos || [])
    .filter((p) => p.etapa !== "Entregado" && p.etapa !== "Completado")
    .map((p) => ({ ...p, dias: diasHasta(p.fechaEntrega) }));
  const pedidosVencidos = pedidosPendientes.filter((p) => p.dias < 0).sort((a, b) => a.dias - b.dias);
  const pedidosVencenPronto = pedidosPendientes.filter((p) => p.dias >= 0 && p.dias <= 3).sort((a, b) => a.dias - b.dias);
  const solicitudesLista = solicitudesPendientes || [];
  const alertasSinStockLista = alertasSinStock || [];
  const alertasBajoMinimoLista = alertasBajoMinimo || [];
  const hayAlertas = pedidosVencidos.length > 0 || pedidosVencenPronto.length > 0 || solicitudesLista.length > 0 || alertasSinStockLista.length > 0 || alertasBajoMinimoLista.length > 0;

  // Valorización de inventario: cuánto dinero hay inmovilizado en stock
  // (stock × costo unitario). Solo cuenta productos con costo conocido
  // — los que no lo tienen quedarían valorizados en S/ 0, lo que
  // distorsionaría el total en vez de simplemente faltar un dato.
  const productosConCosto = productos.filter((p) => p.costoUnitario != null);
  const productosSinCosto = productos.length - productosConCosto.length;
  const valorInventario = round2(productosConCosto.reduce((s, p) => s + p.stock * p.costoUnitario, 0));

  const ventasTotalesSoles = round2(ventas.reduce((s, v) => s + v.total, 0));
  const efectivoTotal = round2(ventas.reduce((s, v) => s + (v.efectivo || 0), 0));
  const yapeTotal = round2(ventas.reduce((s, v) => s + (v.yape || 0), 0));
  const tarjetaTotal = round2(ventas.reduce((s, v) => s + (v.tarjeta || 0), 0));

  // Comparativo "vs mes pasado": solo tiene sentido sobre un número
  // acotado a un período (el mes en curso), nunca sobre un total
  // histórico que siempre crece — por eso "Ventas totales" pasó a ser
  // "Ventas del mes" (el histórico queda como dato chico aparte). Si
  // no hubo NINGUNA venta el mes pasado (ej. catálogo recién vaciado),
  // no se calcula el comparativo — mostrar un "+100%" o un "∞" sería
  // inventar una cifra a partir de la nada.
  const hoy = new Date();
  const claveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const mesActualClave = claveMes(hoy);
  const mesPasadoClave = claveMes(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
  const ventasMesActual = ventas.filter((v) => v.fecha && v.fecha.slice(0, 7) === mesActualClave);
  const ventasMesPasado = ventas.filter((v) => v.fecha && v.fecha.slice(0, 7) === mesPasadoClave);
  const totalMesActual = round2(ventasMesActual.reduce((s, v) => s + v.total, 0));
  const totalMesPasado = round2(ventasMesPasado.reduce((s, v) => s + v.total, 0));
  const comparativoVentas = totalMesPasado > 0
    ? { pct: round2(((totalMesActual - totalMesPasado) / totalMesPasado) * 100), direccion: totalMesActual >= totalMesPasado ? "up" : "down" }
    : null;

  const ticketMesActual = ventasMesActual.length > 0 ? round2(totalMesActual / ventasMesActual.length) : 0;
  const ticketMesPasado = ventasMesPasado.length > 0 ? round2(totalMesPasado / ventasMesPasado.length) : 0;
  const comparativoTicket = ticketMesPasado > 0
    ? { pct: round2(((ticketMesActual - ticketMesPasado) / ticketMesPasado) * 100), direccion: ticketMesActual >= ticketMesPasado ? "up" : "down" }
    : null;

  // Sparkline de venta diaria (últimos 14 días). Con menos de 4 días
  // distintos con venta en esa ventana, no se dibuja — una línea de 2 o
  // 3 puntos no muestra ninguna tendencia real (mismo criterio que ya
  // usamos con la Rotación de inventario: mejor no mostrar el número
  // que mostrar uno sin sustento).
  const ultimos14Dias = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const ventaPorDia = {};
  for (const v of ventas) {
    if (v.fecha) ventaPorDia[v.fecha] = round2((ventaPorDia[v.fecha] || 0) + v.total);
  }
  const diasConVentaEnVentana = ultimos14Dias.filter((d) => ventaPorDia[d] != null).length;
  const sparklineVentas = diasConVentaEnVentana >= 4 ? ultimos14Dias.map((d) => ventaPorDia[d] || 0) : null;

  // El producto más vendido también pasa a ser del mes, por coherencia
  // con las otras dos tarjetas de esta fila (antes era histórico).
  const productoTop = useMemoTop(ventasMesActual);

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
    <div className="space-y-8">
      {/* Panel de alertas: lo primero que se ve al entrar. */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 shadow-xl shadow-black/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={15} style={{ color: temaChart.acento }} />
          <h2 className="text-sm font-semibold text-stone-100">Alertas</h2>
        </div>
        {!hayAlertas ? (
          <div className="flex items-center gap-2 text-emerald-300 text-sm bg-emerald-950/40 border border-emerald-800 rounded-lg px-3 py-3">
            <CheckCircle2 size={16} className="shrink-0" /> Todo en orden — no hay nada urgente por ahora.
          </div>
        ) : (
          <div className="space-y-4">
            {pedidosVencidos.length > 0 && (
              <SeccionAlerta titulo="Pedidos vencidos" tono="rojo">
                {pedidosVencidos.slice(0, MAX_POR_TIPO).map((p) => (
                  <FilaAlerta key={p.id} tono="rojo" onClick={onIrAPedidos}
                    texto={`${p.cliente} — ${p.producto}${p.talla !== "Única" ? " - " + p.talla : ""}`}
                    detalle={`venció hace ${Math.abs(p.dias)} día${Math.abs(p.dias) !== 1 ? "s" : ""}${esConsolidado ? " · " + p.nombreSede : ""}`} />
                ))}
                {pedidosVencidos.length > MAX_POR_TIPO && <MasAlertas n={pedidosVencidos.length - MAX_POR_TIPO} />}
              </SeccionAlerta>
            )}
            {pedidosVencenPronto.length > 0 && (
              <SeccionAlerta titulo="Pedidos por vencer" tono="ambar">
                {pedidosVencenPronto.slice(0, MAX_POR_TIPO).map((p) => (
                  <FilaAlerta key={p.id} tono="ambar" onClick={onIrAPedidos}
                    texto={`${p.cliente} — ${p.producto}${p.talla !== "Única" ? " - " + p.talla : ""}`}
                    detalle={`${p.dias === 0 ? "vence hoy" : `vence en ${p.dias} día${p.dias !== 1 ? "s" : ""}`}${esConsolidado ? " · " + p.nombreSede : ""}`} />
                ))}
                {pedidosVencenPronto.length > MAX_POR_TIPO && <MasAlertas n={pedidosVencenPronto.length - MAX_POR_TIPO} />}
              </SeccionAlerta>
            )}
            {solicitudesLista.length > 0 && (
              <SeccionAlerta titulo="Solicitudes entre sedes pendientes" tono="marca" acento={temaChart.acento}>
                {solicitudesLista.slice(0, MAX_POR_TIPO).map((s) => (
                  <FilaAlerta key={s.id} tono="marca" acento={temaChart.acento} onClick={() => setView("transferencias")}
                    texto={`${s.cantidad} ${s.productoNombre}`}
                    detalle={`pedido por ${s.nombreSolicitante}${esConsolidado ? " · a " + s.nombreSede : ""}`} />
                ))}
                {solicitudesLista.length > MAX_POR_TIPO && <MasAlertas n={solicitudesLista.length - MAX_POR_TIPO} />}
              </SeccionAlerta>
            )}
            {alertasSinStockLista.length > 0 && (
              <SeccionAlerta titulo="Sin stock" tono="rojo">
                {alertasSinStockLista.slice(0, MAX_POR_TIPO).map((a) => (
                  <FilaAlerta key={a.id} tono="rojo" onClick={() => setView("productos")}
                    texto={a.nombre}
                    detalle={`0 unidades${esConsolidado ? " · " + a.nombreSede : ""}`} />
                ))}
                {alertasSinStockLista.length > MAX_POR_TIPO && <MasAlertas n={alertasSinStockLista.length - MAX_POR_TIPO} />}
              </SeccionAlerta>
            )}
            {alertasBajoMinimoLista.length > 0 && (
              <SeccionAlerta titulo="Bajo su stock mínimo" tono="ambar">
                {alertasBajoMinimoLista.slice(0, MAX_POR_TIPO).map((a) => (
                  <FilaAlerta key={a.id} tono="ambar" onClick={() => setView("productos")}
                    texto={a.nombre}
                    detalle={`${a.stock} / mín. ${a.stockMinimo}${esConsolidado ? " · " + a.nombreSede : ""}`} />
                ))}
                {alertasBajoMinimoLista.length > MAX_POR_TIPO && <MasAlertas n={alertasBajoMinimoLista.length - MAX_POR_TIPO} />}
              </SeccionAlerta>
            )}
          </div>
        )}
      </div>

      {/* Fila 1: métricas de stock */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard dark color={temaChart.serie[3]} icon={Package} label="Stock total" value={stockTotal} />
        <MetricCard dark color={ESTADO_COLORES.danger} icon={AlertTriangle} label="Bajo stock mínimo" value={alertasBajoMinimoLista.length} hint={esConsolidado ? "casos por sede, no productos" : undefined} />
        <MetricCard dark color={ESTADO_COLORES.warning} icon={AlertTriangle} label="Sin stock" value={alertasSinStockLista.length} hint={esConsolidado ? "casos por sede, no productos" : undefined} />
        <MetricCard dark color={temaChart.serie[3]} icon={Package} label="Productos" value={productos.length} />
      </div>

      {/* Valorización de inventario. Sin comparativo a propósito: no
          existe una "foto" guardada de cómo estaba el stock hace un
          mes (inventarios/costos se sobrescriben, no llevan historial),
          así que mostrar un "vs mes pasado" acá sería inventarlo. */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 shadow-xl shadow-black/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Banknote size={15} style={{ color: temaChart.acento }} />
          <h2 className="text-sm font-semibold text-stone-100">Valorización de inventario</h2>
        </div>
        {productosSinCosto > 0 && (
          <p className="text-xs text-amber-400 bg-amber-950/60 border border-amber-800 rounded-lg px-3 py-2 mb-3 flex items-start gap-1.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            {productosSinCosto} producto{productosSinCosto !== 1 ? "s" : ""} sin costo registrado no se {productosSinCosto !== 1 ? "incluyen" : "incluye"} en este total (el valor real es mayor).
          </p>
        )}
        <p className="text-3xl font-bold text-emerald-400">{formatSoles(valorInventario)}</p>
        <p className="text-xs text-stone-400 mt-1">
          {esConsolidado ? `Total en ${nombreVista}` : "En esta sede"}
        </p>
        {esConsolidado && valorizacionPorSede && valorizacionPorSede.length > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-800 space-y-1.5">
            {valorizacionPorSede.map((v) => (
              <div key={v.ubicacion} className="flex items-center justify-between text-sm">
                <span className="text-stone-400">{v.nombre}</span>
                <span className="font-semibold text-stone-200">{formatSoles(v.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fila 2: métricas de ventas, ahora acotadas al mes en curso (antes
          eran históricas) — es lo que permite comparar "vs mes pasado"
          de forma honesta. El total histórico no desaparece: queda como
          dato chico debajo de "Ventas del mes". Si no hubo ventas el mes
          pasado, el comparativo simplemente no aparece (ver más arriba). */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard
          dark color="marca" icon={Wallet} label="Ventas del mes" value={formatSoles(totalMesActual)}
          comparativo={comparativoVentas} sparklineData={sparklineVentas}
          hint={`Total histórico: ${formatSoles(ventasTotalesSoles)}`}
        />
        <MetricCard dark color={temaChart.serie[1]} icon={ReceiptText} label="Ticket promedio (mes)" value={formatSoles(ticketMesActual)} comparativo={comparativoTicket} />
        <MetricCard dark color={temaChart.serie[2]} icon={Award} label="Más vendido (mes)" value={productoTop ? productoTop.nombre : "—"} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-stone-900 rounded-2xl border border-stone-800 shadow-xl shadow-black/20 p-5">
          <h2 className="text-sm font-semibold text-stone-100 mb-1">Menor stock (top 8)</h2>
          <p className="text-xs text-stone-400 mb-3">Rojo: bajo el mínimo · Verde: por encima · Gris: sin mínimo definido</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bajoStockChart} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={DARK_GRID} />
              <XAxis type="number" tick={DARK_TICK} allowDecimals={false} />
              <YAxis type="category" dataKey="nombre" tick={DARK_TICK} width={110} />
              <Tooltip contentStyle={DARK_TOOLTIP} itemStyle={DARK_TOOLTIP_ITEM} labelStyle={DARK_TOOLTIP_LABEL} />
              <Bar dataKey="stock" radius={[0, 4, 4, 0]} maxBarSize={BAR_MAX_SIZE}>
                {bajoStockChart.map((d, i) => (
                  <Cell key={i} fill={d.status === "bajo" ? ESTADO_COLORES.danger : d.status === "ok" ? ESTADO_COLORES.success : temaChart.serie[3]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-stone-900 rounded-2xl border border-stone-800 shadow-xl shadow-black/20 p-5">
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
                    <Cell fill={temaChart.serie[0]} />
                    <Cell fill={temaChart.serie[1]} />
                    <Cell fill={temaChart.serie[2]} />
                  </Pie>
                  <Tooltip contentStyle={DARK_TOOLTIP} itemStyle={DARK_TOOLTIP_ITEM} formatter={(v) => `S/ ${v}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: temaChart.serie[0] }} />
                    <span className="text-stone-400">Efectivo</span>
                  </div>
                  <span className="font-semibold text-stone-100">{formatSoles(efectivoTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: temaChart.serie[1] }} />
                    <span className="text-stone-400">Yape</span>
                  </div>
                  <span className="font-semibold text-stone-100">{formatSoles(yapeTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: temaChart.serie[2] }} />
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
      <div className="bg-stone-900 rounded-2xl border border-stone-800 shadow-xl shadow-black/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw size={15} style={{ color: temaChart.acento }} />
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
          <div className={`rounded-lg p-3 border ${alertasBajoMinimoLista.length > 0 ? "bg-red-950/60 border-red-800" : "bg-stone-800/60 border-stone-700"}`}>
            <p className={`text-xs font-medium mb-1 ${alertasBajoMinimoLista.length > 0 ? "text-red-400" : "text-stone-400"}`}>Por reponer</p>
            <p className={`text-xl font-bold ${alertasBajoMinimoLista.length > 0 ? "text-red-100" : "text-stone-100"}`}>{alertasBajoMinimoLista.length}</p>
            {esConsolidado && <p className={`text-[10px] mt-0.5 ${alertasBajoMinimoLista.length > 0 ? "text-red-300" : "text-stone-400"}`}>casos por sede, no productos</p>}
          </div>
          <div className="bg-amber-950/60 border border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-400 font-medium mb-1">Sin stock</p>
            <p className="text-xl font-bold text-amber-100">{alertasSinStockLista.length}</p>
            {esConsolidado && <p className="text-[10px] text-amber-300 mt-0.5">casos por sede, no productos</p>}
          </div>
        </div>
        {alertasBajoMinimoLista.length > 0 && (
          <div className="mt-3 space-y-1">
            {alertasBajoMinimoLista.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs text-stone-300 bg-red-950/40 rounded px-2 py-1">
                <span>{a.nombre}{esConsolidado ? ` · ${a.nombreSede}` : ""}</span>
                <span className="font-semibold">{a.stock} / mín. {a.stockMinimo}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-stone-900 rounded-2xl border border-stone-800 shadow-xl shadow-black/20 p-5">
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


// Un grupo de alertas del mismo tipo (ej. todos los "Pedidos vencidos"
// juntos), con su etiqueta de color.
// El tono "marca" (solicitudes entre sedes: ni alerta ni advertencia,
// solo "necesita tu atención") usa el acento de la sede actual en vez
// de un color de estado fijo — por eso recibe `acento` en vez de tener
// una clase Tailwind estática como rojo/ámbar.
const TONOS_TITULO = { rojo: "text-red-400", ambar: "text-amber-400" };
function SeccionAlerta({ titulo, tono, acento, children }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${TONOS_TITULO[tono] || ""}`} style={tono === "marca" ? { color: acento } : undefined}>{titulo}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// Una fila de alerta individual, clicable — lleva directo a la pantalla
// donde se puede resolver (ej. clic en un pedido vencido → Producción).
const TONOS_FILA = {
  rojo: "bg-red-950/40 hover:bg-red-950/60 text-red-100",
  ambar: "bg-amber-950/40 hover:bg-amber-950/60 text-amber-100",
};
function FilaAlerta({ tono, acento, texto, detalle, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${TONOS_FILA[tono] || "text-stone-100 hover:brightness-125"}`}
      style={tono === "marca" ? { backgroundColor: acento + "26" } : undefined}>
      <span className="truncate">{texto}</span>
      <span className="flex items-center gap-1 shrink-0 text-xs opacity-80 whitespace-nowrap">
        {detalle} <ChevronRight size={14} />
      </span>
    </button>
  );
}

// "y 12 más" — para que la lista nunca crezca sin control dentro del panel.
function MasAlertas({ n }) {
  return <p className="text-xs text-stone-400 px-3 pt-0.5">y {n} más</p>;
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

