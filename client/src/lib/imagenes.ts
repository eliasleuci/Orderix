/** Lo más ancho o alto que se guarda. Alcanza de sobra para una tarjeta de
 *  producto, incluso en una pantalla de celular con mucha densidad. */
const LADO_MAXIMO = 1400;
const CALIDAD = 0.8;

/** Miniatura para grillas (Catálogo y Venta), donde se ven muchos productos a
 *  la vez: no hace falta la foto de 1400px para un cuadradito de la lista. */
const LADO_MINIATURA = 300;
const CALIDAD_MINIATURA = 0.7;

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

const aBlob = (canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));

const redimensionar = (
  imagen: ImageBitmap | HTMLImageElement,
  ladoMaximo: number
): HTMLCanvasElement => {
  const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(imagen.width * escala);
  canvas.height = Math.round(imagen.height * escala);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Un PNG con transparencia recomprimido a webp la mantiene, pero si el
    // navegador cae en JPEG el fondo transparente se vuelve negro.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagen as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
};

const recomprimir = async (
  canvas: HTMLCanvasElement,
  original: string,
  originalSize: number,
  calidad: number
): Promise<string> => {
  const blob = (await aBlob(canvas, 'image/webp', calidad)) ?? (await aBlob(canvas, 'image/jpeg', calidad));
  if (!blob) return original;

  // Una foto ya chica y bien comprimida puede engordar al recomprimirla.
  if (blob.size >= originalSize) return original;

  return leerComoDataUrl(blob);
};

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
    const canvas = redimensionar(imagen, LADO_MAXIMO);
    return await recomprimir(canvas, original, file.size, CALIDAD);
  } catch {
    return leerComoDataUrl(file);
  }
}

/**
 * Genera, además de la foto completa, una miniatura chica para las grillas de
 * Catálogo y Venta: son las pantallas que muestran muchos productos a la vez,
 * y hoy bajan y renderizan la misma imagen de 1400px por cada uno.
 *
 * Decodifica el archivo una sola vez y lo reescala dos veces, para no pagar
 * dos lecturas del archivo original ni dos decodificaciones.
 */
export async function comprimirImagenYMiniatura(
  file: File
): Promise<{ imagen: string; miniatura: string }> {
  const imagen = await comprimirImagen(file);
  try {
    const original = await leerComoDataUrl(file);
    const bitmap = await decodificar(file);
    const canvas = redimensionar(bitmap, LADO_MINIATURA);
    const miniatura = await recomprimir(canvas, original, file.size, CALIDAD_MINIATURA);
    return { imagen, miniatura };
  } catch {
    // Sin miniatura no se rompe nada: la grilla cae de vuelta a la imagen completa.
    return { imagen, miniatura: imagen };
  }
}
