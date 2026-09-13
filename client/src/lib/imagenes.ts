/** Lo más ancho o alto que se guarda. Alcanza de sobra para una tarjeta de
 *  producto, incluso en una pantalla de celular con mucha densidad. */
const LADO_MAXIMO = 1400;
const CALIDAD = 0.8;

const leerComoDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** createImageBitmap respeta la orientación EXIF; sin eso, una foto sacada con
 *  el celular de costado se guarda rotada. */
const decodificar = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Safari viejo no soporta la opción: se sigue por el camino de abajo.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

const aBlob = (canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, tipo, CALIDAD));

/**
 * Achica y recomprime una foto antes de guardarla.
 *
 * Las imágenes se guardan en base64 dentro de la propia fila del producto, así
 * que lo que pesa acá pesa en la base, en cada backup y en cada pantalla que
 * las lea. Una foto de celular de 3 MB queda en unos 150 KB sin diferencia
 * visible en pantalla.
 *
 * Si algo falla —un formato que el navegador no sabe decodificar, un canvas que
 * no larga el blob— devuelve el archivo tal cual: es preferible guardar una
 * foto pesada a no poder guardarla.
 */
export async function comprimirImagen(file: File): Promise<string> {
  try {
    const original = await leerComoDataUrl(file);
    const imagen = await decodificar(file);

    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(imagen.width * escala);
    canvas.height = Math.round(imagen.height * escala);

    const ctx = canvas.getContext('2d');
    if (!ctx) return original;

    // Un PNG con transparencia recomprimido a webp la mantiene, pero si el
    // navegador cae en JPEG el fondo transparente se vuelve negro.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagen as CanvasImageSource, 0, 0, canvas.width, canvas.height);

    const blob = (await aBlob(canvas, 'image/webp')) ?? (await aBlob(canvas, 'image/jpeg'));
    if (!blob) return original;

    // Una foto ya chica y bien comprimida puede engordar al recomprimirla.
    if (blob.size >= file.size) return original;

    return await leerComoDataUrl(blob);
  } catch {
    return leerComoDataUrl(file);
  }
}
