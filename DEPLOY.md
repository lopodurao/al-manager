# Deploy no Render.com

## Passo a passo

### 1. Criar repositório Git

```bash
cd C:\scripts\vazguedes\al-manager
git init
git add .
git commit -m "AL Manager v2.0 — FastAPI + SQLite"
```

### 2. Criar repositório no GitHub
- Vai a github.com → New repository → nome: `al-manager`
- Copia o URL (ex: https://github.com/TU/al-manager.git)

```bash
git remote add origin https://github.com/TU/al-manager.git
git push -u origin main
```

### 3. Deploy no Render
1. Vai a **render.com** → New → **Web Service**
2. Liga a tua conta GitHub e seleciona o repo `al-manager`
3. Preenche:
   - **Name**: al-manager
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Em **Environment Variables** adiciona:
   - `SECRET_KEY` → clica em "Generate" para gerar automaticamente
   - `DB_PATH` → `/opt/render/project/src/al_manager.db`
5. Clica **Create Web Service**

O deploy demora ~2 minutos. O URL será algo como `https://al-manager-XXXX.onrender.com`.

### 4. Primeiro acesso
1. Abre o URL no browser
2. É apresentado o ecrã de criação de conta (só na primeira vez)
3. Cria o teu utilizador e password
4. A partir daí só é possível fazer login — o registo fica bloqueado

## Notas importantes

### Persistência de dados no Render free tier
O Render free tier **não tem disco persistente** — os dados **perdem-se quando o serviço reinicia** (deploy, restart automático, etc.).

**Solução recomendada (gratuita):**
- Faz backup regularmente: Configurações → Exportar backup JSON
- O sistema faz backup automático diário (fica em `/backups/`)
- Para ter dados 100% persistentes gratuitos: adiciona **Supabase** (PostgreSQL grátis)

### Para dados persistentes com Supabase (opcional)
1. Cria conta em supabase.com (grátis)
2. Cria um projeto → copia a Connection String
3. No Render, adiciona env var: `DATABASE_URL=postgresql://...`
4. Altera `backend/database.py` para usar PostgreSQL

## Desenvolvimento local

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Abre http://localhost:8000
