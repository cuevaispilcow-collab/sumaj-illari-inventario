import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import AuthGate from "./AuthGate.jsx";
import { escucharColeccion, guardarColeccion, operarInventarioSeguro } from "./firestoreSync.js";
import { puedeVer, vistaInicial } from "./roles.js";
import { UBICACIONES } from "./utils/constants.js";
import { todayStr } from "./utils/format.js";
import Sidebar from "./components/Sidebar.jsx";
import ConfirmModal from "./components/ConfirmModal.jsx";
import Toast from "./components/Toast.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Productos from "./pages/Productos.jsx";
import Ventas from "./pages/Ventas.jsx";
import Demanda from "./pages/Demanda.jsx";
import Analisis from "./pages/Analisis.jsx";
import Margenes from "./pages/Margenes.jsx";
import Movimientos from "./pages/Movimientos.jsx";
import Compras from "./pages/Compras.jsx";
import Produccion from "./pages/Produccion.jsx";
import Auditoria from "./pages/Auditoria.jsx";
import NuevoProducto from "./pages/NuevoProducto.jsx";

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


function SumajIllariApp({ rol, nombre, ubicacion, cerrarSesion }) {
  const [productos, setProductos] = useState(null);
  const [modelos, setModelos] = useState(null);
  const [inventarios, setInventarios] = useState(null);
  const [movimientos, setMovimientos] = useState(null);
  const [ventas, setVentas] = useState(null);
  const [compras, setCompras] = useState(null);
  const [producciones, setProducciones] = useState(null);
  const [pedidos, setPedidos] = useState(null);
  const [auditoria, setAuditoria] = useState(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState(vistaInicial(rol));
  const [toast, setToast] = useState(null);

  // Quién es HOY la persona detrás de esta cuenta compartida. Se
  // pregunta UNA SOLA VEZ POR CELULAR (no cada vez que se recarga la
  // página) — porque la misma cuenta puede usarla distintas personas
  // según el turno (ej. alguien cubre el día libre de otra vendedora).
  // Si ya hay un nombre guardado en este celular, se usa directo, sin
  // molestar a nadie; solo se vuelve a preguntar si esa persona lo
  // cambia a propósito (botón "Cambiar" en el menú lateral).
  const [nombreSesion, setNombreSesion] = useState(() => {
    try {
      return localStorage.getItem("sumajIllariNombreSesion") || null;
    } catch (e) {
      return null;
    }
  });
  const [pidiendoNombre, setPidiendoNombre] = useState(nombreSesion === null);

  function confirmarNombreSesion(valor) {
    const limpio = (valor || "").trim() || nombre || "Sin nombre";
    setNombreSesion(limpio);
    setPidiendoNombre(false);
    try { localStorage.setItem("sumajIllariNombreSesion", limpio); } catch (e) {}
  }
  const [confirmReset, setConfirmReset] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");

  // Escucha en tiempo real: cuando CUALQUIER dispositivo (celular de una
  // vendedora, computadora de la gerente, etc.) guarda un cambio, todos
  // los demás lo reciben automáticamente aquí, sin recargar la página.
  useEffect(() => {
    let cargados = { productos: false, modelos: false, inventarios: false, movimientos: false, ventas: false, compras: false, producciones: false, pedidos: false };
    const marcarListo = () => {
      if (cargados.productos && cargados.modelos && cargados.inventarios && cargados.movimientos && cargados.ventas && cargados.compras && cargados.producciones && cargados.pedidos) setReady(true);
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
    const unsubModelos = escucharColeccion("modelos", (items) => {
      setModelos(items);
      cargados.modelos = true;
      marcarListo();
    }, manejarError);
    // Stock y costo, ahora por ubicación (SUMAJ ILLARI, JL Planta, Tienda X)
    // en vez de un solo número global por producto.
    const unsubInventarios = escucharColeccion("inventarios", (items) => {
      setInventarios(items);
      cargados.inventarios = true;
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
    const unsub6 = escucharColeccion("pedidos", (items) => {
      setPedidos(items);
      cargados.pedidos = true;
      marcarListo();
    }, manejarError);
    // La auditoría no bloquea que la app esté "lista" — es información
    // de supervisión, no algo que se necesite para operar el día a día.
    const unsubAuditoria = escucharColeccion("auditoria", (items) => {
      setAuditoria(items);
    }, () => {});
    return () => { unsub1(); unsubModelos(); unsubInventarios(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsubAuditoria(); };
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

  function persist(newProductos, newMovimientos, newVentas, newCompras, newProducciones, newPedidos) {
    // 1) Actualiza la pantalla al instante, sin esperar nada.
    setProductos(newProductos);
    setMovimientos(newMovimientos);
    if (newVentas !== undefined) setVentas(newVentas);
    if (newCompras !== undefined) setCompras(newCompras);
    if (newProducciones !== undefined) setProducciones(newProducciones);
    if (newPedidos !== undefined) setPedidos(newPedidos);

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
        if (newPedidos !== undefined) {
          await withTimeout(guardarColeccion("pedidos", newPedidos), 8000);
        }
      } catch (e) {
        showToast("error", "Se guardó en pantalla, pero el respaldo tardó demasiado. Usa \"Exportar Excel\" para no perder datos.");
      }
    })();

    return Promise.resolve();
  }

  // Guarda los "Modelos" (nombre, categoría, tipo, descripción, unidad —
  // lo que comparten todas las tallas de un mismo código). Aparte de
  // persist() porque ningún flujo de stock (Ventas, Compras, Movimientos,
  // Producción) necesita tocar esto — solo Productos y Nuevo producto.
  function persistModelos(newModelos) {
    setModelos(newModelos);
    (async () => {
      try {
        await guardarColeccion("modelos", newModelos);
      } catch (e) {
        showToast("error", "Se guardó en pantalla, pero el respaldo del modelo tardó demasiado.");
      }
    })();
    return Promise.resolve();
  }

  function persistInventarios(newInventarios) {
    setInventarios(newInventarios);
    (async () => {
      try {
        await guardarColeccion("inventarios", newInventarios);
      } catch (e) {
        showToast("error", "Se guardó en pantalla, pero el respaldo del inventario tardó demasiado.");
      }
    })();
    return Promise.resolve();
  }

  // Lo que ve cada pantalla: cada talla (producto) "completa" con los
  // datos de su modelo (nombre, categoría, tipo...) y con el stock/costo
  // de la UBICACIÓN de quien está usando la app en ese momento — no un
  // solo stock global. Si un producto todavía no tiene un registro de
  // inventario para esta ubicación (ej. porque se creó antes de separar
  // por ubicación), se usa su stock antiguo como el de "sumaj_illari" —
  // así no se pierde nada de lo que ya existía.
  const productosCompletos = React.useMemo(() => {
    if (!productos || !inventarios) return productos;
    const modelosPorCodigo = Object.fromEntries((modelos || []).map((m) => [m.codigo, m]));
    const inventariosPorClave = Object.fromEntries(inventarios.map((i) => [i.id, i]));
    return productos.map((p) => {
      const clave = `${p.id}__${ubicacion}`;
      const inv = inventariosPorClave[clave];
      const datosInventario = inv
        ? { stock: inv.stock, stockMinimo: inv.stockMinimo, costoUnitario: inv.costoUnitario, fechaIncorporacion: inv.fechaIncorporacion, precioMinimo: inv.precioMinimo != null ? inv.precioMinimo : p.precioMinimo }
        : ubicacion === "sumaj_illari"
          ? { stock: p.stock, stockMinimo: p.stockMinimo, costoUnitario: p.costoUnitario, fechaIncorporacion: p.fechaIncorporacion }
          : { stock: 0, stockMinimo: null, costoUnitario: null, fechaIncorporacion: null };
      return { ...(modelosPorCodigo[p.codigo] || {}), ...p, ...datosInventario };
    });
  }, [productos, modelos, inventarios, ubicacion]);

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function resetAll() {
    await persist([], [], [], [], [], []);
    await persistModelos([]);
    setConfirmReset(false);
    showToast("success", "Todo se reinició. Catálogo, movimientos, ventas, compras, producción y pedidos en cero.");
  }

  function exportarExcel() {
    if (productos.length === 0 && ventas.length === 0 && movimientos.length === 0 && compras.length === 0 && producciones.length === 0 && (pedidos || []).length === 0) {
      showToast("error", "No hay nada que exportar todavía.");
      return;
    }
    const wb = XLSX.utils.book_new();

    const wsProductos = XLSX.utils.json_to_sheet(
      productosCompletos.map((p) => ({
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

    const wsPedidos = XLSX.utils.json_to_sheet(
      (pedidos || []).map((pe) => ({
        Fecha_tomado: pe.fecha, Cliente: pe.cliente, Codigo: pe.codigo, Producto: pe.producto,
        Cantidad: pe.cantidad, Etapa: pe.etapa, Fecha_entrega: pe.fechaEntrega,
        Precio_cotizado: pe.precioCotizado, Costo_produccion: pe.costoProduccion, Margen: pe.margen,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsPedidos, "Pedidos");

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
  const vistaSegura = puedeVer(rol, view, ubicacion) ? view : vistaInicial(rol);
  const vistaOscura = ["dashboard", "analisis", "demanda", "margenes"].includes(vistaSegura);

  if (pidiendoNombre) {
    return <ConfirmarNombreSesion sugerencia={nombreSesion || nombre} onConfirmar={confirmarNombreSesion} cerrarSesion={cerrarSesion} />;
  }

  return (
    <div className="min-h-screen bg-stone-100 lg:flex">
      <Sidebar view={vistaSegura} setView={setView} onResetClick={() => setConfirmReset(true)} onExportClick={exportarExcel} rol={rol} ubicacion={ubicacion} cerrarSesion={cerrarSesion} nombreSesion={nombreSesion} onCambiarNombre={() => setPidiendoNombre(true)} />
      <main className={`flex-1 min-w-0 ${vistaOscura ? "bg-stone-950" : ""}`}>
        <div className="max-w-6xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
          {vistaSegura === "dashboard" && <Dashboard productos={productosCompletos} movimientos={movimientos} ventas={ventas} setView={setView} />}
          {vistaSegura === "productos" && (
            <Productos productos={productosCompletos} variantes={productos} modelos={modelos} onSaveModelos={persistModelos} inventarios={inventarios} onSaveInventarios={persistInventarios} ubicacion={ubicacion} movimientos={movimientos} ventas={ventas} onSave={persist} showToast={showToast} setView={setView} rol={rol} nombre={nombreSesion} />
          )}
          {vistaSegura === "ventas" && (
            <Ventas productos={productosCompletos} movimientos={movimientos} ventas={ventas} onSave={persist} onSaveInventarios={persistInventarios} showToast={showToast} nombre={nombreSesion} rol={rol} ubicacion={ubicacion} />
          )}
          {vistaSegura === "demanda" && <Demanda ventas={ventas} productos={productosCompletos} />}
          {vistaSegura === "analisis" && <Analisis productos={productosCompletos} movimientos={movimientos} ventas={ventas} />}
          {vistaSegura === "margenes" && <Margenes productos={productosCompletos} ventas={ventas} />}
          {vistaSegura === "movimientos" && (
            <Movimientos productos={productosCompletos} movimientos={movimientos} onSave={persist} onSaveInventarios={persistInventarios} showToast={showToast} nombre={nombreSesion} rol={rol} ubicacion={ubicacion} />
          )}
          {vistaSegura === "compras" && (
            <Compras productos={productosCompletos} movimientos={movimientos} compras={compras} onSave={persist} onSaveInventarios={persistInventarios} showToast={showToast} nombre={nombreSesion} rol={rol} ubicacion={ubicacion} />
          )}
          {vistaSegura === "auditoria" && <Auditoria auditoria={auditoria} />}
          {vistaSegura === "produccion" && (
            <Produccion productos={productosCompletos} variantes={productos} modelos={modelos} onSaveModelos={persistModelos} onSaveInventarios={persistInventarios} movimientos={movimientos} ventas={ventas} compras={compras} producciones={producciones} pedidos={pedidos} onSave={persist} showToast={showToast} rol={rol} nombre={nombreSesion} ubicacion={ubicacion} />
          )}
          {vistaSegura === "nuevo" && (
            <NuevoProducto productos={productos} modelos={modelos} onSaveModelos={persistModelos} onSaveInventarios={persistInventarios} inventarios={inventarios} movimientos={movimientos} onSave={persist} showToast={showToast} setView={setView} nombre={nombreSesion} rol={rol} ubicacion={ubicacion} />
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


function ConfirmarNombreSesion({ sugerencia, onConfirmar, cerrarSesion }) {
  const [valor, setValor] = useState(sugerencia || "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-6">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 max-w-sm w-full">
        <h2 className="font-semibold text-stone-800 mb-1">¿Quién eres hoy?</h2>
        <p className="text-sm text-stone-500 mb-4">
          Esta cuenta la puede usar más de una persona según el turno. Tu nombre queda registrado junto a lo que hagas hoy, para que quede claro quién hizo cada cosa.
        </p>
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirmar(valor)}
          placeholder="Tu nombre"
          className="w-full px-3 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
        />
        <button
          onClick={() => onConfirmar(valor)}
          className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
        >
          Continuar
        </button>
        <button onClick={cerrarSesion} className="w-full py-2 mt-2 text-xs text-stone-400 hover:text-stone-600">
          No soy yo — cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default function SumajIllariAppRoot() {
  return (
    <ErrorBoundary>
      <AuthGate>
        {({ rol, nombre, ubicacion, cerrarSesion }) => <SumajIllariApp rol={rol} nombre={nombre} ubicacion={ubicacion} cerrarSesion={cerrarSesion} />}
      </AuthGate>
    </ErrorBoundary>
  );
}

