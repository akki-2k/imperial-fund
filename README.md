# Group Fund Manager

A free, no-backend web app for a small group's common fund (₹200/month each): contributions, loans, repayments, expenses and a live balance. No login, no external services; nothing leaves your device.

## Run locally
Open `index.html` in a browser, or for PWA install testing run `python3 -m http.server 8000` in this folder and visit http://localhost:8000.

## Deploy free (GitHub Pages)
1. Create a GitHub repository and upload all files in this folder.
2. Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Open the URL GitHub shows. On a phone: Share/Menu → "Add to Home Screen" to install it.
(Cloudflare Pages works the same: connect the repo, no build command, output directory `/`.)

## Using it
- **Members**: add 6–10 (or more) people; rename or set inactive without losing history.
- **+ Add**: pick Contribution, Loan given, Loan repayment or Group expense. Partial contributions are allowed; a member is "Paid" once the month's total reaches the required amount.
- **Transactions**: search and filter by type, member, month, date range; edit or delete (with confirmation). Every balance is recalculated from the records.
- **Loans**: outstanding per member. Repayments can't exceed what's owed; loans and expenses can't exceed available cash.
- **Settings**: opening balance, contribution amount (applies from a chosen month onward), backups, sample data, reset.

## Important: data lives in one browser
Records are stored in this browser's localStorage on this device. They do **not** sync between phones, and clearing browser data, losing the phone or switching browsers deletes them. Use **Export Backup** regularly (e.g. after each monthly meeting) and share the JSON file with the group. **Restore Backup** loads it on any device. Pick one person's phone as the "keeper" of the fund.

## Backup / restore
Settings → Export Backup (JSON) downloads everything. Settings → Restore Backup validates the file, asks for confirmation, then replaces current records. Export CSV opens in Excel.

## Later: shared sync
All storage goes through the small `Store` object in `app.js` (`load`/`save`). Replace it with a free shared database (e.g. Firebase or Supabase free tier) to sync devices.

## Files
`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js` (offline cache), `icon-192.png`, `icon-512.png`.
