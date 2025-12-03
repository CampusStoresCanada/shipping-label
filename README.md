# CSC Conference Shipping Station

Browser-based shipping station app for CSC Conference (Jan 26-29, 2026) at Sheraton Fallsview, Niagara Falls.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.local.example` to `.env.local` and fill in your credentials

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── pages/
│   ├── index.tsx              # Main shipping station interface
│   ├── admin/
│   │   └── print-labels.tsx   # Admin dashboard for batch printing
│   └── api/
│       ├── lookup-contact.ts  # Supabase query by email
│       ├── create-shipment.ts # Purolator API + save to DB + email
│       └── save-account.ts    # Save new Purolator account to org
├── components/
│   ├── QRScanner.tsx          # Camera + jsQR integration
│   ├── AccountSelector.tsx    # Billing account selection UI
│   ├── AddressForm.tsx        # Address input/edit form
│   ├── BoxSelector.tsx        # Standard vs custom box
│   ├── ReviewConfirm.tsx      # Final review before submit
│   └── SuccessScreen.tsx      # Post-shipment confirmation
└── lib/
    ├── supabase.ts            # Supabase client setup
    ├── purolator.ts           # Purolator API wrapper
    ├── vcard-parser.ts        # Parse vCard from QR code
    └── email.ts               # Email notification helper
```

## User Flow

1. **QR Code Scan** - Scan conference badge QR code
2. **Database Lookup** - Auto-fill contact info from Supabase
3. **Billing Account** - Select CSC or institution account
4. **Destination Address** - Confirm/edit shipping address
5. **Box Selection** - Choose standard or custom box + weight
6. **Review & Confirm** - Final review before creating shipment
7. **Backend Processing** - Create Purolator shipment + save to DB + email notification
8. **Success Screen** - Display tracking number and label URL

## Next Steps

- [ ] Set up Supabase project and create database tables
- [ ] Build QRScanner component
- [ ] Implement step-by-step wizard UI
- [ ] Create API routes for contact lookup and shipment creation
- [ ] Integrate Purolator API
- [ ] Add email notifications
- [ ] Build admin dashboard for batch label printing
- [ ] Test on Chromebook
- [ ] Deploy to Vercel
