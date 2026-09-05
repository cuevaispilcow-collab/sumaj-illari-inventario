// Este archivo reemplaza el guardado local (window.storage) por
// Firestore: una base de datos en la nube compartida por todos
// los que usan la app, en tiempo real.
import { doc, onSnapshot, setDoc } from "firebase/firestore";
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
