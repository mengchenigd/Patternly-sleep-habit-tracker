# Team trial deployment

Run `npm test` and the browser checklist below before publishing. Remote HTTPS deployment still needs verification on the selected host.

## Existing Codespaces

Upload the complete updated source, including `auth.js` and `database.js`; retain `public/` and `public/assets/` structure. Node.js 22.13+ is required. The forwarded HTTPS origin is derived from Codespaces environment variables; no manual server source patch is required.

Stop the old server. In the terminal, set an invitation code without recording its value in shell history:

```bash
read -s -p 'Team invitation code: ' INVITE_CODE
export INVITE_CODE
npm test
npm start
```

Give the code only to invited testers. Keep port 4173 Private until verification is complete. This version uses `data/patternly-users.sqlite`; the original `patternly.sqlite` stays untouched and is not assigned to an account. No automatic import is provided.

## Before sharing

- Create two accounts in separate browsers; save different values for the same date.
- Confirm each ordinary account sees only its own profile, goals and chart data; only the administrator can view/export all-account data.
- Log out; confirm browser navigation cannot reload account data without signing in.
- Verify an adopted suggestion, cycle check-in, profile editing and server restart.
- Confirm the forwarded HTTPS host permits saving and the session cookie is Secure and HttpOnly.

## Persistent host later

Use one Node.js instance with a persistent disk. Set `HOST=0.0.0.0`, `PORT`, `DB_PATH` on that disk, `NODE_ENV=production`, `APP_ORIGIN=https://your-exact-domain` (no trailing slash), and `INVITE_CODE` as a secret. HTTPS and the invitation code are mandatory in production. Do not put secrets or SQLite files in GitHub. Back up SQLite using a consistent SQLite backup/snapshot method rather than copying a live WAL database alone.

This is a team trial, not a completed production security review. No password recovery, email verification, account deletion, multi-instance coordination or automated backups are implemented. Login throttling is per connection address and process; behind a proxy teammates may share a throttle bucket. Database administrators can read stored habit data. All queries isolate accounts, but encryption at rest depends on the host.
