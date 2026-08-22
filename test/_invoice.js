// Extracción canónica que corresponde a fixtures/ocr-invoice-clean.json.
// Los números CIERRAN: 58200 + 243000 + 47412 = 348612; *0.21 = 73208.52;
// suma = 421820.52. Compartido por los tests de T-15 a T-20.
export const INVOICE = {
  invoiceNumber: 'FA-2026-00417',
  issueDate: '2026-08-03',
  dueDate: '2026-09-02',
  supplierName: 'Insumos Patagonia SRL',
  supplierTaxId: '30-71455892-4',
  currency: 'ARS',
  lineItems: [
    { description: 'Resma A4 80g x10', quantity: 12, unitPrice: 4850, amount: 58200 },
    { description: 'Toner HP 26A', quantity: 2, unitPrice: 121500, amount: 243000 },
    { description: 'Cinta embalaje 48mm', quantity: 24, unitPrice: 1975.5, amount: 47412 },
  ],
  subtotal: 348612,
  taxRate: 0.21,
  taxAmount: 73208.52,
  total: 421820.52,
};
export const TODAY = '2026-08-22';
