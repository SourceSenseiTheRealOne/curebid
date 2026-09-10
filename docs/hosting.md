# Hosting

Public testnet UI: https://curebid.vercel.app
Public repository: https://github.com/SourceSenseiTheRealOne/curebid

Vercel project `curebid` in `sourcesenseis-projects` uses root directory `apps/web`, Node 24.x, framework Next.js, install `pnpm install --frozen-lockfile`, build `cd ../.. && pnpm build`, and includes workspace files outside the root. GitHub integration is connected. Deployment protection is disabled for this explicitly public testnet app.

No wallet keys or custodial server signer are deployed. `.vercelignore` excludes local custody/runtime files, environment files, generated outputs and private context. Browser wallet signatures authorize transactions; the proof API is an unsigned courier.

Verified first production deployment: `dpl_9fpaGfNUpHTJx4mtBHze7hKnx884`. Unauthenticated HTTP 200 on `/`, `/repay`, `/providers`, `/requests/1`, `/verify`, `/deployment.json`, `/evidence.json`; eight Playwright tests passed against the public origin.

Hosted regression command:

```sh
E2E_BASE_URL=https://curebid.vercel.app pnpm test:browser
```

The committed walkthrough was recorded from the local UI against these same real public testnets; its caption states that accurately. It is not live-signing footage.
