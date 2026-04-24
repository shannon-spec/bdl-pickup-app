# BDL Pickup App

Static React app (loaded via CDN) for BDL pickup management.

## Files
- `index.html` — main pickup app (entry point)
- `bdl-pickup-app.html` — original copy of the app
- `bdl-logo-options.html` — logo options page (`/bdl-logo-options.html`)

## Local development
Open `index.html` directly in a browser, or run a local server:
```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy
Pushes to `main` auto-deploy via Vercel.

## Super Admin credential emails
The `/api/send-admin-credentials` Vercel Function sends login credentials to new Super Admins via [Resend](https://resend.com).

Set these environment variables in your Vercel project (Settings → Environment Variables):

- `RESEND_API_KEY` — create at https://resend.com/api-keys
- `ADMIN_FROM_EMAIL` — verified sender, e.g. `BDL Pickup <admin@yourdomain.com>` (the domain must be verified in Resend)
- `ADMIN_ALLOWED_ORIGIN` *(optional)* — lock the endpoint to a single origin, e.g. `https://bdl.example.com`

To test locally with `vercel dev`, mirror the same keys into `.env.local`.
