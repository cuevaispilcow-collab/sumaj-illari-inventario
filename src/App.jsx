import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import AuthGate from "./AuthGate.jsx";
import { escucharColeccion, guardarColeccion, operarInventarioSeguro } from "./firestoreSync.js";
import { puedeVer, vistaInicial } from "./roles.js";
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


function SumajIllariApp({ rol, cerrarSesion }) {
  const [productos, setProductos] = useState(null);
  const [movimientos, setMovimientos] = useState(null);
  const [ventas, setVentas] = useState(null);
  const [compras, setCompras] = useState(null);
  const [producciones, setProducciones] = useState(null);
  const [pedidos, setPedidos] = useState(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState(vistaInicial(rol));
  const [toast, setToast] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");

  // Escucha en tiempo real: cuando CUALQUIER dispositivo (celular de una
  // vendedora, computadora de la gerente, etc.) guarda un cambio, todos
  // los demás lo reciben automáticamente aquí, sin recargar la página.
  useEffect(() => {
    let cargados = { productos: false, movimientos: false, ventas: false, compras: false, producciones: false, pedidos: false };
    const marcarListo = () => {
      if (cargados.productos && cargados.movimientos && cargados.ventas && cargados.compras && cargados.producciones && cargados.pedidos) setReady(true);
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
    const unsub6 = escucharColeccion("pedidos", (items) => {
      setPedidos(items);
      cargados.pedidos = true;
      marcarListo();
    }, manejarError);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
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

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function resetAll() {
    await persist([], [], [], [], [], []);
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
            <Produccion productos={productos} movimientos={movimientos} ventas={ventas} compras={compras} producciones={producciones} pedidos={pedidos} onSave={persist} showToast={showToast} rol={rol} />
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


export default function SumajIllariAppRoot() {
  return (
    <ErrorBoundary>
      <AuthGate>
        {({ rol, cerrarSesion }) => <SumajIllariApp rol={rol} cerrarSesion={cerrarSesion} />}
      </AuthGate>
    </ErrorBoundary>
  );
}

