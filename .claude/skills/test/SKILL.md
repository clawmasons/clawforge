---
name: test
description: Run the full Clawforge test suite — unit tests, dev servers, Docker integration, packaging, and global install
allowed-tools: Bash, Read
---

# /test — Full Stack Validation

Run a comprehensive test suite across the entire Clawforge stack. Each phase is independent — if one fails, record the failure and continue to the next phase. Print a summary table at the end.

## Pre-flight

1. Detect the repo root (look for `package.json` with `"name": "clawforge"`)
2. Kill any stale processes on ports 3000, 4000, and 5432:
   ```
   lsof -ti:3000 | xargs kill -9 2>/dev/null || true
   lsof -ti:4000 | xargs kill -9 2>/dev/null || true
   ```
3. Initialize a results tracker — for each phase, store PASS, FAIL, or SKIP

## Phase 1: Unit Tests

Run the server package's unit tests:

```bash
pnpm --filter @clawforge/server test
```

**Pass criteria:** exit code 0

## Phase 1b: Yjs Server Tests

Run the yjs-server package's unit tests (math-bot integration + watcher tests):

```bash
pnpm --filter @clawforge/yjs-server test
```

**Pass criteria:** exit code 0

## Phase 2: Web Dev Server Smoke Test

1. Kill anything on port 3000:
   ```bash
   lsof -ti:3000 | xargs kill -9 2>/dev/null || true
   ```
2. Start the web dev server in background:
   ```bash
   pnpm --filter @clawforge/web dev &
   WEB_PID=$!
   ```
3. Poll `http://localhost:3000` every 3 seconds, up to 60 seconds total
4. Verify the response body contains `<html` or `<!DOCTYPE`
5. Kill the dev server:
   ```bash
   kill $WEB_PID 2>/dev/null || true
   lsof -ti:3000 | xargs kill -9 2>/dev/null || true
   ```

**Pass criteria:** HTTP response received and contains HTML content within 60s

## Phase 3: API Health Check

1. Start a standalone postgres container:
   ```bash
   docker run -d --name clawforge-test-pg \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=clawforge \
     -p 5432:5432 \
     postgres:16-alpine
   ```
2. Wait for postgres to be ready (poll `pg_isready` up to 30s):
   ```bash
   until docker exec clawforge-test-pg pg_isready -U postgres; do sleep 2; done
   ```
3. Export required env vars:
   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/clawforge"
   export BETTER_AUTH_SECRET="test-secret"
   export BETTER_AUTH_URL="http://localhost:4000"
   export WEB_URL="http://localhost:3000"
   export GOOGLE_CLIENT_ID="test"
   export GOOGLE_CLIENT_SECRET="test"
   export PORT=4000
   ```
4. Start the API dev server in background:
   ```bash
   pnpm --filter @clawforge/api dev &
   API_PID=$!
   ```
5. Poll `http://localhost:4000/health` every 3 seconds, up to 30 seconds
6. Verify response contains `"status":"ok"`
7. Clean up:
   ```bash
   kill $API_PID 2>/dev/null || true
   lsof -ti:4000 | xargs kill -9 2>/dev/null || true
   docker rm -f clawforge-test-pg 2>/dev/null || true
   ```

**Pass criteria:** `/health` returns `{"status":"ok","service":"api"}` within 30s

## Phase 4: Docker Integration Test

1. Clean up prior state:
   ```bash
   docker compose -f infra/clawforge-server/docker-compose.yml down -v 2>/dev/null || true
   ```
2. Export dummy env vars for compose:
   ```bash
   export BETTER_AUTH_SECRET="test-secret"
   export GOOGLE_CLIENT_ID="test"
   export GOOGLE_CLIENT_SECRET="test"
   ```
3. Build and start all services:
   ```bash
   docker compose -f infra/clawforge-server/docker-compose.yml up --build -d
   ```
4. Wait for all services to become healthy — poll `docker compose ps` for up to 120 seconds, checking that postgres, api, and web are all healthy
5. Verify endpoints:
   - `http://localhost:3000` returns HTML content
   - `http://localhost:4000/health` returns `"status":"ok"`
6. Tear down:
   ```bash
   docker compose -f infra/clawforge-server/docker-compose.yml down -v
   ```

**Pass criteria:** all three services healthy, both endpoints respond correctly

## Phase 5: Package npm Tarball

1. Remove any existing tarballs:
   ```bash
   rm -f *.tgz
   ```
2. Run the pack script:
   ```bash
   pnpm pack
   ```
3. Verify a `.tgz` file was created:
   ```bash
   ls *.tgz
   ```

**Pass criteria:** a `clawforge-*.tgz` file exists after packing

## Phase 6: Global Install / Uninstall

1. Uninstall any previous global install (ignore errors):
   ```bash
   npm uninstall -g clawforge 2>/dev/null || true
   ```
2. Install from the tarball:
   ```bash
   npm install -g ./clawforge-*.tgz
   ```
3. Verify the CLI works:
   ```bash
   clawforge --help
   ```

**Pass criteria:** `clawforge --help` exits 0 and prints help text

## Phase 7: Fresh Install Test in /tmp

1. Copy the repo to a temp directory (excluding build artifacts):
   ```bash
   rsync -a --exclude node_modules --exclude .next --exclude dist \
     --exclude bundle --exclude '*.tgz' --exclude .open-next \
     ./ /tmp/clawforge-test-copy/
   ```
2. Install dependencies in the copy:
   ```bash
   cd /tmp/clawforge-test-copy && pnpm install --frozen-lockfile
   ```
3. Run unit tests in the copy:
   ```bash
   cd /tmp/clawforge-test-copy && pnpm --filter @clawforge/server test
   cd /tmp/clawforge-test-copy && pnpm --filter @clawforge/yjs-server test
   ```
4. Remove the copy:
   ```bash
   rm -rf /tmp/clawforge-test-copy
   ```

**Pass criteria:** `pnpm install` and unit tests succeed in the fresh copy

## Phase 8: Cleanup

Run all cleanup steps (ignore errors on each):

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
docker compose -f infra/clawforge-server/docker-compose.yml down -v 2>/dev/null || true
docker rm -f clawforge-test-pg 2>/dev/null || true

# Commented to keep installed clawforge package
# npm uninstall -g clawforge 2>/dev/null || true

rm -f *.tgz
rm -rf /tmp/clawforge-test-copy
```

## Results Summary

Print a formatted summary table:

```
╔══════════════════════════════════════════╦════════╗
║ Phase                                    ║ Result ║
╠══════════════════════════════════════════╬════════╣
║ 1.  Unit Tests                           ║ PASS   ║
║ 1b. Yjs Server Tests                     ║ PASS   ║
║ 2.  Web Dev Server Smoke Test            ║ PASS   ║
║ 3.  API Health Check                     ║ FAIL   ║
║ 4.  Docker Integration Test              ║ SKIP   ║
║ 5.  Package npm Tarball                  ║ PASS   ║
║ 6.  Global Install / Uninstall           ║ PASS   ║
║ 7.  Fresh Install Test in /tmp           ║ PASS   ║
║ 8.  Cleanup                              ║ PASS   ║
╠══════════════════════════════════════════╬════════╣
║ OVERALL                                  ║ FAIL   ║
╚══════════════════════════════════════════╩════════╝
```

- **PASS**: all phases passed
- **FAIL**: one or more phases failed — list which ones
- **SKIP**: phase was skipped (e.g., Docker not available)

For any failed phase, include a brief explanation of what went wrong.
