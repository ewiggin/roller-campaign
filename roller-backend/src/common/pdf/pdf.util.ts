import pdfMake from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

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

export async function createPdfBuffer(
  docDefinition: TDocumentDefinitions,
): Promise<Buffer> {
  const doc = pdfMake.createPdf({
    pageMargins: [40, 50, 40, 50],
    defaultStyle: PDF_DEFAULT_STYLE,
    ...docDefinition,
  });
  return doc.getBuffer();
}
