# Repository guide

Read [Development](docs/development.md) for setup, architecture, checks, and deployment. Read [Sharing and storage](docs/sharing.md) before changing URL handling, share payloads, imports, or persistence.

Keep `README.md` a short end-user introduction and guide with links to the detailed docs. Put technical instructions and product contracts under `docs`. Do not use the README for plans, agent notes, work logs, or test transcripts.

This is a single-user app. Remove unsupported old formats and purge obsolete data instead of building migrations.

Do not use harness memory. Keep durable project context in source-controlled documentation. Commit changes unless the user asks otherwise.
