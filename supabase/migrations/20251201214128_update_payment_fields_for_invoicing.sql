-- Update payment_status to include invoicing statuses
ALTER TABLE shipments
DROP CONSTRAINT IF EXISTS shipments_payment_status_check;

ALTER TABLE shipments
ADD CONSTRAINT shipments_payment_status_check
CHECK (payment_status IN ('unpaid', 'pending', 'invoiced', 'paid', 'expired', 'failed', 'payment_failed', 'voided', 'uncollectible'));

-- Add invoice and customer tracking fields
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create index on stripe_invoice_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_shipments_stripe_invoice_id ON shipments(stripe_invoice_id);

-- Create index on stripe_customer_id for customer queries
CREATE INDEX IF NOT EXISTS idx_shipments_stripe_customer_id ON shipments(stripe_customer_id);

-- Add comments
COMMENT ON COLUMN shipments.stripe_invoice_id IS 'Stripe invoice ID for CSC billing';
COMMENT ON COLUMN shipments.stripe_customer_id IS 'Stripe customer ID';
COMMENT ON COLUMN shipments.payment_status IS 'Payment status: unpaid, pending, invoiced, paid, expired, failed, payment_failed, voided, uncollectible';
