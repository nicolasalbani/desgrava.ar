-- Align InvoiceType enum with SiRADIG's actual comprobante types.
-- SiRADIG does not accept type A comprobantes or generic RECIBO/TICKET.

-- Step 1: Migrate existing data from removed types to their B equivalents (using text column)
ALTER TABLE "Invoice" ALTER COLUMN "invoiceType" TYPE text;

UPDATE "Invoice" SET "invoiceType" = 'FACTURA_B' WHERE "invoiceType" = 'FACTURA_A';
UPDATE "Invoice" SET "invoiceType" = 'NOTA_DEBITO_B' WHERE "invoiceType" = 'NOTA_DEBITO_A';
UPDATE "Invoice" SET "invoiceType" = 'NOTA_CREDITO_B' WHERE "invoiceType" = 'NOTA_CREDITO_A';
UPDATE "Invoice" SET "invoiceType" = 'RECIBO_B' WHERE "invoiceType" = 'RECIBO';
UPDATE "Invoice" SET "invoiceType" = 'TIQUE_FACTURA_B' WHERE "invoiceType" = 'TICKET';

-- Step 2: Drop old enum and create new one
DROP TYPE "InvoiceType";

CREATE TYPE "InvoiceType" AS ENUM (
  'FACTURA_B',
  'FACTURA_C',
  'NOTA_DEBITO_B',
  'NOTA_DEBITO_C',
  'NOTA_CREDITO_B',
  'NOTA_CREDITO_C',
  'RECIBO_B',
  'RECIBO_C',
  'NOTA_VENTA_B',
  'NOTA_VENTA_C',
  'DOCUMENTO_ADUANERO',
  'OTRO_COMPROBANTE_B',
  'OTRO_COMPROBANTE_C',
  'TIQUE_FACTURA_B',
  'OTROS_EXCEPTUADOS'
);

-- Step 3: Convert column back to enum
ALTER TABLE "Invoice" ALTER COLUMN "invoiceType" TYPE "InvoiceType" USING "invoiceType"::"InvoiceType";
