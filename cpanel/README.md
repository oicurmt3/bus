# cPanel (PHP) deployment

This folder is **not** included in the Cursor Apps publish bundle. Upload these files to your cPanel web root (for example `public_html/bus/`).

- `log_rating.php` — accepts POSTed ratings (rate-limited; no IP addresses stored in rating records).
- `public_ratings.php` — read-only JSON feed for the results page.
- `includes/` — shared helpers (block direct web access with server rules).

Create a sibling `data/` directory **outside** the public web root when possible, or use the repo `data/` folder with `.htaccess` denying HTTP access. Point `includes/sanitize.php` `cpanel_data_dir()` at that path if needed.

Use the main site `view_ratings.html` (loads `/api/ratings` on Cursor, or change its fetch URL to `public_ratings.php` on cPanel).
