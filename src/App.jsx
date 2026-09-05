import React, { useState, useEffect, useMemo } from "react";
import {
  Package, TrendingDown, TrendingUp, ArrowLeftRight, AlertTriangle, Search,
  Plus, CheckCircle2, XCircle, PackagePlus, Edit3, Trash2, ReceiptText, RotateCcw, Download,
  Wallet, Award, RefreshCw, LineChart as LineChartIcon, LayoutDashboard, Menu, X, LogOut, ShoppingCart, Truck, Percent, Factory,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  CartesianGrid, AreaChart, Area, Legend, ComposedChart, Line,
} from "recharts";
import * as XLSX from "xlsx";
import AuthGate from "./AuthGate.jsx";
import { escucharColeccion, guardarColeccion } from "./firestoreSync.js";
import { puedeVer, vistaInicial } from "./roles.js";

import Logo from "./Logo.jsx";

const TIPOS = ["Materia prima", "En proceso", "Terminado", "Reventa"];
const TIPO_COLORS = { "Materia prima": "#a8a29e", "En proceso": "#d97706", "Terminado": "#ea580c", "Reventa": "#78716c" };

// Paleta de colores para gráficos, pensada para que se vea consistente
// y profesional en todo el sistema (no colores sueltos por gráfico).
const CHART_COLORS = {
  primary: "#DC2626",  // rojo de marca — métricas principales
  danger: "#DC2626",   // alertas / bajo stock
  success: "#0D9488",  // verde azulado (teal) — positivo / ok
  info: "#2563EB",     // azul — barras informativas
  warning: "#F59E0B",  // ámbar — advertencias
  neutral: "#A8A29E",  // gris piedra — sin datos / neutral
  purple: "#7C3AED",   // morado — Yape / acento secundario
};


function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatSoles(n) {
  const num = Number(n) || 0;
  return "S/ " + num.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[m - 1]} ${y}`;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
          <div className="bg-white border border-red-200 rounded-lg p-5 max-w-lg w-full">
            <p className="font-semibold text-red-700 mb-2">Ocurrió un error inesperado</p>
            <p className="text-sm text-stone-600 mb-3">
              La app encontró un problema y se detuvo para no perder datos. Copia este mensaje si necesitas ayuda:
            </p>
            <pre className="text-xs bg-stone-50 border border-stone-200 rounded p-3 overflow-auto text-stone-700 whitespace-pre-wrap">
              {String(this.state.error && (this.state.error.message || this.state.error))}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-3 px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function SumajIllariApp({ rol, cerrarSesion }) {
  const [productos, setProductos] = useState(null);
  const [movimientos, setMovimientos] = useState(null);
  const [ventas, setVentas] = useState(null);
  const [compras, setCompras] = useState(null);
  const [producciones, setProducciones] = useState(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState(vistaInicial(rol));
  const [toast, setToast] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");

  // Escucha en tiempo real: cuando CUALQUIER dispositivo (celular de una
  // vendedora, computadora de la gerente, etc.) guarda un cambio, todos
  // los demás lo reciben automáticamente aquí, sin recargar la página.
  useEffect(() => {
    let cargados = { productos: false, movimientos: false, ventas: false, compras: false, producciones: false };
    const marcarListo = () => {
      if (cargados.productos && cargados.movimientos && cargados.ventas && cargados.compras && cargados.producciones) setReady(true);
    };
    const manejarError = (error) => {
      setErrorCarga(
        "No se pudo conectar con la base de datos: " +
        (error && error.code ? error.code : (error && error.message) || "error desconocido") +
        ". Revisa las reglas de seguridad de Firestore."
      );
    };
    const unsub1 = escucharColeccion("productos", (items) => {
      setProductos(items);
      cargados.productos = true;
      marcarListo();
    }, manejarError);
    const unsub2 = escucharColeccion("movimientos", (items) => {
      setMovimientos(items);
      cargados.movimientos = true;
      marcarListo();
    }, manejarError);
    const unsub3 = escucharColeccion("ventas", (items) => {
      setVentas(items);
      cargados.ventas = true;
      marcarListo();
    }, manejarError);
    const unsub4 = escucharColeccion("compras", (items) => {
      setCompras(items);
      cargados.compras = true;
      marcarListo();
    }, manejarError);
    const unsub5 = escucharColeccion("producciones", (items) => {
      setProducciones(items);
      cargados.producciones = true;
      marcarListo();
    }, manejarError);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, []);

  // Red de seguridad: si algo falla en segundo plano (por ejemplo, el guardado),
  // que se vea como aviso en vez de quedarse la app "congelada" en silencio.
  useEffect(() => {
    function onRejection(e) {
      showToast("error", "Hubo un problema en segundo plano: " + (e.reason?.message || "intenta de nuevo."));
    }
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  function persist(newProductos, newMovimientos, newVentas, newCompras, newProducciones) {
    // 1) Actualiza la pantalla al instante, sin esperar nada.
    setProductos(newProductos);
    setMovimientos(newMovimientos);
    if (newVentas !== undefined) setVentas(newVentas);
    if (newCompras !== undefined) setCompras(newCompras);
    if (newProducciones !== undefined) setProducciones(newProducciones);

    // 2) Guarda en Firestore en segundo plano. Como todos los dispositivos
    //    escuchan la misma base de datos (ver el useEffect de arriba), este
    //    cambio se refleja automáticamente en el celular de cualquier otra
    //    persona que tenga la app abierta.
    (async () => {
      try {
        const withTimeout = (p, ms) =>
          Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
        await withTimeout(guardarColeccion("productos", newProductos), 8000);
        await withTimeout(guardarColeccion("movimientos", newMovimientos), 8000);
        if (newVentas !== undefined) {
          await withTimeout(guardarColeccion("ventas", newVentas), 8000);
        }
        if (newCompras !== undefined) {
          await withTimeout(guardarColeccion("compras", newCompras), 8000);
        }
        if (newProducciones !== undefined) {
          await withTimeout(guardarColeccion("producciones", newProducciones), 8000);
        }
      } catch (e) {
        showToast("error", "Se guardó en pantalla, pero el respaldo tardó demasiado. Usa \"Exportar Excel\" para no perder datos.");
      }
    })();

    return Promise.resolve();
  }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function resetAll() {
    await persist([], [], [], [], []);
    setConfirmReset(false);
    showToast("success", "Todo se reinició. Catálogo, movimientos, ventas, compras y producción en cero.");
  }

  function exportarExcel() {
    if (productos.length === 0 && ventas.length === 0 && movimientos.length === 0 && compras.length === 0 && producciones.length === 0) {
      showToast("error", "No hay nada que exportar todavía.");
      return;
    }
    const wb = XLSX.utils.book_new();

    const wsProductos = XLSX.utils.json_to_sheet(
      productos.map((p) => ({
        ID_Producto: p.id, Codigo: p.codigo, Tipo: p.tipo, Categoria: p.categoria,
        Producto: p.producto, Descripcion: p.descripcion, Talla: p.talla, Unidad: p.unidad,
        Stock_Actual: p.stock, Stock_Minimo: p.stockMinimo ?? "", Costo_Unitario_Promedio: p.costoUnitario ?? "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsProductos, "Productos");

    const wsVentas = XLSX.utils.json_to_sheet(
      ventas.map((v) => ({
        FECHA: v.fecha, "ID-PRODUCTO": v.idProducto, PRODUCTO: v.producto, CANTIDAD: v.cantidad,
        TALLA: v.talla, DESCRIPCION: v.descripcion, PRECIO: v.precio, EFECTIVO: v.efectivo,
        YAPE: v.yape, TARJETA: v.tarjeta || 0, TOTAL: v.total,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");

    const wsMov = XLSX.utils.json_to_sheet(
      movimientos.map((m) => ({
        Fecha: m.fecha, Tipo: m.tipo, Producto: m.productoNombre, Cantidad: m.cantidad, Motivo: m.motivo || "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsMov, "Movimientos");

    const wsCompras = XLSX.utils.json_to_sheet(
      compras.map((c) => ({
        Fecha: c.fecha, Codigo: c.codigo, Producto: c.producto, Talla: c.talla, Tipo: c.tipo,
        Cantidad: c.cantidad, Costo_Unitario: c.costoUnitario, Proveedor: c.proveedor, Total: c.total,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsCompras, "Compras");

    const wsProd = XLSX.utils.json_to_sheet(
      producciones.map((pr) => ({
        Fecha: pr.fecha, Codigo: pr.codigo, Producto: pr.producto, Talla: pr.talla,
        Cantidad_Producida: pr.cantidad, Costo_Unitario_Calculado: pr.costoUnitario, Costo_Total: pr.total,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsProd, "Produccion");

    const fechaArchivo = todayStr();
    XLSX.writeFile(wb, `SUMAJ_ILLARI_Respaldo_${fechaArchivo}.xlsx`);
    showToast("success", "Excel descargado. Revisa tu carpeta de Descargas.");
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 p-6">
        {errorCarga ? (
          <div className="bg-white border border-red-200 rounded-lg p-5 max-w-lg w-full">
            <p className="font-semibold text-red-700 mb-2">No se pudo cargar la información</p>
            <p className="text-sm text-stone-600">{errorCarga}</p>
          </div>
        ) : (
          <p className="text-stone-500 text-sm">Cargando...</p>
        )}
      </div>
    );
  }

  // Seguridad: si la vista actual no está permitida para este rol
  // (por ejemplo, alguien escribe la sección directamente), se corrige.
  const vistaSegura = puedeVer(rol, view) ? view : vistaInicial(rol);
  const vistaOscura = ["dashboard", "analisis", "demanda", "margenes"].includes(vistaSegura);

  return (
    <div className="min-h-screen bg-stone-100 lg:flex">
      <Sidebar view={vistaSegura} setView={setView} onResetClick={() => setConfirmReset(true)} onExportClick={exportarExcel} rol={rol} cerrarSesion={cerrarSesion} />
      <main className={`flex-1 min-w-0 ${vistaOscura ? "bg-stone-950" : ""}`}>
        <div className="max-w-6xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
          {vistaSegura === "dashboard" && <Dashboard productos={productos} movimientos={movimientos} ventas={ventas} setView={setView} />}
          {vistaSegura === "productos" && (
            <Productos productos={productos} movimientos={movimientos} ventas={ventas} onSave={persist} showToast={showToast} setView={setView} rol={rol} />
          )}
          {vistaSegura === "ventas" && (
            <Ventas productos={productos} movimientos={movimientos} ventas={ventas} onSave={persist} showToast={showToast} />
          )}
          {vistaSegura === "demanda" && <Demanda ventas={ventas} productos={productos} />}
          {vistaSegura === "analisis" && <Analisis productos={productos} movimientos={movimientos} ventas={ventas} />}
          {vistaSegura === "margenes" && <Margenes productos={productos} ventas={ventas} />}
          {vistaSegura === "movimientos" && (
            <Movimientos productos={productos} movimientos={movimientos} onSave={persist} showToast={showToast} />
          )}
          {vistaSegura === "compras" && (
            <Compras productos={productos} movimientos={movimientos} compras={compras} onSave={persist} showToast={showToast} />
          )}
          {vistaSegura === "produccion" && (
            <Produccion productos={productos} movimientos={movimientos} compras={compras} producciones={producciones} onSave={persist} showToast={showToast} />
          )}
          {vistaSegura === "nuevo" && (
            <NuevoProducto productos={productos} movimientos={movimientos} onSave={persist} showToast={showToast} setView={setView} />
          )}
        </div>
      </main>
      {toast && <Toast type={toast.type} msg={toast.msg} />}
      {confirmReset && (
        <ConfirmModal
          title="¿Reiniciar todo?"
          body="Esto borra el catálogo de productos, los movimientos, las ventas y las compras guardadas. No se puede deshacer."
          onCancel={() => setConfirmReset(false)}
          onConfirm={resetAll}
        />
      )}
    </div>
  );
}

function Sidebar({ view, setView, onResetClick, onExportClick, rol, cerrarSesion }) {
  const [abierto, setAbierto] = useState(false);
  const tabsTodas = [
    { id: "dashboard", label: "Panel", icon: LayoutDashboard },
    { id: "productos", label: "Productos", icon: Package },
    { id: "ventas", label: "Ventas", icon: ReceiptText },
    { id: "demanda", label: "Demanda", icon: TrendingUp },
    { id: "analisis", label: "Análisis", icon: LineChartIcon },
    { id: "margenes", label: "Márgenes", icon: Percent },
    { id: "movimientos", label: "Entradas / salidas", icon: ArrowLeftRight },
    { id: "compras", label: "Compras", icon: ShoppingCart },
    { id: "produccion", label: "Producción", icon: Factory },
    { id: "nuevo", label: "Nuevo producto", icon: PackagePlus },
  ];
  const tabs = tabsTodas.filter((t) => puedeVer(rol, t.id));

  const contenidoNav = (
    <>
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <Logo size={48} className="shrink-0" />
        <div>
          <p className="leading-none">
            <span className="text-red-400 font-black tracking-tight text-xl">SUMAJ</span>
            <span className="text-stone-100 font-black tracking-tight text-xl"> ILLARI</span>
          </p>
          <p className="text-xs text-stone-400 font-semibold mt-1">Control de inventarios</p>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const activo = view === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setView(t.id); setAbierto(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activo ? "bg-red-600 text-white shadow-sm" : "text-stone-300 hover:bg-stone-800 hover:text-white"
              }`}
            >
              <Icon size={17} className="shrink-0" />
              {t.label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 pb-5 pt-3 border-t border-stone-800 space-y-1">
        {rol === "gerente" && (
          <button
            onClick={onExportClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-300 hover:bg-stone-800 hover:text-white transition"
          >
            <Download size={17} className="shrink-0" /> Exportar Excel
          </button>
        )}
        {rol === "gerente" && (
          <button
            onClick={onResetClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-400 hover:bg-stone-800 hover:text-white transition"
          >
            <RotateCcw size={17} className="shrink-0" /> Reiniciar todo
          </button>
        )}
        <button
          onClick={cerrarSesion}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-400 hover:bg-stone-800 hover:text-white transition"
        >
          <LogOut size={17} className="shrink-0" /> Salir
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Barra superior solo en móvil/tablet */}
      <div className="lg:hidden flex items-center justify-between bg-stone-900 text-stone-100 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Logo size={36} />
          <p className="leading-none">
            <span className="text-red-400 font-black tracking-tight text-base">SUMAJ</span>
            <span className="text-stone-100 font-black tracking-tight text-base"> ILLARI</span>
          </p>
        </div>
        <button onClick={() => setAbierto(true)} className="p-2 rounded hover:bg-stone-800">
          <Menu size={22} />
        </button>
      </div>

      {/* Menú deslizable en móvil */}
      {abierto && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 bg-stone-900 flex flex-col shadow-xl">
            <div className="flex justify-end px-3 pt-3">
              <button onClick={() => setAbierto(false)} className="p-2 rounded text-stone-300 hover:bg-stone-800">
                <X size={20} />
              </button>
            </div>
            {contenidoNav}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setAbierto(false)} />
        </div>
      )}

      {/* Barra lateral fija en pantallas grandes */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-stone-900 text-stone-100 lg:sticky lg:top-0 lg:h-screen">
        {contenidoNav}
      </aside>
    </>
  );
}

function ConfirmModal({ title, body, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg p-5 max-w-sm w-full">
        <h3 className="font-semibold text-stone-900 mb-2">{title}</h3>
        <p className="text-sm text-stone-600 mb-4">{body}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm font-medium border border-stone-300 text-stone-600 hover:bg-stone-50">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700">
            Sí, reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone = "default", dark = false, color }) {
  if (dark) {
    const c = color || "#DC2626";
    return (
      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</span>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: c + "26" }}>
            <Icon size={16} style={{ color: c }} />
          </div>
        </div>
        <p className="text-2xl font-semibold text-stone-50 truncate">{value}</p>
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
    </div>
  );
}

// Estilo compartido para los gráficos (recharts) en las vistas oscuras.
const DARK_GRID = "#292524";
const DARK_TICK = { fontSize: 11, fill: "#a8a29e" };
const DARK_TOOLTIP = { fontSize: 12, borderRadius: 8, backgroundColor: "#1c1917", border: "1px solid #44403c", color: "#f5f5f4" };
const DARK_TOOLTIP_ITEM = { color: "#f5f5f4" };
const DARK_TOOLTIP_LABEL = { color: "#e7e5e4" };

function EmptyState({ icon: Icon, title, body, actionLabel, onAction, dark = false }) {
  if (dark) {
    return (
      <div className="bg-stone-900 rounded-lg border border-dashed border-stone-700 p-10 text-center">
        <Icon size={28} className="mx-auto text-stone-600 mb-3" />
        <p className="font-medium text-stone-200 mb-1">{title}</p>
        <p className="text-sm text-stone-400 mb-4 max-w-sm mx-auto">{body}</p>
        {actionLabel && (
          <button onClick={onAction} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-2">
            <Plus size={15} /> {actionLabel}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border border-dashed border-stone-300 p-10 text-center">
      <Icon size={28} className="mx-auto text-stone-300 mb-3" />
      <p className="font-medium text-stone-700 mb-1">{title}</p>
      <p className="text-sm text-stone-500 mb-4 max-w-sm mx-auto">{body}</p>
      {actionLabel && (
        <button onClick={onAction} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-2">
          <Plus size={15} /> {actionLabel}
        </button>
      )}
    </div>
  );
}

function Dashboard({ productos, movimientos, ventas, setView }) {
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

function Analisis({ productos, movimientos, ventas }) {
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
        <MetricCard dark color={CHART_COLORS.purple} icon={RefreshCw} label="Rotación inventario (días)" value={rotacionDias != null ? rotacionDias : "—"} />
        <MetricCard dark color={CHART_COLORS.warning} icon={TrendingDown} label="Unidades vendidas" value={unidadesVendidas} />
        <MetricCard dark color={CHART_COLORS.success} icon={TrendingUp} label="Unidades compradas" value={unidadesCompradas} />
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

function Demanda({ ventas, productos }) {
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
        <MetricCard dark color={CHART_COLORS.info} icon={Package} label="Productos con demanda" value={ranking.length} />
        <MetricCard dark color={CHART_COLORS.warning} icon={TrendingDown} label="Unidades vendidas" value={totalUnidades} />
        <MetricCard dark color={CHART_COLORS.primary} icon={Award} label="Más vendido" value={ranking[0]?.nombre || "—"} />
      </div>

      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-stone-100 mb-3">Top 10 productos con más demanda</h2>
        <ResponsiveContainer width="100%" height={Math.max(220, top10.length * 34)}>
          <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={DARK_GRID} />
            <XAxis type="number" tick={DARK_TICK} allowDecimals={false} />
            <YAxis type="category" dataKey="nombre" tick={DARK_TICK} width={160} />
            <Tooltip contentStyle={DARK_TOOLTIP} itemStyle={DARK_TOOLTIP_ITEM} labelStyle={DARK_TOOLTIP_LABEL} />
            <Bar dataKey="unidades" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
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

function Margenes({ productos, ventas }) {
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

function useMemoTop(ventas) {
  if (ventas.length === 0) return null;
  const counts = {};
  for (const v of ventas) {
    counts[v.producto] = (counts[v.producto] || 0) + v.cantidad;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries.length > 0 ? { nombre: entries[0][0], cantidad: entries[0][1] } : null;
}

function MovIcon({ tipo }) {
  if (tipo === "ENTRADA") return <TrendingUp size={14} className="text-emerald-400 shrink-0" />;
  if (tipo === "SALIDA") return <TrendingDown size={14} className="text-stone-400 shrink-0" />;
  if (tipo === "VENTA") return <ReceiptText size={14} className="text-red-400 shrink-0" />;
  return <ArrowLeftRight size={14} className="text-red-400 shrink-0" />;
}

function Productos({ productos, movimientos, ventas, onSave, showToast, setView, rol }) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editandoProducto, setEditandoProducto] = useState(null); // producto completo en edición (modal)

  const filtrados = productos.filter((p) => {
    const matchesQ =
      q.trim() === "" ||
      p.producto.toLowerCase().includes(q.toLowerCase()) ||
      p.codigo.toLowerCase().includes(q.toLowerCase()) ||
      p.categoria.toLowerCase().includes(q.toLowerCase());
    const matchesTipo = tipo === "todos" || p.tipo === tipo;
    return matchesQ && matchesTipo;
  });

  function startEdit(p) {
    setEditingId(p.id);
    setEditValue(p.stockMinimo != null ? String(p.stockMinimo) : "");
  }

  async function saveEdit(p) {
    const val = editValue.trim() === "" ? null : Number(editValue);
    if (editValue.trim() !== "" && (isNaN(val) || val < 0)) {
      showToast("error", "El stock mínimo debe ser un número válido, 0 o mayor.");
      return;
    }
    const newProductos = productos.map((x) => (x.id === p.id ? { ...x, stockMinimo: val } : x));
    await onSave(newProductos, movimientos);
    setEditingId(null);
    showToast("success", "Stock mínimo actualizado.");
  }

  function statusOf(p) {
    if (p.stockMinimo == null) return "sin_definir";
    return p.stock <= p.stockMinimo ? "bajo" : "ok";
  }

  if (productos.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="El catálogo está vacío"
        body="Agrega productos con su nombre y tipo (materia prima, en proceso, terminado o reventa). No se inventa nada aquí."
        actionLabel="Registrar producto"
        onAction={() => setView("nuevo")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {["todos", ...TIPOS].map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              tipo === t ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
            }`}
          >
            {t === "todos" ? "Todos" : t}
            <span className="ml-1 opacity-60">({t === "todos" ? productos.length : productos.filter((p) => p.tipo === t).length})</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, código o categoría"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-stone-600">Código</th>
              <th className="text-left px-4 py-2 font-medium text-stone-600">Tipo</th>
              <th className="text-left px-4 py-2 font-medium text-stone-600">Producto</th>
              <th className="text-left px-4 py-2 font-medium text-stone-600">Talla</th>
              <th className="text-right px-4 py-2 font-medium text-stone-600">Stock</th>
              <th className="text-right px-4 py-2 font-medium text-stone-600">Stock mínimo</th>
              {rol === "gerente" && <th className="text-right px-4 py-2 font-medium text-stone-600">Costo unit.</th>}
              <th className="text-center px-4 py-2 font-medium text-stone-600">Estado</th>
              <th className="text-center px-4 py-2 font-medium text-stone-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => {
              const status = statusOf(p);
              return (
                <tr key={p.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2 text-stone-500 font-mono text-xs whitespace-nowrap">{p.id}</td>
                  <td className="px-4 py-2 text-stone-600 whitespace-nowrap">{p.tipo}</td>
                  <td className="px-4 py-2 text-stone-800">{p.producto}</td>
                  <td className="px-4 py-2 text-stone-500">{p.talla}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${p.stock === 0 ? "text-red-600" : "text-stone-800"}`}>
                    {p.stock} <span className="text-xs font-normal text-stone-400">{p.unidad}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(p)}
                          className="w-16 px-1.5 py-1 rounded border border-red-400 text-sm text-stone-800 bg-white text-right focus:outline-none"
                        />
                        <button onClick={() => saveEdit(p)} className="text-red-600 hover:text-red-800">
                          <CheckCircle2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(p)} className="text-stone-600 hover:text-red-600 inline-flex items-center gap-1">
                        {p.stockMinimo != null ? p.stockMinimo : <span className="text-stone-300">sin definir</span>}
                        <Edit3 size={11} className="opacity-50" />
                      </button>
                    )}
                  </td>
                  {rol === "gerente" && (
                    <td className="px-4 py-2 text-right text-stone-600">
                      {p.costoUnitario != null ? formatSoles(p.costoUnitario) : <span className="text-stone-300">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        status === "bajo" ? "bg-red-500" : status === "ok" ? "bg-green-500" : "bg-stone-200"
                      }`}
                      title={status === "bajo" ? "Bajo el mínimo" : status === "ok" ? "Por encima del mínimo" : "Sin mínimo definido"}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => setEditandoProducto(p)}
                      title="Editar producto"
                      className="p-1.5 rounded text-stone-500 hover:text-red-600 hover:bg-red-50 transition"
                    >
                      <Edit3 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={rol === "gerente" ? 9 : 8} className="px-4 py-8 text-center text-stone-400">
                  No se encontraron productos con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editandoProducto && (
        <EditarProductoModal
          producto={editandoProducto}
          productos={productos}
          movimientos={movimientos}
          ventas={ventas}
          onSave={onSave}
          showToast={showToast}
          onClose={() => setEditandoProducto(null)}
        />
      )}
    </div>
  );
}

function EditarProductoModal({ producto, productos, movimientos, ventas, onSave, showToast, onClose }) {
  const [codigo, setCodigo] = useState(producto.codigo);
  const [categoria, setCategoria] = useState(producto.categoria);
  const [nombre, setNombre] = useState(producto.producto);
  const [descripcion, setDescripcion] = useState(producto.descripcion || "");
  const [talla, setTalla] = useState(producto.talla);
  const [unidad, setUnidad] = useState(producto.unidad);
  const [stock, setStock] = useState(String(producto.stock));
  const [stockMinimo, setStockMinimo] = useState(producto.stockMinimo != null ? String(producto.stockMinimo) : "");
  const [tipo, setTipo] = useState(producto.tipo);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  async function handleEliminar() {
    // Al eliminar, también se quita de cualquier Ficha técnica que lo usara
    // como insumo (si no, quedaría una referencia rota "producto eliminado").
    const nuevosProductos = productos
      .filter((p) => p.id !== producto.id)
      .map((p) => (p.receta ? { ...p, receta: p.receta.filter((r) => r.materiaPrimaId !== producto.id) } : p));
    try {
      setGuardando(true);
      await onSave(nuevosProductos, movimientos, ventas);
      showToast("success", `Producto "${producto.producto}" eliminado.`);
      onClose();
    } catch (err) {
      setError("No se pudo eliminar: " + (err && err.message ? err.message : String(err)));
      setGuardando(false);
    }
  }

  async function handleGuardar() {
    if (!codigo.trim() || !categoria.trim() || !nombre.trim()) {
      setError("Código, categoría y nombre son obligatorios.");
      return;
    }
    const nuevoId = `${codigo.trim()}-${talla.trim() || "Única"}`;
    const chocaConOtro = productos.some((p) => p.id !== producto.id && p.id === nuevoId);
    if (chocaConOtro) {
      setError(`Ya existe otro producto con código "${codigo.trim()}" y talla "${talla.trim() || "Única"}".`);
      return;
    }
    const st = Number(stock);
    if (isNaN(st) || st < 0) {
      setError("El stock debe ser un número válido, 0 o mayor.");
      return;
    }
    const sm = stockMinimo.trim() === "" ? null : Number(stockMinimo);
    if (stockMinimo.trim() !== "" && (isNaN(sm) || sm < 0)) {
      setError("El stock mínimo debe ser un número válido.");
      return;
    }

    const actualizado = {
      ...producto,
      id: nuevoId, codigo: codigo.trim(), categoria: categoria.trim(), producto: nombre.trim(),
      descripcion: descripcion.trim(), talla: talla.trim() || "Única", unidad,
      stock: st, stockMinimo: sm, tipo,
    };
    let nuevosProductos = productos.map((p) => (p.id === producto.id ? actualizado : p));

    // Si cambió el ID (código o talla), mantenemos el historial enlazado
    // actualizando las referencias en movimientos, ventas Y en las Fichas
    // técnicas de otros productos que lo usen como insumo.
    let nuevosMovimientos = movimientos;
    let nuevasVentas = ventas;
    if (nuevoId !== producto.id) {
      nuevosMovimientos = movimientos.map((m) =>
        m.productoId === producto.id
          ? { ...m, productoId: nuevoId, productoNombre: `${actualizado.producto}${actualizado.talla !== "Única" ? " - " + actualizado.talla : ""}` }
          : m
      );
      nuevosProductos = nuevosProductos.map((p) =>
        p.receta
          ? { ...p, receta: p.receta.map((r) => (r.materiaPrimaId === producto.id ? { ...r, materiaPrimaId: nuevoId } : r)) }
          : p
      );
    }
    if (codigo.trim() !== producto.codigo) {
      nuevasVentas = ventas.map((v) => (v.idProducto === producto.codigo ? { ...v, idProducto: codigo.trim() } : v));
    }

    try {
      setGuardando(true);
      await onSave(nuevosProductos, nuevosMovimientos, nuevasVentas);
      showToast("success", `Producto "${nombre.trim()}" actualizado.`);
      onClose();
    } catch (err) {
      setError("No se pudo guardar el cambio: " + (err && err.message ? err.message : String(err)));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h3 className="font-semibold text-stone-800">Editar producto</h3>
          <button onClick={onClose} className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de inventario</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`py-2 rounded text-sm font-medium border transition ${tipo === t ? "" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"}`}
                  style={tipo === t ? { backgroundColor: "#EE0000", borderColor: "#EE0000", color: "#ffffff" } : undefined}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Código <span className="text-red-600">*</span></label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Categoría <span className="text-red-600">*</span></label>
              <input value={categoria} onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nombre del producto <span className="text-red-600">*</span></label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Descripción (opcional)</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Talla/variante</label>
              <input value={talla} onChange={(e) => setTalla(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Unidad</label>
              <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="unidades">unidades</option>
                <option value="metros">metros</option>
                <option value="conos">conos</option>
                <option value="kg">kg</option>
                <option value="pares">pares</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Stock</label>
              <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Stock mínimo (opcional)</label>
            <input type="number" min="0" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)}
              placeholder="Dejar vacío si aún no se define"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {confirmarBorrar && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-red-700 font-medium">
                ¿Seguro que quieres eliminar "{producto.producto}" ({producto.talla})? Esto no borra sus ventas o movimientos pasados, solo el producto del catálogo.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmarBorrar(false)} className="flex-1 py-1.5 rounded border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-white">
                  No, cancelar
                </button>
                <button onClick={handleEliminar} disabled={guardando} className="flex-1 py-1.5 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60">
                  {guardando ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-stone-200">
          {!confirmarBorrar && (
            <button onClick={() => setConfirmarBorrar(true)} title="Eliminar este producto"
              className="p-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 size={17} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-stone-300 text-sm font-semibold text-stone-700 hover:bg-stone-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectorProducto({ productos, value, onChange, placeholder = "Busca por nombre, código o categoría..." }) {
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);
  const seleccionado = productos.find((p) => p.id === value);

  const filtrados = query.trim() === ""
    ? productos
    : productos.filter((p) => {
        const t = query.toLowerCase();
        return (
          p.producto.toLowerCase().includes(t) ||
          p.codigo.toLowerCase().includes(t) ||
          p.categoria.toLowerCase().includes(t) ||
          p.talla.toLowerCase().includes(t)
        );
      });

  function elegir(p) {
    onChange(p.id);
    setQuery("");
    setAbierto(false);
  }

  return (
    <div className="relative">
      {seleccionado && !abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white text-left"
        >
          <span className="truncate">
            <span className="text-stone-400 font-mono text-xs mr-1.5">{seleccionado.codigo}</span>
            {seleccionado.producto}{seleccionado.talla !== "Única" ? ` - ${seleccionado.talla}` : ""}
            <span className="text-stone-400"> · stock: {seleccionado.stock}</span>
          </span>
          <Edit3 size={13} className="text-stone-400 shrink-0 ml-2" />
        </button>
      ) : (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            autoFocus={abierto}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setAbierto(true)}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      )}

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white rounded-lg border border-stone-200 shadow-lg">
            {filtrados.length === 0 && (
              <p className="px-3 py-3 text-sm text-stone-400">No se encontraron productos.</p>
            )}
            {filtrados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => elegir(p)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-50 border-b border-stone-50 last:border-0 ${
                  p.id === value ? "bg-red-50" : ""
                }`}
              >
                <span className="text-stone-400 font-mono text-xs mr-1.5">{p.codigo}</span>
                <span className="text-stone-800">{p.producto}{p.talla !== "Única" ? ` - ${p.talla}` : ""}</span>
                <span className="text-stone-400"> · {p.categoria} · stock: {p.stock}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Ventas({ productos, movimientos, ventas, onSave, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(todayStr());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [efectivo, setEfectivo] = useState("");
  const [yape, setYape] = useState("");
  const [tarjeta, setTarjeta] = useState("");
  const [error, setError] = useState("");

  const producto = productos.find((p) => p.id === productoId);
  const cant = Number(cantidad) || 0;
  const prec = Number(precio) || 0;
  const totalCalc = round2(cant * prec);
  const pagoSum = round2((Number(efectivo) || 0) + (Number(yape) || 0) + (Number(tarjeta) || 0));
  const pagoDescuadrado = (efectivo !== "" || yape !== "" || tarjeta !== "") && totalCalc > 0 && pagoSum !== totalCalc;

  function reset() {
    setProductoId(""); setCantidad(""); setDescripcion(""); setPrecio("");
    setEfectivo(""); setYape(""); setTarjeta(""); setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!productoId) return setError("Selecciona un producto.");
    if (!cantidad || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (!precio || prec < 0) return setError("Ingresa un precio válido.");
    if (producto.stock < cant) return setError(`Stock insuficiente. Solo hay ${producto.stock} ${producto.unidad}.`);

    const newProductos = productos.map((p) => (p.id === productoId ? { ...p, stock: p.stock - cant } : p));
    const venta = {
      id: `V${Date.now()}`,
      fecha, idProducto: producto.codigo, producto: producto.producto,
      cantidad: cant, talla: producto.talla, descripcion: descripcion || producto.descripcion || "",
      precio: prec, efectivo: Number(efectivo) || 0, yape: Number(yape) || 0, tarjeta: Number(tarjeta) || 0, total: totalCalc,
      costoUnitario: producto.costoUnitario != null ? producto.costoUnitario : null,
    };
    const mov = {
      id: `M${Date.now()}`, fecha, tipo: "VENTA", productoId,
      productoNombre: `${producto.producto}${producto.talla !== "Única" ? " - " + producto.talla : ""}`,
      cantidad: cant, motivo: "Venta",
    };
    await onSave(newProductos, [...movimientos, mov], [...ventas, venta]);
    showToast("success", "Venta registrada. Stock actualizado.");
    reset();
    setShowForm(false);
  }

  const porDia = useMemo(() => {
    const groups = {};
    for (const v of ventas) {
      if (!groups[v.fecha]) groups[v.fecha] = [];
      groups[v.fecha].push(v);
    }
    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [ventas]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700">Registro de ventas</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-1.5"
        >
          <Plus size={15} /> Registrar venta
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 shadow-sm p-4 space-y-3">
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
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad</label>
                  <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="1"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Producto (ID · talla)</label>
                <SelectorProducto productos={productos} value={productoId} onChange={setProductoId} />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Descripción (opcional)</label>
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Color, detalle específico de esta venta"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Precio unitario (S/)</label>
                  <input type="number" min="0" step="0.5" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Efectivo (S/)</label>
                  <input type="number" min="0" step="0.5" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Yape (S/)</label>
                  <input type="number" min="0" step="0.5" value={yape} onChange={(e) => setYape(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Tarjeta (S/)</label>
                  <input type="number" min="0" step="0.5" value={tarjeta} onChange={(e) => setTarjeta(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>

              <div className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-sm text-stone-600">Total (cantidad × precio)</span>
                <span className="text-lg font-semibold text-stone-900">{formatSoles(totalCalc)}</span>
              </div>

              {pagoDescuadrado && (
                <p className="text-sm text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Efectivo + Yape + Tarjeta ({formatSoles(pagoSum)}) no coincide con el total ({formatSoles(totalCalc)}). Revisa antes de guardar.
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <XCircle size={14} /> {error}
                </p>
              )}

              <button type="button" onClick={handleSubmit} className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">
                Guardar venta
              </button>
            </>
          )}
        </form>
      )}

      {ventas.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Todavía no hay ventas registradas" body="Cada venta que registres aquí descuenta el stock automáticamente." />
      ) : (
        <div className="space-y-4">
          {porDia.map(([fecha, items]) => {
            const totalDia = round2(items.reduce((s, v) => s + v.total, 0));
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
                        <th className="text-left px-3 py-1.5 font-medium">ID producto</th>
                        <th className="text-left px-3 py-1.5 font-medium">Producto</th>
                        <th className="text-left px-3 py-1.5 font-medium">Talla</th>
                        <th className="text-left px-3 py-1.5 font-medium">Descripción</th>
                        <th className="text-right px-3 py-1.5 font-medium">Cant.</th>
                        <th className="text-right px-3 py-1.5 font-medium">Precio</th>
                        <th className="text-right px-3 py-1.5 font-medium">Efectivo</th>
                        <th className="text-right px-3 py-1.5 font-medium">Yape</th>
                        <th className="text-right px-3 py-1.5 font-medium">Tarjeta</th>
                        <th className="text-right px-3 py-1.5 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((v) => (
                        <tr key={v.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                          <td className="px-3 py-1.5 text-stone-500 font-mono text-xs">{v.idProducto}</td>
                          <td className="px-3 py-1.5 text-stone-800">{v.producto}</td>
                          <td className="px-3 py-1.5 text-stone-500">{v.talla}</td>
                          <td className="px-3 py-1.5 text-stone-500">{v.descripcion}</td>
                          <td className="px-3 py-1.5 text-right text-stone-700">{v.cantidad}</td>
                          <td className="px-3 py-1.5 text-right text-stone-700">{formatSoles(v.precio)}</td>
                          <td className="px-3 py-1.5 text-right text-stone-500">{v.efectivo ? formatSoles(v.efectivo) : "-"}</td>
                          <td className="px-3 py-1.5 text-right text-stone-500">{v.yape ? formatSoles(v.yape) : "-"}</td>
                          <td className="px-3 py-1.5 text-right text-stone-500">{v.tarjeta ? formatSoles(v.tarjeta) : "-"}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-stone-900">{formatSoles(v.total)}</td>
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
    </div>
  );
}

function Movimientos({ productos, movimientos, onSave, showToast }) {
  const [tipo, setTipo] = useState("ENTRADA");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(todayStr());
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  const producto = productos.find((p) => p.id === productoId);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!productoId) return setError("Selecciona un producto.");
    const cant = Number(cantidad);
    if (!cantidad || isNaN(cant) || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (tipo === "SALIDA" && producto.stock < cant) return setError(`Stock insuficiente. Solo hay ${producto.stock} ${producto.unidad}.`);

    const delta = tipo === "ENTRADA" ? cant : -cant;
    const newProductos = productos.map((p) => (p.id === productoId ? { ...p, stock: p.stock + delta } : p));
    const mov = {
      id: `M${Date.now()}`, fecha, tipo, productoId,
      productoNombre: `${producto.producto}${producto.talla !== "Única" ? " - " + producto.talla : ""}`,
      cantidad: cant, motivo,
    };
    await onSave(newProductos, [...movimientos, mov]);
    showToast("success", `${tipo === "ENTRADA" ? "Entrada" : "Salida"} registrada. Stock actualizado.`);
    setCantidad(""); setMotivo(""); setError("");
  }

  if (productos.length === 0) {
    return <EmptyState icon={ArrowLeftRight} title="No hay productos todavía" body="Registra al menos un producto antes de poder anotar entradas o salidas." />;
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de movimiento</label>
          <div className="grid grid-cols-2 gap-2">
            {["ENTRADA", "SALIDA"].map((t) => (
              <button type="button" key={t} onClick={() => setTipo(t)}
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
          <label className="block text-xs font-medium text-stone-600 mb-1">Motivo (opcional)</label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: ajuste por conteo, transferencia, producto dañado"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>

        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <XCircle size={14} /> {error}
          </p>
        )}

        <button type="button" onClick={handleSubmit} className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2">
          <Plus size={16} /> Registrar movimiento
        </button>
      </form>
    </div>
  );
}

function Compras({ productos, movimientos, compras, onSave, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(todayStr());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const producto = productos.find((p) => p.id === productoId);
  const cant = Number(cantidad) || 0;
  const costo = Number(costoUnitario) || 0;
  const totalCalc = round2(cant * costo);

  function reset() {
    setProductoId(""); setCantidad(""); setCostoUnitario(""); setProveedor(""); setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;
    if (!productoId) return setError("Selecciona un producto.");
    if (!cantidad || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (costoUnitario === "" || costo < 0) return setError("Ingresa un costo unitario válido.");
    if (!proveedor.trim()) return setError("Ingresa el nombre del proveedor.");

    // Costo promedio ponderado: si ya había stock con un costo conocido,
    // se pondera contra lo nuevo. Si no había costo previo, se usa el de esta compra.
    const stockAnterior = producto.stock;
    const costoAnterior = producto.costoUnitario;
    const nuevoCosto = costoAnterior != null && stockAnterior > 0
      ? round2((stockAnterior * costoAnterior + cant * costo) / (stockAnterior + cant))
      : costo;

    const newProductos = productos.map((p) =>
      p.id === productoId ? { ...p, stock: p.stock + cant, costoUnitario: nuevoCosto } : p
    );

    const compra = {
      id: `C${Date.now()}`,
      fecha, productoId, codigo: producto.codigo, producto: producto.producto, talla: producto.talla,
      tipo: producto.tipo, cantidad: cant, costoUnitario: costo, proveedor: proveedor.trim(), total: totalCalc,
    };
    const mov = {
      id: `M${Date.now()}`, fecha, tipo: "ENTRADA", productoId,
      productoNombre: `${producto.producto}${producto.talla !== "Única" ? " - " + producto.talla : ""}`,
      cantidad: cant, motivo: `Compra a ${proveedor.trim()}`,
    };

    try {
      setEnviando(true);
      await onSave(newProductos, [...movimientos, mov], undefined, [...compras, compra]);
      showToast("success", `Compra registrada. Costo actualizado a ${formatSoles(nuevoCosto)}.`);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700">Registro de compras</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-1.5"
        >
          <Plus size={15} /> Registrar compra
        </button>
      </div>

      {showForm && (
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
    </div>
  );
}

function Produccion({ productos, movimientos, compras, producciones, onSave, showToast }) {
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

    const stockAnterior = terminado.stock;
    const costoAnterior = terminado.costoUnitario;
    const nuevoCosto = costoAnterior != null && stockAnterior > 0
      ? round2((stockAnterior * costoAnterior + cant * costoUnitarioResultante) / (stockAnterior + cant))
      : costoUnitarioResultante;

    let newProductos = productos.map((p) => {
      if (p.id === terminadoId) return { ...p, stock: p.stock + cant, costoUnitario: nuevoCosto };
      const consumido = consumo.find((c) => c.materiaPrimaId === p.id);
      if (consumido) return { ...p, stock: round2(p.stock - consumido.necesario) };
      return p;
    });

    const nuevosMovimientos = [
      ...movimientos,
      ...consumo.map((c) => ({
        id: `M${Date.now()}-${c.materiaPrimaId}`, fecha, tipo: "SALIDA", productoId: c.materiaPrimaId,
        productoNombre: `${c.materiaPrima.producto}${c.materiaPrima.talla !== "Única" ? " - " + c.materiaPrima.talla : ""}`,
        cantidad: c.necesario, motivo: `Consumo para producción de ${terminado.producto}`,
      })),
      {
        id: `M${Date.now()}-prod`, fecha, tipo: "ENTRADA", productoId: terminadoId,
        productoNombre: `${terminado.producto}${terminado.talla !== "Única" ? " - " + terminado.talla : ""}`,
        cantidad: cant, motivo: "Producción",
      },
    ];

    const produccion = {
      id: `P${Date.now()}`, fecha, productoId: terminadoId, codigo: terminado.codigo,
      producto: terminado.producto, talla: terminado.talla, cantidad: cant,
      costoUnitario: costoUnitarioResultante, total: costoTotalCalc,
      insumos: consumo.map((c) => ({ materiaPrimaId: c.materiaPrimaId, cantidad: c.necesario, costoUnitario: c.costoUnitarioMP })),
    };

    try {
      setEnviando(true);
      await onSave(newProductos, nuevosMovimientos, undefined, undefined, [...producciones, produccion]);
      showToast("success", `Producción registrada. Costo actualizado a ${formatSoles(nuevoCosto)}.`);
      setTerminadoId(""); setCantidad(""); setError("");
    } catch (err) {
      setError("No se pudo guardar la producción: " + (err && err.message ? err.message : String(err)));
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

function NuevoProducto({ productos, movimientos, onSave, showToast, setView }) {
  const [tipo, setTipo] = useState("Materia prima");
  const [codigo, setCodigo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [producto, setProducto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [talla, setTalla] = useState("Única");
  const [unidad, setUnidad] = useState("unidades");
  const [stockInicial, setStockInicial] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [error, setError] = useState("");
  const [camposFaltantes, setCamposFaltantes] = useState([]);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;

    const faltantes = [];
    if (!codigo.trim()) faltantes.push("codigo");
    if (!categoria.trim()) faltantes.push("categoria");
    if (!producto.trim()) faltantes.push("producto");
    if (faltantes.length > 0) {
      const msg = "Falta completar: " + faltantes.map((f) => ({ codigo: "Código", categoria: "Categoría", producto: "Nombre del producto" }[f])).join(", ") + ".";
      setCamposFaltantes(faltantes);
      setError(msg);
      return;
    }
    setCamposFaltantes([]);

    const id = `${codigo.trim()}-${talla.trim() || "Única"}`;
    if (productos.some((p) => p.id === id)) {
      const msg = `Ya existe un producto con código "${codigo.trim()}" y talla/variante "${talla.trim() || "Única"}". Cambia el código o la talla.`;
      setError(msg);
      return;
    }
    const si = stockInicial.trim() === "" ? 0 : Number(stockInicial);
    if (isNaN(si) || si < 0) {
      return setError("El stock inicial debe ser un número válido, 0 o mayor.");
    }
    const sm = stockMinimo.trim() === "" ? null : Number(stockMinimo);
    if (stockMinimo.trim() !== "" && (isNaN(sm) || sm < 0)) {
      return setError("El stock mínimo debe ser un número válido.");
    }

    const nuevo = {
      id, codigo: codigo.trim(), categoria: categoria.trim(), producto: producto.trim(),
      descripcion: descripcion.trim(), talla: talla.trim() || "Única", unidad,
      stock: si, stockMinimo: sm, tipo,
    };
    try {
      setEnviando(true);
      await onSave([...productos, nuevo], movimientos);
      showToast("success", `Producto "${producto}" agregado a ${tipo}.`);
      setCodigo(""); setCategoria(""); setProducto(""); setDescripcion("");
      setTalla("Única"); setStockInicial(""); setStockMinimo(""); setError("");
      setView("productos");
    } catch (err) {
      const msg = "No se pudo guardar el producto: " + (err && err.message ? err.message : String(err));
      setError(msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de inventario</label>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map((t) => (
              <button type="button" key={t} onClick={() => setTipo(t)}
                style={tipo === t ? { backgroundColor: "#EE0000", borderColor: "#EE0000", color: "#ffffff" } : undefined}
                className={`py-2 rounded text-sm font-medium border transition ${
                  tipo === t ? "" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Código <span className="text-red-600">*</span></label>
            <input value={codigo} onChange={(e) => { setCodigo(e.target.value); if (camposFaltantes.includes("codigo")) setCamposFaltantes(camposFaltantes.filter((f) => f !== "codigo")); }} placeholder="Ej: MP001"
              className={`w-full px-3 py-2 rounded-lg border text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 ${camposFaltantes.includes("codigo") ? "border-red-600" : "border-stone-300"}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Categoría <span className="text-red-600">*</span></label>
            <input value={categoria} onChange={(e) => { setCategoria(e.target.value); if (camposFaltantes.includes("categoria")) setCamposFaltantes(camposFaltantes.filter((f) => f !== "categoria")); }} placeholder="Ej: Telas"
              className={`w-full px-3 py-2 rounded-lg border text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 ${camposFaltantes.includes("categoria") ? "border-red-600" : "border-stone-300"}`} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Nombre del producto <span className="text-red-600">*</span></label>
          <input value={producto} onChange={(e) => { setProducto(e.target.value); if (camposFaltantes.includes("producto")) setCamposFaltantes(camposFaltantes.filter((f) => f !== "producto")); }} placeholder="Ej: Tela drill naranja"
            className={`w-full px-3 py-2 rounded-lg border text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 ${camposFaltantes.includes("producto") ? "border-red-600" : "border-stone-300"}`} />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Descripción (opcional)</label>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Color, modelo, detalle"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Talla/variante</label>
            <input value={talla} onChange={(e) => setTalla(e.target.value)} placeholder="Única"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Unidad</label>
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="unidades">unidades</option>
              <option value="metros">metros</option>
              <option value="kg">kg</option>
              <option value="rollos">rollos</option>
              <option value="pares">pares</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Stock inicial</label>
            <input type="number" min="0" value={stockInicial} onChange={(e) => setStockInicial(e.target.value)} placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Stock mínimo (opcional)</label>
          <input type="number" min="0" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} placeholder="Dejar vacío si aún no se define"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>

        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <XCircle size={14} /> {error}
          </p>
        )}

        <button type="button" onClick={handleSubmit} disabled={enviando} className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition flex items-center justify-center gap-2">
          <PackagePlus size={16} /> {enviando ? "Agregando..." : "Agregar producto"}
        </button>
      </form>
    </div>
  );
}

function Toast({ type, msg }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${type === "success" ? "bg-stone-900 text-white" : "bg-red-600 text-white"}`}>
        {type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
        {msg}
      </div>
    </div>
  );
}

export default function SumajIllariAppRoot() {
  return (
    <ErrorBoundary>
      <AuthGate>
        {({ rol, cerrarSesion }) => <SumajIllariApp rol={rol} cerrarSesion={cerrarSesion} />}
      </AuthGate>
    </ErrorBoundary>
  );
}
