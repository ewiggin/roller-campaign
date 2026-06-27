import pdfMake from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { EVENT_LOGO_BASE64 } from './event-logo-data';

pdfMake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});
// No remote/local resources are ever referenced from generated documents.
pdfMake.setUrlAccessPolicy(() => false);
pdfMake.setLocalAccessPolicy(() => true);

export const PDF_DEFAULT_STYLE = {
  font: 'Helvetica',
  fontSize: 9,
};

const HEADER_TITLE = 'Campaña «Los carritos se van de vacaciones 2026»';

export function buildScheduleHeader(
  regionName?: string | null,
): TDocumentDefinitions['header'] {
  const titleStack: Content[] = [
    { text: HEADER_TITLE, fontSize: 10, bold: true, color: '#000000' },
  ];
  if (regionName) {
    titleStack.push({
      text: regionName,
      fontSize: 8,
      color: '#666666',
      margin: [0, 2, 0, 0],
    });
  }

  return (): Content =>
    ({
      stack: [
        {
          columns: [
            { image: EVENT_LOGO_BASE64, width: 32, height: 32 },
            { width: '*', stack: titleStack, margin: [10, 6, 0, 0] },
          ],
          margin: [40, 8, 40, 0],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#cccccc',
            },
          ],
          margin: [40, 6, 40, 0],
        },
      ],
    }) as Content;
}

export async function createPdfBuffer(
  docDefinition: TDocumentDefinitions,
): Promise<Buffer> {
  const doc = pdfMake.createPdf({
    pageMargins: [40, 62, 40, 50],
    defaultStyle: PDF_DEFAULT_STYLE,
    ...docDefinition,
  });
  return doc.getBuffer();
}
