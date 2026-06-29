import os

# Force the SQLite fallback DB during tests regardless of any local .env / Postgres config.
os.environ.pop("DATABASE_URL", None)
os.environ.pop("POSTGRES_DB", None)
os.environ.setdefault("SECRET_KEY", "test-secret-key")
# Ensure mock mode for OpenAI in tests (no key / no external calls).
os.environ["OPENAI_API_KEY"] = ""
