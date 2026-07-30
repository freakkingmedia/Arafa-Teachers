# Arafa Teachers ID Card

Teacher ID-card generator for Arafa English School.

Production domain: `https://arafa-teachers.vercel.app`

## Vercel deployment

1. Import the repository into the existing `arafa-teachers` Vercel project.
2. Set the project Root Directory to the folder containing this `package.json`.
3. Use the **Other** framework preset.
4. Leave the Build Command empty.
5. The Output Directory is configured as `public` in `vercel.json`.
6. Add these Production environment variables in Vercel:

   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET` (normally `id-card-pdfs`)

7. Redeploy the Production branch.

Vercel serves:

- `/` — teacher ID generator
- `/t` — QR-linked teacher details page
- `/api/create-pdf-upload` — creates signed Supabase upload URLs
- `/api/upload-health` — checks upload configuration

## Local development

```bash
npm start
```

Open `http://localhost:4173`.

QR codes always point to the permanent Vercel domain, including when cards are
generated locally.

## Security

Never commit `.env` files or the Supabase service-role key. The QR-linked page
shows the Aadhaar value encoded in the card QR, so access to a printed card also
grants access to those details.
