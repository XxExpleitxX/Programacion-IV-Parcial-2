"""
Módulo de hashing de contraseñas con bcrypt.
Cost factor >= 12 según requerimiento del parcial.
"""
import bcrypt


BCRYPT_ROUNDS = 12


def hash_password(plain: str) -> str:
    """Hashea una contraseña con bcrypt."""
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, stored: str) -> bool:
    """Verifica una contraseña contra el hash bcrypt almacenado."""
    if not stored:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), stored.encode("utf-8"))
    except Exception:
        return False