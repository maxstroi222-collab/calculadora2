// api/cron.js
const admin = require("firebase-admin");

// Inicializar Firebase Admin (Servidor)
// Usamos variables de entorno para no exponer las claves
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Reemplazamos los saltos de línea escapados (común en Vercel)
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Verificación básica de seguridad (opcional, Vercel protege los CRONs)
  // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) { ... }

  try {
    // 1. Obtener todas las skins
    const skinsSnap = await db.collection("skins").get();
    
    const updates = [];

    // 2. Iterar skins y buscar precio
    for (const doc of skinsSnap.docs) {
      const skin = doc.data();
      const skinId = doc.id;
      
      // Llamamos a Steam (con un pequeño delay para no ser bloqueados)
      const encodedName = encodeURIComponent(skin.hash);
      const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=3&market_hash_name=${encodedName}`;
      
      try {
        const steamRes = await fetch(url);
        const data = await steamRes.json();

        if (data.lowest_price) {
            // Limpiar precio (ej: "1,20€" -> 1.20)
            const priceNum = parseFloat(data.lowest_price.replace(/[^\d,.-]/g, '').replace(',','.'));
            
            // Guardar en la subcolección 'history' de esa skin
            // Usamos una promesa para esperar a que se guarde
            const addPromise = db.collection("skins").doc(skinId).collection("history").add({
                price: priceNum,
                date: admin.firestore.Timestamp.now()
            });
            updates.push(addPromise);
        }
      } catch (err) {
        console.error(`Error fetching ${skin.hash}`, err);
      }

      // Pequeña pausa de 2 segundos entre peticiones para Steam
      await new Promise(r => setTimeout(r, 2000));
    }

    await Promise.all(updates);
    res.status(200).json({ success: true, updated: updates.length });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}