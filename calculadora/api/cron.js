// api/cron.js
import admin from "firebase-admin";

// Inicializar Firebase Admin (Servidor)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Reemplazamos los saltos de línea de la clave privada
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    // 1. Obtener todas las skins
    const skinsSnap = await db.collection("skins").get();
    const updates = [];

    // 2. Iterar skins y buscar precio
    for (const doc of skinsSnap.docs) {
      const skin = doc.data();
      const skinId = doc.id;
      
      const encodedName = encodeURIComponent(skin.hash);
      const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=3&market_hash_name=${encodedName}`;
      
      try {
        const steamRes = await fetch(url);
        const data = await steamRes.json();

        if (data.lowest_price) {
            // Limpiar precio (ej: "1,20€" -> 1.20)
            const priceNum = parseFloat(data.lowest_price.replace(/[^\d,.-]/g, '').replace(',', '.'));
            
            // Guardar en la subcolección 'history'
            const addPromise = db.collection("skins").doc(skinId).collection("history").add({
                price: priceNum,
                date: admin.firestore.Timestamp.now()
            });
            updates.push(addPromise);
        }
      } catch (err) {
        console.error(`Error fetching ${skin.hash}`, err);
      }

      // Pausa de 2 segundos para evitar bloqueos de Steam
      await new Promise(r => setTimeout(r, 2000));
    }

    await Promise.all(updates);
    res.status(200).json({ success: true, updated: updates.length });
  } catch (error) {
    console.error("Error en el cron:", error);
    res.status(500).json({ error: error.message });
  }
}
