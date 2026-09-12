import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import AuthGate from "./AuthGate.jsx";
import { escucharColeccion, guardarColeccion, operarInventarioSeguro } from "./firestoreSync.js";
import { puedeVer, vistaInicial } from "./roles.js";
import { UBICACIONES, temaDeSesion, sedesDeVista, nombreDeVista } from "./utils/constants.js";
import { todayStr, round2, filtrarPorUbicacion, filtrarTransferencias, filtrarSolicitudes } from "./utils/format.js";
import Sidebar from "./components/Sidebar.jsx";
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
import Transferencias from "./pages/Transferencias.jsx";
import Auditoria from "./pages/Auditoria.jsx";
import NuevoProducto from "./pages/NuevoProducto.jsx";

const NOMBRE_UBICACION = Object.fromEntries(UBICACIONES.map((u) => [u.id, u.nombre]));

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
              className="mt-3 px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 peligro"
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
  const [transferencias, setTransferencias] = useState(null);
  const [solicitudes, setSolicitudes] = useState(null);
  const [costos, setCostos] = useState(null);
  const [auditoria, setAuditoria] = useState(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState(vistaInicial(rol));
  const [toast, setToast] = useState(null);
  // Permite que una alerta del Dashboard mande directo a la pestaña
  // "Pedidos" dentro de Producción, en vez de siempre abrir en
  // "Producir". Se limpia sola apenas Producción la usa (ver
  // onTabInicialConsumido), para que no se quede forzando esa pestaña
  // si después alguien entra a Producción por el menú normal.
  const [produccionTabInicial, setProduccionTabInicial] = useState(null);
  function irAPedidos() {
    setProduccionTabInicial("pedidos");
    setView("produccion");
  }

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

  // Selector de ubicación (solo gerente): qué sede está mirando/operando
  // AHORA MISMO, distinto de la ubicación fija de su cuenta. Arranca en
  // "todas" (consolidado) porque es lo que la gerente necesita al
  // entrar — el panorama de las 2 empresas juntas. Una vendedora nunca
  // ve el selector, así que para ella "lo que mira" siempre es la
  // ubicación de su cuenta, sin excepción.
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState("todas");
  const ubicacionVista = rol === "gerente" ? ubicacionSeleccionada : ubicacion;
  // En modo consolidado — que ahora incluye tanto "Todas" como "ver una
  // empresa completa" (ej. JL con sus 2 sedes) — no hay una sola sede a
  // la cual atribuir una venta/movimiento/compra/transferencia/
  // producción nueva. Por eso las pantallas que registran operaciones se
  // bloquean cuando esto es true (cada una lo explica con un aviso, en
  // vez de desaparecer del menú sin explicación). La regla es "más de
  // una sede real detrás de esta vista", no un texto fijo como "todas" —
  // así funciona igual para el consolidado y para cualquier vista de
  // empresa, hoy y si mañana Sumaj Illari abre una segunda sede.
  const esConsolidado = sedesDeVista(ubicacionVista).length > 1;
  // Nombre legible de lo que se está viendo ahora mismo, para los avisos
  // que explican por qué una pantalla está bloqueada — nunca dice "todas
  // las sedes" si en realidad se está viendo solo una empresa.
  const nombreVista = nombreDeVista(ubicacionVista);
  // Las sedes reales detrás de la vista actual, con su nombre — la usa
  // Compras para repartir una compra distribuida entre las sedes de la
  // vista activa (las 3 en consolidado, las de una sola empresa en vista
  // de empresa).
  const sedesVista = React.useMemo(
    () => sedesDeVista(ubicacionVista).map((id) => UBICACIONES.find((u) => u.id === id)),
    [ubicacionVista]
  );

  function confirmarNombreSesion(valor) {
    const limpio = (valor || "").trim() || nombre || "Sin nombre";
    setNombreSesion(limpio);
    setPidiendoNombre(false);
    try { localStorage.setItem("sumajIllariNombreSesion", limpio); } catch (e) {}
  }
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
    // Igual que la auditoría: las transferencias tampoco bloquean que la
    // app esté "lista". Registrar una transferencia no depende de tener
    // este historial ya cargado (la operación lee el inventario fresco
    // directo del servidor), así que si por algo esta colección tardara
    // o fallara, no tiene sentido dejar a todo el mundo esperando.
    const unsubTransferencias = escucharColeccion("transferencias", (items) => {
      setTransferencias(items);
    }, () => {});
    // Igual que transferencias: no bloquea el arranque de la app, y como
    // Firestore avisa en tiempo real, el badge de solicitudes pendientes
    // en el menú aparece solo, sin que nadie recargue la página.
    const unsubSolicitudes = escucharColeccion("solicitudes", (items) => {
      setSolicitudes(items);
    }, () => {});
    // La auditoría no bloquea que la app esté "lista" — es información
    // de supervisión, no algo que se necesite para operar el día a día.
    const unsubAuditoria = escucharColeccion("auditoria", (items) => {
      setAuditoria(items);
    }, () => {});
    return () => { unsub1(); unsubModelos(); unsubInventarios(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsubTransferencias(); unsubSolicitudes(); unsubAuditoria(); };
  }, []);

  // El costo unitario vive en su propia colección ("costos"), separada
  // de "inventarios" — ver la tarea de seguridad del costo unitario.
  // A PROPÓSITO esta colección nunca se pide si la cuenta no es
  // gerente: así, una vendedora nunca la recibe en su navegador, ni de
  // fondo ni de ninguna otra forma — la app simplemente no la pide. No
  // bloquea el arranque (igual que auditoría/transferencias/solicitudes).
  useEffect(() => {
    if (rol !== "gerente") return;
    const unsub = escucharColeccion("costos", (items) => {
      setCostos(items);
    }, () => {});
    return () => unsub();
  }, [rol]);

  // Red de seguridad: si algo falla en segundo plano (por ejemplo, el guardado),
  // que se vea como aviso en vez de quedarse la app "congelada" en silencio.
  useEffect(() => {
    function onRejection(e) {
      showToast("error", "Hubo un problema en segundo plano: " + (e.reason?.message || "intenta de nuevo."));
    }
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  // Identidad visual por empresa: se marca en <html> (no en un div de
  // más abajo) para que aplique a TODA la sesión, incluida la pantalla
  // de "¿Quién eres hoy?" que se muestra antes de llegar al menú
  // principal. Ver utils/constants.js → temaDeSesion() y index.css
  // para las reglas de color que reaccionan a este atributo.
  useEffect(() => {
    const tema = temaDeSesion(ubicacionVista);
    document.documentElement.setAttribute("data-tema", tema);
    return () => document.documentElement.removeAttribute("data-tema");
  }, [ubicacionVista]);

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

  // Mapas de búsqueda rápida por clave "varianteId__ubicacion" — se
  // recalculan solo cuando cambian inventarios/costos, no en cada
  // render. Los usan tanto productosCompletos como exportarExcel (que
  // necesita el detalle de las 3 sedes, no solo la que se está viendo).
  const inventariosPorClave = React.useMemo(
    () => Object.fromEntries((inventarios || []).map((i) => [i.id, i])),
    [inventarios]
  );
  // Para cualquier cuenta que no sea gerente, `costos` nunca se pidió
  // (ver el useEffect de arriba) y queda en null — costosPorClave queda
  // vacío y el costo siempre da null, sin filtrar nada.
  const costosPorClave = React.useMemo(
    () => Object.fromEntries((costos || []).map((c) => [c.id, c])),
    [costos]
  );

  // Cuánto stock/costo/stock mínimo tiene UN producto en UNA sede
  // puntual. Si un producto todavía no tiene un registro de inventario
  // para esa sede (ej. porque se creó antes de separar por ubicación),
  // se usa su stock antiguo como el de "sumaj_illari" — así no se
  // pierde nada de lo que ya existía.
  function datosEnUbicacion(p, ubic) {
    const inv = inventariosPorClave[`${p.id}__${ubic}`];
    const costoReg = costosPorClave[`${p.id}__${ubic}`];
    const costoUnitario = costoReg ? costoReg.costoUnitario : (ubic === "sumaj_illari" ? (p.costoUnitario ?? null) : null);
    if (inv) {
      return { stock: inv.stock || 0, stockMinimo: inv.stockMinimo, costoUnitario, fechaIncorporacion: inv.fechaIncorporacion, precioMinimo: inv.precioMinimo != null ? inv.precioMinimo : p.precioMinimo };
    }
    if (ubic === "sumaj_illari") {
      return { stock: p.stock || 0, stockMinimo: p.stockMinimo, costoUnitario, fechaIncorporacion: p.fechaIncorporacion, precioMinimo: p.precioMinimo };
    }
    return { stock: 0, stockMinimo: null, costoUnitario, fechaIncorporacion: null, precioMinimo: p.precioMinimo };
  }

  // Lo que ve cada pantalla: cada talla (producto) "completa" con los
  // datos de su modelo (nombre, categoría, tipo...) y con el stock/costo
  // de la ubicación que se está VIENDO ahora (ubicacionVista) — no un
  // solo stock global.
  //
  // En modo consolidado (solo gerente — "Todas" o una empresa completa)
  // no hay una sola ubicación: se SUMA el stock (y el stock mínimo) de
  // las sedes que cubre la vista, y el costo unitario se promedia
  // ponderado por cuánto stock aporta cada una — el mismo criterio que
  // ya usan Compras y Transferencias para combinar costos de distinto
  // origen.
  const productosCompletos = React.useMemo(() => {
    if (!productos || !inventarios) return productos;
    const modelosPorCodigo = Object.fromEntries((modelos || []).map((m) => [m.codigo, m]));

    return productos.map((p) => {
      let datosInventario;
      if (esConsolidado) {
        const porSede = sedesDeVista(ubicacionVista).map((id) => datosEnUbicacion(p, id));
        const stockTotal = round2(porSede.reduce((s, d) => s + (d.stock || 0), 0));
        const hayStockMinimo = porSede.some((d) => d.stockMinimo != null);
        const stockMinimoTotal = hayStockMinimo ? round2(porSede.reduce((s, d) => s + (d.stockMinimo || 0), 0)) : null;
        const sumaPonderada = porSede.reduce((s, d) => s + (d.costoUnitario != null ? d.costoUnitario * (d.stock || 0) : 0), 0);
        const costoUnitario = stockTotal > 0 ? round2(sumaPonderada / stockTotal) : null;
        datosInventario = { stock: stockTotal, stockMinimo: stockMinimoTotal, costoUnitario, fechaIncorporacion: null, precioMinimo: p.precioMinimo };
      } else {
        datosInventario = datosEnUbicacion(p, ubicacionVista);
      }
      return { ...(modelosPorCodigo[p.codigo] || {}), ...p, ...datosInventario };
    });
  }, [productos, modelos, inventariosPorClave, costosPorClave, ubicacionVista]);

  // Cuánto dinero hay inmovilizado en stock, por sede — de las sedes que
  // cubre la vista actual (las 3 en consolidado, o solo las de la
  // empresa que se está viendo). A propósito NO son siempre las 3: si la
  // gerente está viendo "JL (todas sus sedes)", el desglose debe mostrar
  // solo Planta y Tienda X — mostrar ahí la valorización de Sumaj Illari
  // sería mezclar datos de una empresa que no está mirando. El Dashboard
  // decide cuándo mostrar este desglose (ej. en consolidado o vista de
  // empresa).
  const valorizacionPorSede = React.useMemo(() => {
    if (!productos || !inventarios) return [];
    return sedesDeVista(ubicacionVista).map((id) => {
      const u = UBICACIONES.find((x) => x.id === id) || { id, nombre: id };
      const valor = productos.reduce((s, p) => {
        const d = datosEnUbicacion(p, id);
        return s + (d.costoUnitario != null ? (d.stock || 0) * d.costoUnitario : 0);
      }, 0);
      return { ubicacion: id, nombre: u.nombre, valor: round2(valor) };
    });
  }, [productos, inventariosPorClave, costosPorClave, ubicacionVista]);

  // Versiones de ventas, movimientos, compras y transferencias filtradas
  // por la ubicación que se está VIENDO — para que, por ejemplo, una
  // cuenta de Tienda X no vea ventas hechas en Sumaj Illari, y para que
  // la gerente vea solo la sede elegida (o todo junto, en consolidado —
  // filtrarPorUbicacion/filtrarTransferencias devuelven todo sin filtrar
  // cuando la ubicación es "todas"). OJO: estas versiones filtradas son
  // SOLO para mostrar en pantalla. Nunca se le pasan a una pantalla que
  // luego las vuelva a guardar completas, porque eso borraría los
  // registros de las otras ubicaciones al guardar. Por eso Producción
  // sigue recibiendo las colecciones completas — ahí el filtrado para
  // mostrar se hace adentro, con cuidado, porque esas pantallas sí guardan.
  const ventasUbicacion = React.useMemo(() => filtrarPorUbicacion(ventas, ubicacionVista), [ventas, ubicacionVista]);
  const movimientosUbicacion = React.useMemo(() => filtrarPorUbicacion(movimientos, ubicacionVista), [movimientos, ubicacionVista]);
  const comprasUbicacion = React.useMemo(() => filtrarPorUbicacion(compras, ubicacionVista), [compras, ubicacionVista]);
  const transferenciasUbicacion = React.useMemo(() => filtrarTransferencias(transferencias, ubicacionVista), [transferencias, ubicacionVista]);
  const solicitudesUbicacion = React.useMemo(() => filtrarSolicitudes(solicitudes, ubicacionVista), [solicitudes, ubicacionVista]);
  // Solicitudes que le llegaron a la sede/vista que se está viendo y
  // todavía nadie respondió — la misma lista alimenta el aviso rojo del
  // menú (solo el conteo) y el panel de alertas del Dashboard (el
  // detalle), para no calcular "qué está pendiente para mí" de dos
  // formas distintas en dos lugares.
  const solicitudesPendientesLista = React.useMemo(() => {
    const sedesVistaIds = new Set(sedesDeVista(ubicacionVista));
    return (solicitudes || [])
      .filter((s) => s.estado === "pendiente" && sedesVistaIds.has(s.proveedor))
      .map((s) => ({
        ...s,
        nombreSede: NOMBRE_UBICACION[s.proveedor] || NOMBRE_UBICACION.sumaj_illari,
        nombreSolicitante: NOMBRE_UBICACION[s.solicitante] || NOMBRE_UBICACION.sumaj_illari,
      }));
  }, [solicitudes, ubicacionVista]);
  const solicitudesPendientesParaMi = solicitudesPendientesLista.length;
  // Pedidos de la vista activa, para el panel de alertas (vencidos y
  // por vencer). Un pedido siempre pertenece a UNA sola sede real (no
  // hay pedidos "de todas"), así que alcanza con el mismo filtro simple
  // que ya usa Producción — no tiene el problema de "esconder" una sede
  // detrás de un total combinado, porque acá no se suma nada.
  const pedidosUbicacion = React.useMemo(
    () => filtrarPorUbicacion(pedidos, ubicacionVista).map((p) => ({ ...p, nombreSede: NOMBRE_UBICACION[p.ubicacion] || NOMBRE_UBICACION.sumaj_illari })),
    [pedidos, ubicacionVista]
  );
  // Alertas de stock (sin stock y bajo mínimo), sede por sede dentro de
  // la vista activa. A propósito NO se calculan sobre el total
  // combinado: en vista múltiple, una sede podría estar en cero (o por
  // debajo de su mínimo) mientras otra tiene de sobra, y el total
  // combinado se vería "bien" y escondería el problema real — por eso
  // se revisa cada sede por separado, y cada alerta indica de cuál es.
  const alertasStockPorSede = React.useMemo(() => {
    if (!productos || !inventarios) return { sinStock: [], bajoMinimo: [] };
    const modelosPorCodigo = Object.fromEntries((modelos || []).map((m) => [m.codigo, m]));
    const sinStock = [];
    const bajoMinimo = [];
    for (const p of productos) {
      for (const sedeId of sedesDeVista(ubicacionVista)) {
        // Un producto sin ningún registro de inventario en esta sede
        // (nunca llegó ahí por compra, transferencia o compra
        // distribuida) NO cuenta como "sin stock" — simplemente no es
        // parte del surtido de esa sede todavía, no es que se haya
        // acabado. Sumaj Illari es la excepción: los productos de antes
        // del multi-sede viven ahí sin un registro aparte (ver el
        // "fallback" de datosEnUbicacion), así que sí es una sede real
        // para este chequeo aunque no tenga un registro explícito.
        const tieneRegistro = sedeId === "sumaj_illari" || !!inventariosPorClave[`${p.id}__${sedeId}`];
        if (!tieneRegistro) continue;
        const d = datosEnUbicacion(p, sedeId);
        const info = modelosPorCodigo[p.codigo] || {};
        const entrada = {
          id: `${p.id}__${sedeId}`,
          nombre: `${info.producto || p.producto}${p.talla !== "Única" ? " - " + p.talla : ""}`,
          sede: sedeId, nombreSede: NOMBRE_UBICACION[sedeId] || NOMBRE_UBICACION.sumaj_illari,
        };
        if (d.stock === 0) {
          sinStock.push(entrada);
        } else if (d.stockMinimo != null && d.stock <= d.stockMinimo) {
          // Si ya está en cero, cae arriba en "sin stock" — no hace
          // falta que aparezca DE NUEVO acá como "bajo mínimo" para el
          // mismo problema real, eso duplicaría la alerta.
          bajoMinimo.push({ ...entrada, stock: d.stock, stockMinimo: d.stockMinimo });
        }
      }
    }
    return { sinStock, bajoMinimo };
  }, [productos, modelos, inventariosPorClave, costosPorClave, ubicacionVista]);
  const alertasSinStock = alertasStockPorSede.sinStock;
  const alertasBajoMinimo = alertasStockPorSede.bajoMinimo;
  // La auditoría no es una de las pantallas que pediste que siguieran el
  // selector explícitamente, pero como ahora cada registro SÍ guarda de
  // qué sede vino (ver los 7 archivos que llaman a registrarAuditoria),
  // tiene sentido que también respete el filtro — así la gerente puede
  // mirar la actividad de una sede puntual o de todas juntas.
  const auditoriaUbicacion = React.useMemo(() => filtrarPorUbicacion(auditoria, ubicacionVista), [auditoria, ubicacionVista]);

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function exportarExcel() {
    if (
      productos.length === 0 && ventas.length === 0 && movimientos.length === 0 && compras.length === 0 &&
      producciones.length === 0 && (pedidos || []).length === 0 && (transferencias || []).length === 0 && (solicitudes || []).length === 0
    ) {
      showToast("error", "No hay nada que exportar todavía.");
      return;
    }
    const wb = XLSX.utils.book_new();
    const sede = (id) => NOMBRE_UBICACION[id] || NOMBRE_UBICACION.sumaj_illari;

    // Exporta SIEMPRE las 3 sedes, cada fila identificada con su Sede —
    // sin importar qué estés mirando en el menú al momento de exportar.
    // Así se puede analizar cada empresa por separado (filtrando por
    // Sede en el propio Excel) y también el total (sumando todo).
    const modelosPorCodigo = Object.fromEntries((modelos || []).map((m) => [m.codigo, m]));
    const filasProductos = [];
    for (const p of productos) {
      const base = { ...(modelosPorCodigo[p.codigo] || {}), ...p };
      for (const u of UBICACIONES) {
        const d = datosEnUbicacion(p, u.id);
        filasProductos.push({
          Sede: u.nombre, ID_Producto: base.id, Codigo: base.codigo, Tipo: base.tipo, Categoria: base.categoria,
          Producto: base.producto, Descripcion: base.descripcion, Talla: base.talla, Unidad: base.unidad,
          Stock_Actual: d.stock, Stock_Minimo: d.stockMinimo ?? "", Costo_Unitario_Promedio: d.costoUnitario ?? "",
        });
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasProductos), "Productos");

    const wsVentas = XLSX.utils.json_to_sheet(
      ventas.map((v) => ({
        Sede: sede(v.ubicacion), FECHA: v.fecha, "ID-PRODUCTO": v.idProducto, PRODUCTO: v.producto, CANTIDAD: v.cantidad,
        TALLA: v.talla, DESCRIPCION: v.descripcion, PRECIO: v.precio, EFECTIVO: v.efectivo,
        YAPE: v.yape, TARJETA: v.tarjeta || 0, TOTAL: v.total,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");

    const wsMov = XLSX.utils.json_to_sheet(
      movimientos.map((m) => ({
        Sede: sede(m.ubicacion), Fecha: m.fecha, Tipo: m.tipo, Producto: m.productoNombre, Cantidad: m.cantidad, Motivo: m.motivo || "", Motivo_codigo: m.motivoCodigo || "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsMov, "Movimientos");

    const wsCompras = XLSX.utils.json_to_sheet(
      compras.map((c) => ({
        Sede: sede(c.ubicacion), Fecha: c.fecha, Codigo: c.codigo, Producto: c.producto, Talla: c.talla, Tipo: c.tipo,
        Cantidad: c.cantidad, Costo_Unitario: c.costoUnitario, Proveedor: c.proveedor, Total: c.total,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsCompras, "Compras");

    const wsProd = XLSX.utils.json_to_sheet(
      producciones.map((pr) => ({
        Sede: sede(pr.ubicacion), Fecha: pr.fecha, Codigo: pr.codigo, Producto: pr.producto, Talla: pr.talla,
        Cantidad_Producida: pr.cantidad, Costo_Unitario_Calculado: pr.costoUnitario, Costo_Total: pr.total,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsProd, "Produccion");

    const wsPedidos = XLSX.utils.json_to_sheet(
      (pedidos || []).map((pe) => ({
        Sede: sede(pe.ubicacion), Fecha_tomado: pe.fecha, Cliente: pe.cliente, Codigo: pe.codigo, Producto: pe.producto,
        Cantidad: pe.cantidad, Etapa: pe.etapa, Fecha_entrega: pe.fechaEntrega,
        Precio_cotizado: pe.precioCotizado, Costo_produccion: pe.costoProduccion, Margen: pe.margen,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsPedidos, "Pedidos");

    // Transferencias y solicitudes son justamente el movimiento ENTRE
    // las 2 empresas — no tienen una sola "Sede", así que van con
    // Origen/Destino (o Solicitante/Proveedor) en vez de una columna
    // Sede, para que quede claro el sentido del movimiento.
    const wsTransferencias = XLSX.utils.json_to_sheet(
      (transferencias || []).map((t) => ({
        Fecha: t.fecha, Codigo: t.codigo, Producto: t.productoNombre, Cantidad: t.cantidad,
        Origen: sede(t.origen), Destino: sede(t.destino), Usuario: t.usuario,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsTransferencias, "Transferencias");

    const wsSolicitudes = XLSX.utils.json_to_sheet(
      (solicitudes || []).map((s) => ({
        Fecha: s.fecha, Codigo: s.codigo, Producto: s.productoNombre, Cantidad: s.cantidad,
        Solicitante: sede(s.solicitante), Proveedor: sede(s.proveedor), Estado: s.estado,
        Usuario_solicito: s.usuarioSolicito, Usuario_respondio: s.usuarioRespondio || "", Fecha_respuesta: s.fechaRespuesta || "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsSolicitudes, "Solicitudes");

    const fechaArchivo = todayStr();
    XLSX.writeFile(wb, `Respaldo_SumajIllari_JL_${fechaArchivo}.xlsx`);
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
      <Sidebar view={vistaSegura} setView={setView} onExportClick={exportarExcel} rol={rol} ubicacion={ubicacion} ubicacionVista={ubicacionVista} onChangeUbicacionVista={setUbicacionSeleccionada} cerrarSesion={cerrarSesion} nombreSesion={nombreSesion} onCambiarNombre={() => setPidiendoNombre(true)} solicitudesPendientes={solicitudesPendientesParaMi} />
      <main className={`flex-1 min-w-0 ${vistaOscura ? "bg-stone-950" : ""}`}>
        <div className="max-w-6xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
          {vistaSegura === "dashboard" && <Dashboard productos={productosCompletos} movimientos={movimientosUbicacion} ventas={ventasUbicacion} setView={setView} esConsolidado={esConsolidado} valorizacionPorSede={valorizacionPorSede} nombreVista={nombreVista} pedidos={pedidosUbicacion} solicitudesPendientes={solicitudesPendientesLista} alertasSinStock={alertasSinStock} alertasBajoMinimo={alertasBajoMinimo} onIrAPedidos={irAPedidos} />}
          {vistaSegura === "productos" && (
            <Productos productos={productosCompletos} variantes={productos} modelos={modelos} onSaveModelos={persistModelos} inventarios={inventarios} onSaveInventarios={persistInventarios} ubicacion={ubicacionVista} esConsolidado={esConsolidado} nombreVista={nombreVista} movimientos={movimientos} ventas={ventas} onSave={persist} showToast={showToast} setView={setView} rol={rol} nombre={nombreSesion} />
          )}
          {vistaSegura === "ventas" && (
            <Ventas productos={productosCompletos} movimientos={movimientosUbicacion} ventas={ventasUbicacion} onSave={persist} onSaveInventarios={persistInventarios} showToast={showToast} nombre={nombreSesion} rol={rol} ubicacion={ubicacionVista} esConsolidado={esConsolidado} nombreVista={nombreVista} />
          )}
          {vistaSegura === "demanda" && <Demanda ventas={ventasUbicacion} productos={productosCompletos} />}
          {vistaSegura === "analisis" && <Analisis productos={productosCompletos} movimientos={movimientosUbicacion} ventas={ventasUbicacion} />}
          {vistaSegura === "margenes" && <Margenes productos={productosCompletos} ventas={ventasUbicacion} />}
          {vistaSegura === "movimientos" && (
            <Movimientos productos={productosCompletos} movimientos={movimientosUbicacion} onSave={persist} onSaveInventarios={persistInventarios} showToast={showToast} nombre={nombreSesion} rol={rol} ubicacion={ubicacionVista} esConsolidado={esConsolidado} nombreVista={nombreVista} />
          )}
          {vistaSegura === "compras" && (
            <Compras productos={productosCompletos} variantes={productos} movimientos={movimientosUbicacion} compras={comprasUbicacion} onSave={persist} onSaveInventarios={persistInventarios} showToast={showToast} nombre={nombreSesion} rol={rol} ubicacion={ubicacionVista} esConsolidado={esConsolidado} nombreVista={nombreVista} sedesVista={sedesVista} />
          )}
          {vistaSegura === "transferencias" && (
            <Transferencias productos={productosCompletos} variantes={productos} inventarios={inventarios} transferencias={transferenciasUbicacion} solicitudes={solicitudesUbicacion} showToast={showToast} nombre={nombreSesion} rol={rol} ubicacion={ubicacionVista} esConsolidado={esConsolidado} nombreVista={nombreVista} />
          )}
          {vistaSegura === "auditoria" && <Auditoria auditoria={auditoriaUbicacion} esConsolidado={esConsolidado} nombreVista={nombreVista} />}
          {vistaSegura === "produccion" && (
            <Produccion productos={productosCompletos} variantes={productos} modelos={modelos} onSaveModelos={persistModelos} onSaveInventarios={persistInventarios} movimientos={movimientos} ventas={ventas} compras={compras} producciones={producciones} pedidos={pedidos} onSave={persist} showToast={showToast} rol={rol} nombre={nombreSesion} ubicacion={ubicacionVista} esConsolidado={esConsolidado} nombreVista={nombreVista} tabInicial={produccionTabInicial} onTabInicialConsumido={() => setProduccionTabInicial(null)} />
          )}
          {vistaSegura === "nuevo" && (
            <NuevoProducto productos={productos} modelos={modelos} onSaveModelos={persistModelos} onSaveInventarios={persistInventarios} inventarios={inventarios} movimientos={movimientos} onSave={persist} showToast={showToast} setView={setView} nombre={nombreSesion} rol={rol} ubicacion={ubicacionVista} esConsolidado={esConsolidado} nombreVista={nombreVista} />
          )}
        </div>
      </main>
      {toast && <Toast type={toast.type} msg={toast.msg} />}
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

