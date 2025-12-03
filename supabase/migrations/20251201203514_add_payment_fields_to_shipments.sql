-- Add payment-related fields to shipments table
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'expired', 'failed')),
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Create index on payment_status for faster queries
CREATE INDEX IF NOT EXISTS idx_shipments_payment_status ON shipments(payment_status);

-- Create index on stripe_payment_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_shipments_stripe_payment_id ON shipments(stripe_payment_id);

-- Add comment to columns
COMMENT ON COLUMN shipments.payment_status IS 'Payment status: unpaid, pending, paid, expired, failed';
COMMENT ON COLUMN shipments.stripe_session_id IS 'Stripe checkout session ID';
COMMENT ON COLUMN shipments.stripe_payment_id IS 'Stripe payment intent ID';
COMMENT ON COLUMN shipments.paid_at IS 'Timestamp when payment was completed';
