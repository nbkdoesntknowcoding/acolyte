# Developer Setup Guide — Acolyte AI Platform

Step-by-step onboarding for new developers. Follow this from top to bottom on a fresh machine.

---

## 1. Prerequisites

Install these before cloning the repo.

### Node.js 20 LTS (via nvm)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.zshrc
nvm install 20
nvm use 20
node -v  # should print v20.x.x
```

### Python 3.11 (via pyenv)

```bash
brew install pyenv
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zshrc
pyenv install 3.11
pyenv global 3.11
python3 --version  # should print Python 3.11.x
```

### Docker Desktop

Download from https://www.docker.com/products/docker-desktop/ and install. Make sure it's **running** before proceeding (you'll see the whale icon in the menu bar).

### Git + GitHub CLI

```bash
brew install git gh
gh auth login  # follow prompts, choose HTTPS + browser auth
```

### Fly.io CLI

Used to proxy our hosted Permify instance to localhost. No need to run Permify locally.

```bash
brew install flyctl
flyctl auth login  # ask Nischay to add you to the Fly.io org first
```

### Expo CLI (Subha only — mobile development)

No global install needed. Expo runs via npx:

```bash
# Just verify npx works
npx expo --version
```

Install Expo Go on your Android/iOS phone from the app store for on-device testing.

### Claude Code CLI

Our AI coding assistant. It reads the `CLAUDE.md` file in the repo root automatically — that file is the complete project context (architecture, NMC domain knowledge, coding standards, database schemas, API patterns, every decision).

```bash
npm install -g @anthropic-ai/claude-code
```

To use it, just run `claude` from the repo root. It will pick up `CLAUDE.md` automatically. More info: https://docs.anthropic.com/en/docs/claude-code

---

## 2. Clone and Install

```bash
git clone https://github.com/nbkdoesntknowcoding/acolyte.git
cd acolyte
```

### Frontend dependencies (Turborepo workspaces)

```bash
npm install
```

This installs dependencies for `apps/web` and all `packages/*` workspaces.

### Mobile dependencies (separate — not in Turborepo workspaces)

```bash
cd apps/mobile
npm install --legacy-peer-deps
cd ../..
```

> **Why `--legacy-peer-deps`?** Expo SDK 52 has peer dependency conflicts with React 19. This flag is required and is set in `apps/mobile/.npmrc` as well.

### Backend dependencies

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### Backend environment file

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | Use `postgresql+asyncpg://postgres:postgres@localhost:5432/acolyte` for local Docker |
| `REDIS_URL` | Use `redis://localhost:6379` for local Docker |
| `CLERK_SECRET_KEY` | Ask Nischay for the shared dev key |
| `CLERK_PUBLISHABLE_KEY` | Ask Nischay for the shared dev key |
| `CLERK_JWKS_URL` | Ask Nischay |
| `CLERK_ISSUER` | Ask Nischay |
| `PERMIFY_ENDPOINT` | Use `localhost` (via flyctl proxy) |
| `PERMIFY_API_KEY` | Ask Nischay |
| `ANTHROPIC_API_KEY` | Ask Nischay (for AI features) |
| `OPENAI_API_KEY` | Ask Nischay (for embeddings) |
| `R2_*` keys | Ask Nischay (Cloudflare R2 storage) |
| `APP_ENV` | `development` |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:8081` |

---

## 3. Start Local Infrastructure

### Start PostgreSQL + Redis

```bash
docker compose -f infrastructure/docker-compose.dev.yml up -d
```

### Verify PostgreSQL is running with pgvector

```bash
docker exec -it acolyte-postgres-1 psql -U postgres -d acolyte -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

Expected output: one row showing `vector`. If it's missing, the `init-extensions.sql` didn't run — recreate the container:

```bash
docker compose -f infrastructure/docker-compose.dev.yml down -v
docker compose -f infrastructure/docker-compose.dev.yml up -d
```

### Verify Redis

```bash
docker exec -it acolyte-redis-1 redis-cli ping
```

Expected output: `PONG`

### Connect to Permify (hosted on Fly.io)

Permify runs on Fly.io, not locally. Open a **separate terminal** and keep it running:

```bash
flyctl proxy 3476:3476 -a acolyte-permify
```

This tunnels the Fly.io Permify instance to `localhost:3476`. The backend connects to it automatically. Keep this terminal open while developing.

---

## 4. Database Setup

Activate the backend virtualenv first:

```bash
cd backend
source .venv/bin/activate
```

### Run migrations

```bash
alembic upgrade head
```

### Push Permify authorization schema

```bash
python3 -m scripts.push_permify_schema
```

Expected output: a schema version string like `d654gr362atc73bbebk0`.

### Seed NMC reference data (if available)

```bash
python3 infrastructure/seed/seed_nmc_reference.py
```

This loads NMC competency codes, MSR thresholds, NAAC metrics, and AETCOM modules into the reference tables (these are not tenant-scoped).

---

## 5. Run the Apps

Open separate terminals for each:

### Backend API

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Verify:

```bash
curl http://localhost:8000/health
```

Expected: `{"status": "healthy", "dependencies": {"permify": "connected"}}`

### Frontend (Next.js)

```bash
cd apps/web
npm run dev
```

Runs on http://localhost:3000

### Mobile (Subha only)

```bash
cd apps/mobile
npx expo start
```

Scan the QR code with Expo Go on your phone.

---

## 6. Git Workflow — How We Work

### Trunk-based development

`main` is always deployable. **Never push directly to main.** All work goes through feature branches and pull requests.

### Branch ownership

| Developer | Role | Branches | Scope |
|-----------|------|----------|-------|
| **Nischay** | CEO / AI Lead | `feat/ai-central-engine`, `feat/student-engine`, `feat/faculty-engine`, `feat/admin-engine`, `feat/integration-engine` | All backend engines and AI |
| **Subha** | CTO / AI-ML | `feat/web-app`, `feat/mobile-app` | Frontend web and mobile apps |
| **Jason** | Developer | `feat/compliance-engine` | Compliance engine (NMC/NAAC/NBA) |

### Daily workflow

```bash
# 1. Start from latest main
git checkout main
git pull origin main

# 2. Switch to your feature branch
git checkout feat/compliance-engine   # Jason's branch
# or
git checkout feat/web-app             # Subha's branch

# 3. Keep your branch up to date
git merge main

# 4. Work, commit often
git add backend/app/engines/compliance/service.py
git commit -m "feat: add MSR faculty strength calculation"

# 5. Push and create a PR when ready
git push origin feat/compliance-engine
gh pr create --base main --title "feat: MSR faculty strength monitoring" --body "Description of changes"

# 6. CI runs automatically (backend tests, tenant isolation, frontend build)
# 7. Get 1 approval from another team member
# 8. Merge via GitHub
```

### Migration coordination (CRITICAL)

Database migrations must be coordinated to avoid Alembic head conflicts:

1. **Announce on Slack/WhatsApp** before generating a migration: "I'm creating a migration for X"
2. Only **one person generates a migration at a time**
3. Generate it:
   ```bash
   cd backend
   alembic revision --autogenerate -m "add msr_alerts table"
   ```
4. Always write both `upgrade()` AND `downgrade()` functions
5. Every new tenant table MUST have `college_id` column + RLS policy
6. Commit and push immediately so others can pull it

### Engine boundary rules

**Never import from another engine's internal files.** Only use the public interface from `__init__.py`.

```python
# CORRECT — importing from public interface
from app.engines.ai import generate_mcq
from app.engines.admin import get_faculty_roster

# WRONG — reaching into internal modules
from app.engines.ai.agents.socratic_tutor import SocraticTutorAgent
from app.engines.admin.models import Faculty
```

If something you need isn't exposed in another engine's `__init__.py`, ask the engine owner to add it. Don't work around it.

---

## 7. Claude Code Usage

### CLAUDE.md is the bible

The `CLAUDE.md` file in the repo root contains everything:

- Complete architecture (6 engines, deployment topology, tech stack)
- Database schema (~88 tables, RLS patterns, migration rules)
- NMC domain knowledge (MSR 2023, CBME 2024, AEBAS, SAF forms)
- API contracts between engines
- Coding standards and common mistakes checklist
- Permify authorization schema

Claude Code reads it automatically when you run `claude` from the repo root.

### For Jason (Compliance Engine)

The compliance section in `CLAUDE.md` has everything you need:

- NMC MSR 2023 faculty strength norms and calculation rules
- AEBAS attendance requirements (75% threshold, GPS geofencing)
- SAF AI/AII/AIII form specifications and auto-generation logic
- NAAC 109 metrics across 7 criteria
- NBA SAR CO-PO mapping requirements
- Inspection readiness scoring methodology

Start Claude Code and ask it to reference these sections when building compliance features.

### For Subha (Web + Mobile)

The UI/UX section in `CLAUDE.md` covers:

- Design system: emerald green (#00C853) brand, dark mode first
- Component libraries: shadcn/ui + Tremor for web, gluestack-ui v2 + NativeWind for mobile
- Dashboard layouts per role (student, faculty, admin, compliance, management)
- Mobile constraints: target ₹8K-15K Android phones, APK < 30MB, Hermes engine
- Offline sync: PowerSync for logbook, flashcards, clinical logs

---

## 8. Key Contacts

| Person | Ask about |
|--------|-----------|
| **Nischay** | Architecture decisions, API contracts between engines, AI engine, database schema, Clerk/Permify auth, deployment, shared secrets/keys |
| **Subha** | Frontend patterns, React component architecture, mobile offline sync (PowerSync), design system, Expo configuration |
| **Jason** | Compliance domain logic, NMC regulations interpretation, AEBAS integration details, SAF form fields |

---

## 9. Troubleshooting

### Docker won't start

Make sure Docker Desktop is running (whale icon in menu bar). Then retry:

```bash
docker compose -f infrastructure/docker-compose.dev.yml up -d
```

### Alembic errors on `upgrade head`

Usually a migration conflict. Pull latest main and retry:

```bash
git pull origin main
cd backend && alembic upgrade head
```

If still failing, ask Nischay — likely a migration head conflict that needs manual resolution.

### Clerk auth errors in the browser

Check that `apps/web/.env.local` has the correct keys:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Ask Nischay for the shared dev keys if you don't have them.

### Permify connection refused

The `flyctl proxy` command must be running in a separate terminal:

```bash
flyctl proxy 3476:3476 -a acolyte-permify
```

If you get "not authenticated", run `flyctl auth login` first.

### Port 8000 already in use

```bash
lsof -ti:8000 | xargs kill -9
```

Then restart uvicorn.

### Port 3000 already in use

```bash
lsof -ti:3000 | xargs kill -9
```

Then restart the Next.js dev server.

### pgvector extension missing

The docker-compose uses the `pgvector/pgvector:pg16` image which includes it. If you see "extension vector does not exist", the init script didn't run. Nuke and recreate:

```bash
docker compose -f infrastructure/docker-compose.dev.yml down -v
docker compose -f infrastructure/docker-compose.dev.yml up -d
```

### npm install fails in apps/mobile

Always use the legacy peer deps flag:

```bash
cd apps/mobile
npm install --legacy-peer-deps
```

This is required because Expo SDK 52 conflicts with React 19 peer dependencies.

### Backend can't connect to database

For local Docker, your `backend/.env` should have:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/acolyte
```

Make sure the postgres container is running: `docker ps | grep postgres`
