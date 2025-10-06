# Backend developer notes

Run these commands from the `backend/` folder:

Install dev and prod dependencies:

```powershell
npm ci
```

Run the dev server:

```powershell
npm run dev
```

Lint and format:

```powershell
npm run lint
npm run format
```

Run tests:

```powershell
npm test
```

Notes:
- We added ESLint and Prettier configs. Install dependencies before running lint/format.
- We added a logger (`logger.js`) using `pino`.
- We added a basic GitHub Actions workflow and Dependabot config.
- In production ensure `SESSION_SECRET` is set to a strong value.
