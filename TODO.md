# Work Log (Sanitized)

- Fix client PDF export therapy field fallback in `js/customer-dashboard.js`.
- Delete example customers and associated attendance via therapist API.
- Add startup log to show active MongoDB database name.
- Remove hardcoded Atlas credentials from `server.js`.
- Use environment variable `MONGODB_URI` with safe local fallback.
- Move admin seeding to `ADMIN_EMAIL`/`ADMIN_PASSWORD` env-based configuration.
- Investigate Atlas SRV DNS issue; recommend non-SRV URI when SRV blocked.

## Notes

- No secrets are stored in source code.
- Collections used: `users`, `attendances`.
