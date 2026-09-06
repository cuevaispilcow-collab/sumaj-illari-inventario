// Este archivo reemplaza el guardado local (window.storage) por
// Firestore: una base de datos en la nube compartida por todos
// los que usan la app, en tiempo real.
import { doc, onSnapshot, setDoc, runTransaction } from "firebase/firestore";
import { db } from "./firebase.js";

// Escucha cambios en vivo en una colección/documento y llama a
// tu función `callback` cada vez que algo cambia (aunque el
// cambio venga de OTRO celular). Si hay un error (por ejemplo,
// permisos de Firestore), llama a `callback([])` de todas formas
// para que la app NUNCA se quede cargando para siempre, y avisa
// el error real por consola y con `onError` si se provee.
export function escucharColeccion(nombreDoc, callback, onError) {
  const ref = doc(db, "sumaj-illari", nombreDoc);
  return onSnapshot(
    ref,
    (snap) => {
      callback(snap.exists() ? snap.data().items : []);
    },
    (error) => {
      console.error("Error leyendo Firestore:", nombreDoc, error);
      if (onError) onError(error);
      callback([]);
    }
  );
}

// Guarda datos en la nube. Cualquier otro dispositivo con la
// app abierta lo recibe automáticamente por escucharColeccion.
export async function guardarColeccion(nombreDoc, items) {
  const ref = doc(db, "sumaj-illari", nombreDoc);
  await setDoc(ref, { items, actualizado: new Date().toISOString() });
}

// ============================================================
// Operación segura para cambios de stock (ventas, compras,
// movimientos, producción).
//
// Por qué existe: guardarColeccion() de arriba confía en los datos
// que el celular ya tenía cargados en pantalla. Si dos personas
// venden el mismo producto casi al mismo tiempo desde celulares
// distintos, ambas parten del mismo stock "viejo" y la segunda en
// guardar borra sin darse cuenta lo que hizo la primera.
//
// operarInventarioSeguro() evita esto usando una TRANSACCIÓN: justo
// antes de guardar, vuelve a leer el valor real que hay en ese
// instante en el servidor (no el de la pantalla), y si mientras
// tanto alguien más ya lo cambió, Firestore reintenta sola la
// operación con el dato correcto — automático, sin que la persona
// note nada, solo una fracción de segundo más de espera.
//
// `colecciones`: nombres de los documentos a leer y escribir juntos
// en una sola operación, ej. ["productos", "ventas", "movimientos"].
//
// `calcular(actuales)`: recibe los datos MÁS RECIENTES de cada
// colección (objeto { productos: [...], ventas: [...], ... }, según
// lo que hay en el servidor en ese preciso momento) y debe devolver
// ese mismo objeto con los arrays ya actualizados. Si algo no es
// válido (ej. no hay stock suficiente), debe lanzar un Error con un
// mensaje entendible — en ese caso no se guarda absolutamente nada.
export async function operarInventarioSeguro(colecciones, calcular) {
  const refs = Object.fromEntries(colecciones.map((c) => [c, doc(db, "sumaj-illari", c)]));

  return runTransaction(db, async (transaction) => {
    // Regla de Firestore: TODAS las lecturas de una transacción deben
    // hacerse antes que cualquier escritura.
    const entradas = await Promise.all(
      colecciones.map(async (c) => {
        const snap = await transaction.get(refs[c]);
        return [c, snap.exists() ? snap.data().items : []];
      })
    );
    const actuales = Object.fromEntries(entradas);

    const nuevos = calcular(actuales);

    for (const c of colecciones) {
      transaction.set(refs[c], { items: nuevos[c], actualizado: new Date().toISOString() });
    }
    return nuevos;
  });
}
