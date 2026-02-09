-- PostgreSQL extensions required for Acolyte
CREATE EXTENSION IF NOT EXISTS "vector";         -- Vector similarity search (pgvector)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Column-level encryption (Aadhaar)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Trigram similarity search
-- pg_partman requires separate installation in production (Neon supports it natively)
