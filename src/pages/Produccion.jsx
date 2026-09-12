import React, { useState, useMemo, useEffect } from "react";
import {
  Plus, XCircle, Trash2, ClipboardList, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { todayStr, round2, formatSoles, formatFecha, filtrarPorUbicacion, promedioPonderado, diasHasta } from "../utils/format.js";
import { UBICACIONES } from "../utils/constants.js";
import SelectorProducto from "../components/SelectorProducto.jsx";
import { operarInventarioSeguro, registrarAuditoria } from "../firestoreSync.js";

const NOMBRE_UBICACION = Object.fromEntries(UBICACIONES.map((u) => [u.id, u.nombre]));

// Stock (en "inventarios") y costo unitario (en "costos", protegido —
// ver la tarea de seguridad del costo unitario) se calculan juntos acá
// abajo por comodidad (un solo objeto "cambios" con las dos cosas), pero
// se guardan en colecciones separadas. Esta función divide ese mapa de
// cambios en las dos escrituras que corresponden, para no repetir el
// mismo troceado en Producir y en Completar pedido.
function dividirInventarioYCosto(inventariosActuales, costosActuales, cambios) {
  const nuevosInventarios = [
    ...inventariosActuales.filter((i) => !cambios[i.id]),
    ...Object.values(cambios).map((c) => ({
      id: c.id, varianteId: c.varianteId, ubicacion: c.ubicacion,
      stock: c.stock, stockMinimo: c.stockMinimo, fechaIncorporacion: c.fechaIncorporacion,
    })),
  ];
  const nuevosCostos = [
    ...costosActuales.filter((c) => !cambios[c.id]),
    ...Object.values(cambios).map((c) => ({ id: c.id, varianteId: c.varianteId, ubicacion: c.ubicacion, costoUnitario: c.costoUnitario })),
  ];
  return { nuevosInventarios, nuevosCostos };
}

export default function Produccion({ productos, variantes, modelos, onSaveModelos, movimientos, ventas, compras, producciones, pedidos, onSave, showToast, rol, nombre, ubicacion, esConsolidado, nombreVista, tabInicial, onTabInicialConsumido }) {
  const [tab, setTab] = useState("producir"); // "producir" | "recetas" | "pedidos"

  // Permite que otra pantalla (ej. una alerta del Dashboard) mande
  // directo a la pestaña "Pedidos" en vez de abrir siempre en
  // "Producir". "onTabInicialConsumido" le avisa a quien lo pidió que
  // ya se atendió, para que no se quede "pegado" forzando esta pestaña
  // cada vez que este componente se vuelve a mostrar.
  useEffect(() => {
    if (tabInicial) {
      setTab(tabInicial);
      onTabInicialConsumido && onTabInicialConsumido();
    }
  }, [tabInicial]);

  const terminados = productos.filter((p) => p.tipo === "Terminado" || p.tipo === "En proceso");
  const materiasPrimas = productos.filter((p) => p.tipo === "Materia prima");
  const insumosDisponibles = productos.filter((p) => p.tipo === "Materia prima" || p.tipo === "En proceso");

  // "producciones" acá solo se usa para MOSTRAR (el historial de la
  // pestaña "Producir") — nunca se vuelve a guardar completo desde este
  // componente, así que filtrarlo por ubicación es seguro. "pedidos", en
  // cambio, se usa también para guardar (tomar pedido, marcar avance), así
  // que ese se filtra más abajo, adentro de PedidosPanel, solo para lo que
  // se muestra en pantalla — nunca para lo que se guarda.
  const produccionesUbicacion = filtrarPorUbicacion(producciones, ubicacion);

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
        <button
          onClick={() => setTab("pedidos")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition inline-flex items-center gap-1.5 ${tab === "pedidos" ? "border-red-600 text-red-600" : "border-transparent text-stone-500 hover:text-stone-700"}`}
        >
          <ClipboardList size={15} /> Pedidos
        </button>
      </div>

      {tab === "recetas" ? (
        <RecetasEditor productos={productos} variantes={variantes} terminados={terminados} insumosDisponibles={insumosDisponibles} movimientos={movimientos} onSave={onSave} showToast={showToast} nombre={nombre} rol={rol} ubicacion={ubicacion} />
      ) : tab === "pedidos" ? (
        <PedidosPanel productos={productos} variantes={variantes} modelos={modelos} onSaveModelos={onSaveModelos} movimientos={movimientos} ventas={ventas} producciones={produccionesUbicacion} pedidos={pedidos || []} terminados={terminados} onSave={onSave} showToast={showToast} rol={rol} nombre={nombre} ubicacion={ubicacion} esConsolidado={esConsolidado} nombreVista={nombreVista} />
      ) : (
        <ProducirForm productos={productos} movimientos={movimientos} producciones={produccionesUbicacion} terminados={terminados} onSave={onSave} showToast={showToast} nombre={nombre} rol={rol} ubicacion={ubicacion} esConsolidado={esConsolidado} nombreVista={nombreVista} />
      )}
    </div>
  );
}


function RecetasEditor({ productos, variantes, terminados, insumosDisponibles, movimientos, onSave, showToast, nombre, rol, ubicacion }) {
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
    // Se guarda sobre las variantes REALES (sin los campos del modelo
    // pegados encima), para no terminar copiando nombre/categoría/tipo
    // dentro de la colección de tallas.
    const newVariantes = variantes.map((p) => (p.id === terminadoId ? { ...p, receta: nuevaReceta } : p));
    try {
      setGuardando(true);
      await onSave(newVariantes, movimientos);
      showToast("success", "Ficha técnica actualizada.");
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "RECETA", ubicacion,
        detalle: `Actualizó la ficha técnica de ${terminado?.producto || ""}${terminado?.talla && terminado.talla !== "Única" ? " - " + terminado.talla : ""}`,
      }).catch(() => {});
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


function ProducirForm({ productos, movimientos, producciones, terminados, onSave, showToast, nombre, rol, ubicacion, esConsolidado, nombreVista }) {
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

    setEnviando(true);
    setError("");
    try {
      let costoFinal = costoUnitarioResultante;
      // Se vuelve a calcular todo (consumo, costos, suficiencia de stock)
      // adentro de la transacción, con los datos reales del servidor en
      // ese instante — así, si alguien más acaba de vender o producir
      // algo de estos mismos insumos, esta producción no se guarda con
      // números desactualizados ni deja el stock en negativo.
      await operarInventarioSeguro(["inventarios", "costos", "movimientos", "producciones"], (actuales) => {
        // Se arma el stock/costo real de ESTA ubicación para cada producto
        // involucrado. Si un producto todavía no tiene registro de
        // inventario aquí, se usa lo que ya traía cargado en pantalla como
        // punto de partida (así no se pierde nada de lo que ya existía).
        // El stock y el costo viven en colecciones separadas (ver arriba),
        // pero se combinan en un solo objeto acá abajo por comodidad de
        // cálculo — se vuelven a separar recién al guardar.
        const invPorClave = Object.fromEntries(actuales.inventarios.map((i) => [i.id, i]));
        const costoPorClave = Object.fromEntries(actuales.costos.map((c) => [c.id, c]));
        const leerInv = (varianteId) => {
          const clave = `${varianteId}__${ubicacion}`;
          const inv = invPorClave[clave];
          const costoReg = costoPorClave[clave];
          const enPantalla = productos.find((p) => p.id === varianteId);
          return {
            id: clave, varianteId, ubicacion,
            stock: inv ? inv.stock : (enPantalla?.stock || 0),
            stockMinimo: inv ? inv.stockMinimo : (enPantalla?.stockMinimo ?? null),
            fechaIncorporacion: inv ? inv.fechaIncorporacion : (enPantalla?.fechaIncorporacion || fecha),
            costoUnitario: costoReg ? costoReg.costoUnitario : (enPantalla?.costoUnitario ?? null),
          };
        };

        const terminadoReal = productos.find((p) => p.id === terminadoId);
        if (!terminadoReal) throw new Error("Ese producto ya no existe en el catálogo. Actualiza la página e inténtalo de nuevo.");
        const recetaReal = terminadoReal.receta || [];
        if (recetaReal.length === 0) throw new Error("Este producto ya no tiene una ficha técnica definida.");

        const consumoReal = recetaReal.map((r) => {
          const mpPantalla = productos.find((p) => p.id === r.materiaPrimaId);
          const mpInv = leerInv(r.materiaPrimaId);
          const necesario = round2(r.cantidadPorUnidad * cant);
          return { ...r, materiaPrima: mpPantalla, inv: mpInv, necesario, costoUnitarioMP: mpInv.costoUnitario };
        });

        const faltante = consumoReal.find((c) => !c.materiaPrima || c.inv.stock < c.necesario);
        if (faltante) {
          const nombreInsumo = faltante.materiaPrima ? faltante.materiaPrima.producto : "un insumo de la ficha técnica";
          const disponible = faltante.materiaPrima ? faltante.inv.stock : 0;
          throw new Error(`Stock insuficiente de ${nombreInsumo}. Ahora mismo solo hay ${disponible} (puede que alguien más lo haya usado).`);
        }

        const costoTotalReal = round2(consumoReal.reduce((s, c) => s + (c.costoUnitarioMP || 0) * c.necesario, 0));
        const costoUnitarioReal = cant > 0 ? round2(costoTotalReal / cant) : 0;
        const invTerminado = leerInv(terminadoId);
        const nuevoCosto = promedioPonderado(invTerminado.stock, invTerminado.costoUnitario, cant, costoUnitarioReal);
        costoFinal = nuevoCosto;

        // Se aplican los cambios sobre los registros de inventario de esta
        // ubicación: sube el terminado, bajan los insumos consumidos.
        const cambios = {
          [invTerminado.id]: { ...invTerminado, stock: round2(invTerminado.stock + cant), costoUnitario: nuevoCosto },
        };
        for (const c of consumoReal) {
          const yaModificado = cambios[c.inv.id] || c.inv;
          cambios[c.inv.id] = { ...yaModificado, stock: round2(yaModificado.stock - c.necesario) };
        }
        const { nuevosInventarios, nuevosCostos } = dividirInventarioYCosto(actuales.inventarios, actuales.costos, cambios);

        const nuevosMovimientos = [
          ...actuales.movimientos,
          ...consumoReal.map((c) => ({
            id: `M${Date.now()}-${c.materiaPrimaId}`, fecha, tipo: "SALIDA", productoId: c.materiaPrimaId, ubicacion,
            productoNombre: `${c.materiaPrima.producto}${c.materiaPrima.talla !== "Única" ? " - " + c.materiaPrima.talla : ""}`,
            cantidad: c.necesario, motivo: `Consumo para producción de ${terminadoReal.producto}`,
          })),
          {
            id: `M${Date.now()}-prod`, fecha, tipo: "ENTRADA", productoId: terminadoId, ubicacion,
            productoNombre: `${terminadoReal.producto}${terminadoReal.talla !== "Única" ? " - " + terminadoReal.talla : ""}`,
            cantidad: cant, motivo: "Producción",
          },
        ];

        const produccion = {
          id: `P${Date.now()}`, fecha, productoId: terminadoId, codigo: terminadoReal.codigo, ubicacion,
          producto: terminadoReal.producto, talla: terminadoReal.talla, cantidad: cant,
          costoUnitario: costoUnitarioReal, total: costoTotalReal,
          insumos: consumoReal.map((c) => ({ materiaPrimaId: c.materiaPrimaId, cantidad: c.necesario, costoUnitario: c.costoUnitarioMP })),
        };

        return {
          inventarios: nuevosInventarios,
          costos: nuevosCostos,
          movimientos: nuevosMovimientos,
          producciones: [...actuales.producciones, produccion],
        };
      });

      showToast("success", `Producción registrada. Costo actualizado a ${formatSoles(costoFinal)}.`);
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "PRODUCCION", ubicacion,
        detalle: `Produjo ${cant} ${terminado?.producto || ""}${terminado?.talla && terminado.talla !== "Única" ? " - " + terminado.talla : ""}`,
      }).catch(() => {});
      setTerminadoId(""); setCantidad(""); setError("");
    } catch (err) {
      setError(err && err.message ? err.message : "No se pudo guardar la producción. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      {esConsolidado ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Estás viendo {nombreVista}. Elige una sede específica arriba (en el menú) para poder registrar una producción — en modo consolidado no hay a dónde atribuirla.
        </div>
      ) : (
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
      )}

      {producciones.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <h2 className="text-sm font-semibold text-stone-700 p-4 pb-0 mb-3">Historial de producción</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-stone-500 border-b border-stone-100">
                {esConsolidado && <th className="text-left px-4 py-1.5 font-medium">Sede</th>}
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
                  {esConsolidado && <td className="px-4 py-1.5 text-stone-500">{NOMBRE_UBICACION[p.ubicacion] || NOMBRE_UBICACION.sumaj_illari}</td>}
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


function PedidosPanel({ productos, variantes, modelos, onSaveModelos, movimientos, ventas, producciones, pedidos, terminados, onSave, showToast, rol, nombre, ubicacion, esConsolidado, nombreVista }) {
  const [showForm, setShowForm] = useState(false);
  const [cliente, setCliente] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precioCotizado, setPrecioCotizado] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [nuevaOperacion, setNuevaOperacion] = useState("");
  const [operacionesTemp, setOperacionesTemp] = useState([]); // solo cuando el modelo no tiene operaciones aún
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [completandoId, setCompletandoId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  // Estado del formulario de pago al "Entregar" un pedido "Listo" — solo
  // un pedido puede tener el formulario abierto a la vez.
  const [entregandoId, setEntregandoId] = useState(null);
  const [pagoEfectivo, setPagoEfectivo] = useState("");
  const [pagoYape, setPagoYape] = useState("");
  const [pagoTarjeta, setPagoTarjeta] = useState("");
  const [errorEntrega, setErrorEntrega] = useState("");
  const [enviandoEntrega, setEnviandoEntrega] = useState(false);

  const producto = terminados.find((p) => p.id === productoId);
  const cant = Number(cantidad) || 0;
  const precio = Number(precioCotizado) || 0;
  // Las operaciones (Corte, Costura, Acabado...) se definen UNA VEZ por
  // modelo (código) y quedan guardadas ahí para siempre — la próxima vez
  // que se tome un pedido de este mismo modelo, ya no se vuelven a pedir.
  const operacionesModelo = producto?.operaciones || [];
  const modeloTieneOperaciones = operacionesModelo.length > 0;

  function reset() {
    setCliente(""); setProductoId(""); setCantidad(""); setPrecioCotizado(""); setFechaEntrega("");
    setOperacionesTemp([]); setNuevaOperacion(""); setError("");
  }

  function agregarOperacionTemp() {
    const v = nuevaOperacion.trim();
    if (!v) return;
    if (operacionesTemp.includes(v)) return setError("Esa operación ya está en la lista.");
    setOperacionesTemp([...operacionesTemp, v]);
    setNuevaOperacion("");
    setError("");
  }

  function quitarOperacionTemp(op) {
    setOperacionesTemp(operacionesTemp.filter((o) => o !== op));
  }

  // Tomar un pedido NO mueve stock todavía — es solo seguimiento (cliente,
  // precio cotizado, fecha de entrega). El stock y el costo de fabricar
  // recién se mueven cuando se completan TODAS las operaciones (ver
  // marcarListoPedido); la venta se registra después, al entregar (ver
  // entregarPedido).
  async function handleCrear(e) {
    e.preventDefault();
    if (enviando) return;
    if (esConsolidado) return setError("Estás en modo consolidado — elige una sede específica arriba para tomar un pedido.");
    if (!cliente.trim()) return setError("Ingresa el nombre del cliente.");
    if (!productoId) return setError("Selecciona qué producto se va a fabricar.");
    if (!cantidad || cant <= 0) return setError("Ingresa una cantidad válida, mayor a cero.");
    if (!precioCotizado || precio < 0) return setError("Ingresa el precio cotizado (total del pedido).");
    if (!fechaEntrega) return setError("Ingresa la fecha de entrega comprometida.");
    if (!producto.receta || producto.receta.length === 0) {
      return setError("Este producto no tiene una Ficha técnica definida todavía. Ve a la pestaña 'Fichas técnicas' primero.");
    }
    const operacionesAUsar = modeloTieneOperaciones ? operacionesModelo : operacionesTemp;
    if (operacionesAUsar.length === 0) {
      return setError("Agrega al menos una operación de producción (ej. Corte) para poder seguir el avance del pedido.");
    }

    setEnviando(true);
    setError("");
    try {
      // Si el modelo todavía no tenía operaciones definidas, se guardan
      // ahora en el modelo — quedan para siempre, no solo para este pedido.
      if (!modeloTieneOperaciones) {
        const nuevosModelos = modelos.map((m) =>
          m.codigo === producto.codigo ? { ...m, operaciones: operacionesTemp } : m
        );
        await onSaveModelos(nuevosModelos);
      }
      const nuevoPedido = {
        id: `PED${Date.now()}`, fecha: todayStr(), cliente: cliente.trim(), ubicacion,
        productoId, codigo: producto.codigo, producto: producto.producto, talla: producto.talla,
        cantidad: cant, precioCotizado: precio, fechaEntrega, etapa: "Tomado",
        operaciones: operacionesAUsar, operacionesCompletadas: [],
      };
      await onSave(variantes, movimientos, ventas, undefined, producciones, [...pedidos, nuevoPedido]);
      showToast("success", `Pedido de ${cliente.trim()} registrado.`);
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "PEDIDO_TOMADO", ubicacion,
        detalle: `Tomó pedido de ${cliente.trim()} — ${cant} ${producto?.producto || ""} — S/ ${precio.toFixed(2)}`,
      }).catch(() => {});
      reset();
      setShowForm(false);
    } catch (err) {
      setError("No se pudo registrar el pedido: " + (err && err.message ? err.message : String(err)));
    } finally {
      setEnviando(false);
    }
  }

  // Marca (o desmarca) una operación del pedido. Si con esto quedan TODAS
  // las operaciones marcadas, el pedido pasa solo a "Listo para
  // entregar" (consume insumos y sube el stock del terminado — ver
  // marcarListoPedido). La entrega/venta es un paso aparte, con su
  // propio botón "Entregar".
  async function toggleOperacion(pedido, op) {
    const yaMarcada = (pedido.operacionesCompletadas || []).includes(op);
    const nuevasCompletadas = yaMarcada
      ? pedido.operacionesCompletadas.filter((o) => o !== op)
      : [...(pedido.operacionesCompletadas || []), op];

    setTogglingId(pedido.id + op);
    registrarAuditoria({
      fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "PEDIDO_ETAPA", ubicacion: pedido.ubicacion || "sumaj_illari",
      detalle: `${yaMarcada ? "Desmarcó" : "Marcó"} "${op}" en el pedido de ${pedido.cliente} (${nuevasCompletadas.length}/${pedido.operaciones.length})`,
    }).catch(() => {});

    const todasCompletas = pedido.operaciones.every((o) => nuevasCompletadas.includes(o));
    if (todasCompletas) {
      await marcarListoPedido(pedido, nuevasCompletadas);
      setTogglingId(null);
      return;
    }

    const nuevosPedidos = pedidos.map((p) => (p.id === pedido.id ? { ...p, operacionesCompletadas: nuevasCompletadas } : p));
    await onSave(variantes, movimientos, ventas, undefined, producciones, nuevosPedidos);
    setTogglingId(null);
  }

  // PASO 1 de 2: al completar la última operación, el pedido SOLO se
  // fabrica — consume insumos según la Ficha técnica y el terminado
  // sube de stock DE VERDAD (igual que una Producción normal desde
  // "Producir"). El pedido queda "Listo para entregar"; la venta se
  // registra aparte, en entregarPedido() (más abajo), recién cuando de
  // verdad se entrega al cliente — que puede ser el mismo día o días
  // después. Antes esto pasaba todo junto y el stock nunca llegaba a
  // subir de verdad (subía y bajaba en el mismo cálculo), lo que además
  // mezclaba el costo de esta producción puntual con el promedio
  // general sin que esas unidades hubieran estado nunca de verdad en el
  // inventario compartido — separar los pasos corrige eso de paso.
  async function marcarListoPedido(pedido, operacionesCompletadasFinal) {
    // El pedido ya tiene su propia sede guardada desde que se tomó (ver
    // handleCrear) — se usa ESA, no la ubicación que se esté mirando en
    // este momento. Así, avanzar un pedido funciona incluso si la
    // gerente está viendo el consolidado: no hay ambigüedad, porque el
    // pedido ya sabe de qué sede es.
    const ubicacionPedido = pedido.ubicacion || "sumaj_illari";
    setCompletandoId(pedido.id);
    try {
      let costoTotalFinal = 0;
      await operarInventarioSeguro(["inventarios", "costos", "movimientos", "producciones", "pedidos"], (actuales) => {
        const invPorClave = Object.fromEntries(actuales.inventarios.map((i) => [i.id, i]));
        const costoPorClave = Object.fromEntries(actuales.costos.map((c) => [c.id, c]));
        const leerInv = (varianteId) => {
          const clave = `${varianteId}__${ubicacionPedido}`;
          const inv = invPorClave[clave];
          const costoReg = costoPorClave[clave];
          const enPantalla = productos.find((p) => p.id === varianteId);
          return {
            id: clave, varianteId, ubicacion: ubicacionPedido,
            stock: inv ? inv.stock : (enPantalla?.stock || 0),
            stockMinimo: inv ? inv.stockMinimo : (enPantalla?.stockMinimo ?? null),
            fechaIncorporacion: inv ? inv.fechaIncorporacion : (enPantalla?.fechaIncorporacion || todayStr()),
            costoUnitario: costoReg ? costoReg.costoUnitario : (enPantalla?.costoUnitario ?? null),
          };
        };

        const terminadoReal = productos.find((p) => p.id === pedido.productoId);
        if (!terminadoReal) throw new Error("Ese producto ya no existe en el catálogo.");
        const receta = terminadoReal.receta || [];
        if (receta.length === 0) throw new Error("Este producto ya no tiene una Ficha técnica definida.");

        const consumo = receta.map((r) => {
          const mpPantalla = productos.find((p) => p.id === r.materiaPrimaId);
          const mpInv = leerInv(r.materiaPrimaId);
          const necesario = round2(r.cantidadPorUnidad * pedido.cantidad);
          return { materiaPrimaId: r.materiaPrimaId, materiaPrima: mpPantalla, inv: mpInv, necesario, costoUnitarioMP: mpInv.costoUnitario };
        });
        const faltante = consumo.find((c) => !c.materiaPrima || c.inv.stock < c.necesario);
        if (faltante) {
          const nombreInsumo = faltante.materiaPrima ? faltante.materiaPrima.producto : "un insumo de la ficha técnica";
          const disponible = faltante.materiaPrima ? faltante.inv.stock : 0;
          throw new Error(`Stock insuficiente de ${nombreInsumo}. Ahora mismo solo hay ${disponible}.`);
        }

        const costoTotalReal = round2(consumo.reduce((s, c) => s + (c.costoUnitarioMP || 0) * c.necesario, 0));
        const costoUnitarioReal = pedido.cantidad > 0 ? round2(costoTotalReal / pedido.cantidad) : 0;
        const invTerminado = leerInv(pedido.productoId);
        const nuevoCostoPromedio = promedioPonderado(invTerminado.stock, invTerminado.costoUnitario, pedido.cantidad, costoUnitarioReal);
        costoTotalFinal = costoTotalReal;

        // A diferencia del flujo viejo, el stock del terminado SÍ sube
        // de verdad acá — recién baja cuando se entrega de verdad (ver
        // entregarPedido).
        const cambios = {
          [invTerminado.id]: { ...invTerminado, stock: round2(invTerminado.stock + pedido.cantidad), costoUnitario: nuevoCostoPromedio },
        };
        for (const c of consumo) {
          const yaModificado = cambios[c.inv.id] || c.inv;
          cambios[c.inv.id] = { ...yaModificado, stock: round2(yaModificado.stock - c.necesario) };
        }
        const { nuevosInventarios, nuevosCostos } = dividirInventarioYCosto(actuales.inventarios, actuales.costos, cambios);

        const nuevosMovimientos = [
          ...actuales.movimientos,
          ...consumo.map((c) => ({
            id: `M${Date.now()}-${c.materiaPrimaId}`, fecha: todayStr(), tipo: "SALIDA", productoId: c.materiaPrimaId, ubicacion: ubicacionPedido,
            productoNombre: `${c.materiaPrima.producto}${c.materiaPrima.talla !== "Única" ? " - " + c.materiaPrima.talla : ""}`,
            cantidad: c.necesario, motivo: `Consumo para pedido de ${pedido.cliente}`,
          })),
          {
            id: `M${Date.now()}-prod`, fecha: todayStr(), tipo: "ENTRADA", productoId: pedido.productoId, ubicacion: ubicacionPedido,
            productoNombre: `${terminadoReal.producto}${terminadoReal.talla !== "Única" ? " - " + terminadoReal.talla : ""}`,
            cantidad: pedido.cantidad, motivo: `Producción para pedido de ${pedido.cliente}`,
          },
        ];

        const produccion = {
          id: `P${Date.now()}`, fecha: todayStr(), productoId: pedido.productoId, codigo: terminadoReal.codigo, ubicacion: ubicacionPedido,
          producto: terminadoReal.producto, talla: terminadoReal.talla, cantidad: pedido.cantidad,
          costoUnitario: costoUnitarioReal, total: costoTotalReal,
          insumos: consumo.map((c) => ({ materiaPrimaId: c.materiaPrimaId, cantidad: c.necesario, costoUnitario: c.costoUnitarioMP })),
        };

        const nuevosPedidos = actuales.pedidos.map((p) =>
          p.id === pedido.id
            ? { ...p, etapa: "Listo", operacionesCompletadas: operacionesCompletadasFinal || p.operaciones, listoEn: todayStr(), costoProduccion: costoTotalReal }
            : p
        );

        return {
          inventarios: nuevosInventarios,
          costos: nuevosCostos,
          movimientos: nuevosMovimientos,
          producciones: [...actuales.producciones, produccion],
          pedidos: nuevosPedidos,
        };
      });

      showToast("success", `Pedido de ${pedido.cliente} listo para entregar. Costo de producción: ${formatSoles(costoTotalFinal)}.`);
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "PEDIDO_LISTO", ubicacion: ubicacionPedido,
        detalle: `Pedido de ${pedido.cliente} listo para entregar — ${pedido.cantidad} ${pedido.producto}${pedido.talla && pedido.talla !== "Única" ? " - " + pedido.talla : ""} — costo ${formatSoles(costoTotalFinal)}`,
      }).catch(() => {});
    } catch (err) {
      showToast("error", "No se pudo completar la producción del pedido: " + (err && err.message ? err.message : String(err)));
    } finally {
      setCompletandoId(null);
    }
  }

  // PASO 2 de 2: entregar un pedido "Listo" es una venta como cualquier
  // otra (mismo criterio que Ventas.jsx) — descuenta el stock que ya se
  // había producido, al costo promedio VIGENTE en este momento (no al
  // que tenía cuando se produjo: si pasó tiempo y algo más tocó el
  // mismo producto mientras tanto, el costo pudo cambiar, y usar el
  // vigente es lo correcto — es lo mismo que hace cualquier venta). Por
  // eso "costoProduccion" (guardado en marcarListoPedido) y el margen de
  // acá pueden no coincidir exactamente: uno es cuánto costó FABRICAR,
  // el otro es el margen real con el costo vigente al momento de VENDER.
  async function entregarPedido(pedido, pago) {
    const ubicacionPedido = pedido.ubicacion || "sumaj_illari";
    setEnviandoEntrega(true);
    try {
      let margenFinal = 0;
      await operarInventarioSeguro(["inventarios", "movimientos", "ventas", "pedidos"], (actuales) => {
        const clave = `${pedido.productoId}__${ubicacionPedido}`;
        const invActual = actuales.inventarios.find((i) => i.id === clave);
        const terminadoPantalla = productos.find((p) => p.id === pedido.productoId);
        const stockActual = invActual ? invActual.stock : (terminadoPantalla?.stock || 0);
        // Revalidación contra el dato real del servidor: si entre
        // "Listo" y "Entregar" pasó tiempo, alguien pudo haber vendido o
        // movido este mismo producto por otro lado.
        if (stockActual < pedido.cantidad) {
          throw new Error(`Stock insuficiente para entregar. Ahora mismo solo hay ${stockActual} (puede que alguien más lo haya vendido o movido mientras tanto).`);
        }
        const costoActualReg = actuales.costos.find((c) => c.id === clave);
        const costoActual = costoActualReg ? costoActualReg.costoUnitario : (terminadoPantalla?.costoUnitario ?? null);

        const nuevoInv = { ...invActual, stock: round2(stockActual - pedido.cantidad) };
        const nuevosInventarios = invActual
          ? actuales.inventarios.map((i) => (i.id === clave ? nuevoInv : i))
          : [...actuales.inventarios, {
              id: clave, varianteId: pedido.productoId, ubicacion: ubicacionPedido,
              stock: round2(stockActual - pedido.cantidad),
              stockMinimo: terminadoPantalla?.stockMinimo ?? null,
              fechaIncorporacion: terminadoPantalla?.fechaIncorporacion || todayStr(),
            }];

        const precioUnitario = pedido.cantidad > 0 ? round2(pedido.precioCotizado / pedido.cantidad) : 0;
        const venta = {
          id: `V${Date.now()}`, fecha: todayStr(), idProducto: pedido.codigo, producto: pedido.producto, ubicacion: ubicacionPedido,
          cantidad: pedido.cantidad, talla: pedido.talla, descripcion: `Pedido - ${pedido.cliente}`,
          precio: precioUnitario, efectivo: pago.efectivo, yape: pago.yape, tarjeta: pago.tarjeta, total: pedido.precioCotizado,
          costoUnitario: costoActual, pedidoId: pedido.id,
        };
        const mov = {
          id: `M${Date.now()}-venta`, fecha: todayStr(), tipo: "VENTA", productoId: pedido.productoId, ubicacion: ubicacionPedido,
          productoNombre: `${pedido.producto}${pedido.talla !== "Única" ? " - " + pedido.talla : ""}`,
          cantidad: pedido.cantidad, motivo: `Entrega de pedido a ${pedido.cliente}`,
        };

        margenFinal = round2(pedido.precioCotizado - (costoActual != null ? costoActual * pedido.cantidad : 0));
        const nuevosPedidos = actuales.pedidos.map((p) =>
          p.id === pedido.id ? { ...p, etapa: "Entregado", entregadoEn: todayStr(), margen: margenFinal } : p
        );

        return {
          inventarios: nuevosInventarios,
          movimientos: [...actuales.movimientos, mov],
          ventas: [...actuales.ventas, venta],
          pedidos: nuevosPedidos,
        };
      }, ["costos"]);

      showToast("success", `Pedido de ${pedido.cliente} entregado. Margen: ${formatSoles(margenFinal)}.`);
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombre || "?", rol, accion: "PEDIDO_ENTREGADO", ubicacion: ubicacionPedido,
        detalle: `Entregó pedido de ${pedido.cliente} — margen ${formatSoles(margenFinal)}`,
      }).catch(() => {});
      setEntregandoId(null);
      setPagoEfectivo(""); setPagoYape(""); setPagoTarjeta(""); setErrorEntrega("");
    } catch (err) {
      setErrorEntrega(err && err.message ? err.message : "No se pudo entregar el pedido. Intenta de nuevo.");
    } finally {
      setEnviandoEntrega(false);
    }
  }

  function abrirEntrega(pedido) {
    setEntregandoId(pedido.id);
    setPagoEfectivo(""); setPagoYape(""); setPagoTarjeta(""); setErrorEntrega("");
  }

  function confirmarEntrega(pedido) {
    const efectivo = Number(pagoEfectivo) || 0;
    const yape = Number(pagoYape) || 0;
    const tarjeta = Number(pagoTarjeta) || 0;
    const suma = round2(efectivo + yape + tarjeta);
    if (suma !== round2(pedido.precioCotizado)) {
      return setErrorEntrega(`La forma de pago (${formatSoles(suma)}) no coincide con el total cotizado (${formatSoles(pedido.precioCotizado)}).`);
    }
    entregarPedido(pedido, { efectivo, yape, tarjeta });
  }

  // Estas listas son solo para MOSTRAR en pantalla — se filtran por
  // ubicación acá adentro. El arreglo "pedidos" que llega por props se usa
  // SIN filtrar en handleCrear y toggleOperacion (más abajo), porque esos
  // sí guardan la colección completa: si se guardara ya filtrada, se
  // borrarían los pedidos de las otras ubicaciones.
  const pedidosUbicacion = useMemo(() => filtrarPorUbicacion(pedidos, ubicacion), [pedidos, ubicacion]);
  // "Pendientes" incluye tanto los recién tomados ("Tomado", con sus
  // operaciones por marcar) como los que ya se fabricaron y están
  // esperando que alguien los entregue ("Listo") — ambos necesitan
  // todavía una acción de alguien. "Entregado" es el final del flujo
  // nuevo; "Completado" es la etapa final del flujo VIEJO (de antes de
  // separar producción de entrega) — los pedidos ya completados con ese
  // flujo se tratan igual de terminados, sin reclasificarlos.
  const pendientes = useMemo(
    () => pedidosUbicacion.filter((p) => p.etapa !== "Entregado" && p.etapa !== "Completado").sort((a, b) => (a.fechaEntrega < b.fechaEntrega ? -1 : 1)),
    [pedidosUbicacion]
  );
  const entregados = useMemo(
    () => pedidosUbicacion.filter((p) => p.etapa === "Entregado" || p.etapa === "Completado")
      .sort((a, b) => ((a.entregadoEn || a.completadoEn || "") < (b.entregadoEn || b.completadoEn || "") ? 1 : -1)),
    [pedidosUbicacion]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700">Pedidos de clientes</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-1.5"
        >
          <Plus size={15} /> Tomar pedido
        </button>
      </div>

      {showForm && esConsolidado && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Estás viendo {nombreVista}. Elige una sede específica arriba (en el menú) para poder tomar un pedido — en modo consolidado no hay a dónde atribuirlo.
        </div>
      )}
      {showForm && !esConsolidado && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-4 space-y-3">
          {terminados.length === 0 ? (
            <p className="text-sm text-stone-500">No hay productos Terminado/En proceso en el catálogo todavía.</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Cliente</label>
                <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre de la empresa o persona"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Producto a fabricar</label>
                <SelectorProducto productos={terminados} value={productoId} onChange={setProductoId} />
                {producto && (!producto.receta || producto.receta.length === 0) && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Este producto no tiene Ficha técnica todavía — defínela primero en esa pestaña.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Cantidad</label>
                  <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Precio cotizado (S/, total)</label>
                  <input type="number" min="0" step="0.5" value={precioCotizado} onChange={(e) => setPrecioCotizado(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Fecha de entrega</label>
                  <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>

              {productoId && (
                <div className="border-t border-stone-100 pt-3">
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Operaciones de producción {modeloTieneOperaciones ? "" : <span className="text-red-600">*</span>}
                  </label>
                  {modeloTieneOperaciones ? (
                    <>
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {operacionesModelo.map((op) => (
                          <span key={op} className="px-2.5 py-1 rounded-full bg-stone-100 text-xs font-medium text-stone-600">{op}</span>
                        ))}
                      </div>
                      <p className="text-xs text-stone-400">
                        Ya definidas para el modelo {producto?.codigo} — se usan igual en todos sus pedidos.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-stone-500 mb-2">
                        Este modelo todavía no tiene operaciones definidas. Escríbelas en orden (ej. Corte, Costura, Acabado) — quedan guardadas para siempre en el modelo {producto?.codigo}.
                      </p>
                      {operacionesTemp.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {operacionesTemp.map((op, i) => (
                            <span key={op} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-xs font-medium text-stone-700">
                              <span className="text-stone-400">{i + 1}.</span> {op}
                              <button type="button" onClick={() => quitarOperacionTemp(op)} className="text-stone-400 hover:text-red-600">
                                <XCircle size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          value={nuevaOperacion}
                          onChange={(e) => setNuevaOperacion(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarOperacionTemp(); } }}
                          placeholder="Ej: Corte"
                          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <button type="button" onClick={agregarOperacionTemp}
                          className="px-3 py-2 rounded-lg border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1">
                          <Plus size={14} /> Agregar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <XCircle size={14} /> {error}
                </p>
              )}

              <button type="button" onClick={handleCrear} disabled={enviando}
                className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition">
                {enviando ? "Guardando..." : "Registrar pedido"}
              </button>
              <p className="text-xs text-stone-400">Tomar el pedido todavía no descuenta materia prima — eso pasa recién cuando termines todas sus operaciones (queda "Listo para entregar"). La entrega y el pago se registran aparte, con el botón "Entregar".</p>
            </>
          )}
        </div>
      )}

      {pendientes.length === 0 ? (
        <p className="text-sm text-stone-400 py-6 text-center">No hay pedidos pendientes.</p>
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-4 py-2 border-b border-stone-200">
            <span className="text-sm font-semibold text-stone-700">Pendientes ({pendientes.length}) — ordenados por fecha de entrega más próxima</span>
          </div>
          <div className="divide-y divide-stone-100">
            {pendientes.map((p) => {
              const dias = diasHasta(p.fechaEntrega);
              const urgente = dias <= 3;
              const vencido = dias < 0;
              const ops = p.operaciones || [];
              const hechas = p.operacionesCompletadas || [];
              const avance = ops.length > 0 ? Math.round((hechas.length / ops.length) * 100) : 0;
              return (
                <div key={p.id} className="px-4 py-3 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800">
                        {p.cliente}
                        {esConsolidado && <span className="ml-2 text-xs font-normal text-stone-400">· {NOMBRE_UBICACION[p.ubicacion] || NOMBRE_UBICACION.sumaj_illari}</span>}
                      </p>
                      <p className="text-xs text-stone-500">
                        {p.producto}{p.talla !== "Única" ? ` - ${p.talla}` : ""} · {p.cantidad} unid. · Entrega: {formatFecha(p.fechaEntrega)}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                      vencido ? "bg-red-100 text-red-700" : urgente ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"
                    }`}>
                      {vencido ? `Vencido hace ${Math.abs(dias)}d` : dias === 0 ? "Entrega hoy" : `Faltan ${dias}d`}
                    </span>
                  </div>

                  {p.etapa === "Listo" ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> Listo para entregar — costo de producción: {formatSoles(p.costoProduccion)}
                      </p>
                      {entregandoId === p.id ? (
                        <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-medium text-stone-600">Forma de pago (total: {formatSoles(p.precioCotizado)})</p>
                          <div className="grid grid-cols-3 gap-2">
                            <input type="number" min="0" placeholder="Efectivo" value={pagoEfectivo} onChange={(e) => setPagoEfectivo(e.target.value)}
                              className="px-2 py-1.5 rounded border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                            <input type="number" min="0" placeholder="Yape" value={pagoYape} onChange={(e) => setPagoYape(e.target.value)}
                              className="px-2 py-1.5 rounded border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                            <input type="number" min="0" placeholder="Tarjeta" value={pagoTarjeta} onChange={(e) => setPagoTarjeta(e.target.value)}
                              className="px-2 py-1.5 rounded border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                          </div>
                          {errorEntrega && (
                            <p className="text-xs text-red-600 flex items-center gap-1.5">
                              <XCircle size={12} /> {errorEntrega}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button type="button" onClick={() => confirmarEntrega(p)} disabled={enviandoEntrega}
                              className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 transition">
                              {enviandoEntrega ? "Entregando..." : "Confirmar entrega"}
                            </button>
                            <button type="button" onClick={() => setEntregandoId(null)} disabled={enviandoEntrega}
                              className="px-3 py-2 rounded-lg border border-stone-300 text-xs font-medium text-stone-600 hover:bg-stone-50 transition">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => abrirEntrega(p)}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition">
                          Entregar
                        </button>
                      )}
                    </div>
                  ) : ops.length > 0 && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${avance}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-stone-600 shrink-0 w-20 text-right">
                          {hechas.length}/{ops.length} · {avance}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ops.map((op) => {
                          const hecha = hechas.includes(op);
                          const cargando = togglingId === p.id + op;
                          return (
                            <button
                              key={op}
                              onClick={() => toggleOperacion(p, op)}
                              disabled={cargando || completandoId === p.id}
                              title={hecha ? "Marcada — clic para desmarcar" : "Marcar como completada"}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition disabled:opacity-50 ${
                                hecha
                                  ? "bg-teal-50 border-teal-300 text-teal-700"
                                  : "bg-white border-stone-300 text-stone-600 hover:bg-stone-50"
                              }`}
                            >
                              {hecha ? <CheckCircle2 size={13} /> : <span className="w-3 h-3 rounded-full border border-stone-400 inline-block" />}
                              {op}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-stone-400">
                        Al marcar la última operación, el pedido consume la materia prima y queda "Listo para entregar" — la venta se registra aparte, al entregarlo.
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entregados.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-4 py-2 border-b border-stone-200">
            <span className="text-sm font-semibold text-stone-700">Entregados</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-stone-500 border-b border-stone-100">
                  {esConsolidado && <th className="text-left px-4 py-1.5 font-medium">Sede</th>}
                  <th className="text-left px-4 py-1.5 font-medium">Cliente</th>
                  <th className="text-left px-4 py-1.5 font-medium">Producto</th>
                  <th className="text-right px-4 py-1.5 font-medium">Cant.</th>
                  <th className="text-right px-4 py-1.5 font-medium">Precio cotizado</th>
                  {rol === "gerente" && <th className="text-right px-4 py-1.5 font-medium">Margen</th>}
                </tr>
              </thead>
              <tbody>
                {entregados.map((p) => (
                  <tr key={p.id} className="border-b border-stone-50 last:border-0">
                    {esConsolidado && <td className="px-4 py-1.5 text-stone-500">{NOMBRE_UBICACION[p.ubicacion] || NOMBRE_UBICACION.sumaj_illari}</td>}
                    <td className="px-4 py-1.5 text-stone-800 inline-flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-green-600" /> {p.cliente}
                    </td>
                    <td className="px-4 py-1.5 text-stone-600">{p.producto}{p.talla !== "Única" ? ` - ${p.talla}` : ""}</td>
                    <td className="px-4 py-1.5 text-right text-stone-700">{p.cantidad}</td>
                    <td className="px-4 py-1.5 text-right font-semibold text-stone-900">{formatSoles(p.precioCotizado)}</td>
                    {rol === "gerente" && (
                      <td className={`px-4 py-1.5 text-right font-semibold ${p.margen >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {formatSoles(p.margen)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
