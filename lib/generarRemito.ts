import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const MM_TO_PT = 2.83465;
export const PAGE_WIDTH_MM = 191;
export const PAGE_HEIGHT_MM = 292;

export interface RemitoItem {
  cantidad: number | string;
  detalle: string;
}

export interface ClienteData {
  nombre: string;
  domicilio: string;
  localidad: string;
  cuit: string;
  iva: 'Resp. Inscripto' | 'Monotributo' | 'Consumidor Final' | string;
}

export interface TransporteData {
  empresa: string;
  cuit: string;
  domicilio: string;
  camion: string;
  patente: string;
  chofer: string;
  dni: string;
}

export interface RemitoData {
  numeroRemito: string;
  fecha: string | Date; // Format: "YYYY-MM-DD", Date object or other parseable string
  cliente: ClienteData;
  condicionVenta: 'Contado' | 'Tarjeta' | 'Cta. Cte.' | string;
  productos: RemitoItem[];
  transporte: TransporteData;
}

export interface RemitoOptions {
  /** Offsets in millimeters for printer calibration */
  globalOffsetX?: number;
  globalOffsetY?: number;
  /** Default font size for drawing text */
  fontSize?: number;
}

/**
 * Validates whether the current date exceeds the C.A.I. expiration date (09/03/2027)
 * and logs a warning if it has expired.
 */
function validarVencimientoCAI() {
  const CAI_EXPIRATION_DATE = new Date('2027-03-09T23:59:59');
  const currentDate = new Date();

  if (currentDate > CAI_EXPIRATION_DATE) {
    console.warn(
      `[AVISO DE CONTROL] El C.A.I. del remito se encuentra vencido (Fecha límite: 09/03/2027).`
    );
  }
}

/**
 * Converts millimeter coordinates from top-left origin to PDF points from bottom-left origin.
 */
function convertCoords(
  xMm: number,
  yMm: number,
  offsetX = 0,
  offsetY = 0
): { x: number; y: number } {
  const finalXMm = xMm + offsetX;
  const finalYMm = yMm + offsetY;

  // pdf-lib origin is bottom-left. We subtract finalYMm from total height to invert.
  const pdfX = finalXMm * MM_TO_PT;
  const pdfY = (PAGE_HEIGHT_MM - finalYMm) * MM_TO_PT;

  return { x: pdfX, y: pdfY };
}

/**
 * Generates a transparent PDF with text absolutely positioned for printing on a physical pre-printed remito.
 * Returns a Uint8Array of the generated PDF bytes.
 * 
 * @param data Remito data
 * @param options Configuration options including global offsets in mm.
 */
export async function GenerarRemito(
  data: RemitoData,
  options: RemitoOptions = {}
): Promise<Uint8Array> {
  // 1. Validate C.A.I expiration
  validarVencimientoCAI();

  const {
    globalOffsetX = 0,
    globalOffsetY = 0,
    fontSize = 10,
  } = options;

  // 2. Create a new PDFDocument
  const pdfDoc = await PDFDocument.create();

  // 3. Embed standard font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 4. Add page with custom dimensions (Width: 191mm, Height: 292mm)
  const pageWidthPts = PAGE_WIDTH_MM * MM_TO_PT;
  const pageHeightPts = PAGE_HEIGHT_MM * MM_TO_PT;
  const page = pdfDoc.addPage([pageWidthPts, pageHeightPts]);

  // Since there's no drawRectangle or drawPage background, the PDF is transparent (just the text commands are written)

  // Utility function to draw text using top-left mm coordinates
  const drawText = (
    text: string | undefined | null,
    xMm: number,
    yMm: number,
    opt: { size?: number; isBold?: boolean } = {}
  ) => {
    if (!text) return;
    const { x, y } = convertCoords(xMm, yMm, globalOffsetX, globalOffsetY);
    page.drawText(text, {
      x,
      y,
      size: opt.size ?? fontSize,
      font: opt.isBold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
  };

  // 5. Parse Fecha
  let dia = '';
  let mes = '';
  let anio = '';
  try {
    const dateObj = data.fecha instanceof Date ? data.fecha : new Date(data.fecha);
    if (!isNaN(dateObj.getTime())) {
      // Format in local/Argentina time or get UTC/generic values
      // To be safe with string dates ("YYYY-MM-DD"), let's parse carefully.
      if (typeof data.fecha === 'string' && data.fecha.includes('-')) {
        const parts = data.fecha.split('-');
        if (parts.length === 3) {
          dia = parts[2].substring(0, 2);
          mes = parts[1];
          anio = parts[0];
        }
      } else {
        dia = String(dateObj.getDate()).padStart(2, '0');
        mes = String(dateObj.getMonth() + 1).padStart(2, '0');
        anio = String(dateObj.getFullYear());
      }
    }
  } catch (e) {
    console.error('Error parseando fecha para remito:', e);
  }

  // 6. Draw Data Fields

  // * N° Remito: (135, 32) mm
  drawText(data.numeroRemito, 135, 32, { isBold: true, size: fontSize + 2 });

  // * Fecha (Día, Mes, Año): (145, 45), (160, 45), (175, 45) mm
  drawText(dia, 145, 45);
  drawText(mes, 160, 45);
  drawText(anio, 175, 45);

  // * Señor/es: (38, 74) mm
  drawText(data.cliente.nombre, 38, 74);

  // * Domicilio: (38, 82) mm
  drawText(data.cliente.domicilio, 38, 82);

  // * Localidad: (38, 90) mm
  drawText(data.cliente.localidad, 38, 90);

  // C.U.I.T. Cliente: (50, 107) mm
  drawText(data.cliente.cuit, 50, 107);

  // IVA (Checkboxes 'X'): Resp. Inscripto (22, 125); Monotributo (78, 125); Consumidor Final (165, 125) mm
  const ivaNormalized = (data.cliente.iva || '').trim().toLowerCase();
  if (ivaNormalized.includes('inscripto')) {
    drawText('X', 22, 125, { isBold: true });
  } else if (ivaNormalized.includes('monotributo')) {
    drawText('X', 78, 125, { isBold: true });
  } else if (ivaNormalized.includes('consumidor final') || ivaNormalized.includes('final')) {
    drawText('X', 165, 125, { isBold: true });
  }

  // Condiciones Venta: Contado (42, 133); Tarjeta (70, 133); Cta. Cte. (105, 133) mm
  const condicionVentaNormalized = (data.condicionVenta || '').trim().toLowerCase();
  if (condicionVentaNormalized.includes('contado')) {
    drawText('X', 42, 133, { isBold: true });
  } else if (condicionVentaNormalized.includes('tarjeta')) {
    drawText('X', 70, 133, { isBold: true });
  } else if (
    condicionVentaNormalized.includes('cta') ||
    condicionVentaNormalized.includes('cte') ||
    condicionVentaNormalized.includes('corriente')
  ) {
    drawText('X', 105, 133, { isBold: true });
  }

  // Tabla de Productos:
  // * Cantidad (X: 12 mm, Y inicial: 158 mm)
  // * Detalle (X: 40 mm, Y inicial: 158 mm)
  // Interlineado: 8.2 mm
  const INITIAL_Y_PROD = 158;
  const INTERLINEADO_PROD = 8.2;
  
  // Limit items to 8 rows to prevent spilling over the Transport section (starts at 230mm)
  const itemsToDraw = data.productos.slice(0, 8);
  
  itemsToDraw.forEach((prod, index) => {
    const rowY = INITIAL_Y_PROD + (index * INTERLINEADO_PROD);
    drawText(String(prod.cantidad), 12, rowY);
    drawText(prod.detalle, 40, rowY);
  });

  if (data.productos.length > 8) {
    console.warn(`[AVISO] El remito contiene ${data.productos.length} productos, pero la plantilla física solo tiene espacio visual seguro para 8 filas. Se han dibujado los primeros 8.`);
  }

  // Sección Transporte:
  // * Empresa/CUIT: (40, 230) / (145, 230) mm
  drawText(data.transporte.empresa, 40, 230);
  drawText(data.transporte.cuit, 145, 230);

  // * Domicilio: (40, 238) mm
  drawText(data.transporte.domicilio, 40, 238);

  // * Camión/Patentes: (45, 246) / (145, 254) mm
  // Note: prompt said (45, 246) for camion and (145, 254) for patente. Check if they are on the same row or separate
  drawText(data.transporte.camion, 45, 246);
  drawText(data.transporte.patente, 145, 254); // As specified: 254mm for patente

  // * Chofer/DNI: (40, 262) / (145, 262) mm
  drawText(data.transporte.chofer, 40, 262);
  drawText(data.transporte.dni, 145, 262);

  // 7. Serialize the PDFDocument to bytes
  return await pdfDoc.save();
}
