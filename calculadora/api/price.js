// api/price.js
export default async function handler(req, res) {
  const { skin } = req.query;

  if (!skin) {
    return res.status(400).json({ error: 'Falta el nombre de la skin' });
  }

  // Codificamos el nombre para que funcione en la URL (espacios, caracteres raros)
  const encodedSkin = encodeURIComponent(skin);
  
  try {
    // Llamamos a Steam desde el servidor (Aquí no hay CORS)
    const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=3&market_hash_name=${encodedSkin}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.lowest_price) {
      res.status(200).json(data);
    } else {
      res.status(404).json({ error: 'Skin no encontrada o sin precio' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error conectando con Steam' });
  }
}