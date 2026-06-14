"""
Entorno de Alembic.

- target_metadata = SQLModel.metadata (importa app.models para registrar todas las tablas).
- La URL sale de app.core.database.DATABASE_URL (MySQL), con override por la variable
  de entorno ALEMBIC_DB_URL (útil para autogenerar/probar contra SQLite sin MySQL).
"""
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine
from sqlmodel import SQLModel

import app.models  # noqa: F401  → puebla SQLModel.metadata con TODAS las tablas
from app.core.database import DATABASE_URL

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata

DB_URL = os.environ.get("ALEMBIC_DB_URL", DATABASE_URL)


def run_migrations_offline() -> None:
    context.configure(
        url=DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(DB_URL)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
