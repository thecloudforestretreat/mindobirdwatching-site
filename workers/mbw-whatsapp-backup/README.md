Prepared only; this worker has not been deployed or scheduled. No phone connection is involved.

After the backup destination is approved, provision a private R2 bucket with public access disabled. Bind the existing inbox D1 database without creating or replacing it. Copy the example configuration to wrangler.jsonc and replace placeholders. Set BACKUP_PASSPHRASE as a Worker secret with at least 32 random characters. Keep a separate recovery copy outside Cloudflare; losing this secret makes these files unrecoverable. Do not commit it.

The scheduled job is designed for 11:30 UTC daily. It snapshots only wa_test_* tables in one D1 batch, validates and encrypts the snapshot, then retains 30 daily files and 12 first-of-month files. It performs no CRM writes or live message actions. The public fetch endpoint always returns 404. Configure failure notifications and verify the first hosted run before considering backups active. PBKDF2 encryption has a CPU cost: confirm the Worker plan/CPU limit supports it; the example CPU configuration requires a supporting plan and is not a promise of a zero-cost scheduler.

Recovery drill: download an encrypted file to a secure machine. Set MBW_BACKUP_PASSPHRASE in the environment without logging it, then run:

    node scripts/restore-whatsapp-test-backup.mjs downloaded-backup.json NEW-test-restore.sqlite

The restore script creates a separate SQLite database and refuses to overwrite an existing file. It never connects to Cloudflare or CRM. Promotion into a production database requires a separately reviewed restoration procedure.
