# Group Fund Manager

A free web app for a small group's common fund (₹200/month each): contributions, loans, repayments, expenses and a live balance. It can sync fund data through Supabase.

## Run locally
Open `index.html` in a browser, or for PWA install testing run `python3 -m http.server 8000` in this folder and visit http://localhost:8000.

## Deploy free (GitHub Pages)
1. Create a GitHub repository and upload all files in this folder.
2. Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Open the URL GitHub shows. On a phone: Share/Menu → "Add to Home Screen" to install it.
(Cloudflare Pages works the same: connect the repo, no build command, output directory `/`.)
After Pages is enabled, pushes to `main` trigger a deployment. Allow the Pages build to finish before checking the live site.

## Using it
- **Members**: add 6–10 (or more) people; rename or set inactive without losing history.
- **+ Add**: pick Contribution, Loan given, Loan repayment or Group expense. Partial contributions are allowed; a member is "Paid" once the month's total reaches the required amount.
- **Transactions**: search and filter by type, member, month, date range; edit or delete (with confirmation). Every balance is recalculated from the records.
- **Loans**: outstanding per member. Repayments can't exceed what's owed; loans and expenses can't exceed available cash.
- **Settings**: opening balance, contribution amount (applies from a chosen month onward), backups, sample data, reset.

## Supabase setup
1. Create a Supabase project and copy its Project URL and **publishable key**.
2. Put them in `supabase-config.js` as `url` and `publishableKey`. Never use a `service_role` or secret key in this browser app.
3. Run `supabase/setup.sql` against the project database (for example, through the Supabase MCP SQL tools or the Supabase SQL Editor).
4. In Supabase Authentication, create the admin's email/password user. In the SQL Editor, grant that account the admin claim (replace the email):

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
     || '{"fund_role":"admin"}'::jsonb
   where email = 'admin@example.com';
   ```

   Sign in to the app with that account after assigning the claim. The admin claim is stored in trusted `app_metadata`; ordinary users cannot grant it to themselves. Existing sessions must sign out and back in to receive a changed claim.
5. Serve or deploy the app over HTTP(S). The app connects to the shared Supabase row and keeps a local browser cache.

When the shared table is empty, the first admin browser with existing local records copies them to Supabase. Otherwise, the existing shared records are loaded. Version checks detect conflicting simultaneous edits; reload the app to get the latest shared data after a conflict. Export backups regularly.

## Security and shared access
The dashboard is publicly readable without sign-in. Only signed-in users whose trusted Supabase `app_metadata.fund_role` is `admin` can insert or update fund data. Row Level Security enforces this even if a visitor bypasses the app interface. No client role can delete the shared row. Because dashboard data is public, do not store sensitive personal information. The publishable key is designed for client-side use; never expose a service-role or secret key.

## Supabase MCP in VS Code
The project includes `.vscode/mcp.json` for the hosted Supabase MCP server. Authenticate with Supabase in VS Code, then reload the MCP server/session to make its tools available. For least privilege, scope the connection to your project using its project reference in the MCP URL. The MCP server is for database setup/admin; the deployed app connects using the project URL and publishable key.

## Backup / restore
Settings → Export Backup (JSON) downloads everything. **Restore Backup** validates the file, asks for confirmation, then replaces current records. Export CSV opens in Excel.

## Files
`index.html`, `styles.css`, `app.js`, `supabase-config.js`, `supabase/setup.sql`, `manifest.json`, `sw.js` (offline cache), `icon-192.png`, `icon-512.png`.
