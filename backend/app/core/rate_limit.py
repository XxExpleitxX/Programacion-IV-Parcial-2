"""
Rate limiter en memoria — cuenta INTENTOS FALLIDOS por IP.
Si una IP supera el límite, bloquea por un tiempo (Retry-After).
Usado para proteger endpoints sensibles a ataques de fuerza bruta, como login y register.
"""
import time
from fastapi import HTTPException, status


class RateLimiter:
    def __init__(self, max_attempts: int = 5, window_seconds: int = 15 * 60):
        self.max = max_attempts
        self.window = window_seconds
        self._fails: dict[str, list[float]] = {}

    def _prune(self, key: str, now: float) -> None:
        if key in self._fails:
            self._fails[key] = [t for t in self._fails[key] if now - t < self.window]
            if not self._fails[key]:
                del self._fails[key]

    def assert_not_blocked(self, key: str) -> None:
        """Si la IP ya superó el límite, corta con 429 + Retry-After."""
        now = time.time()
        self._prune(key, now)
        intentos = self._fails.get(key, [])
        if len(intentos) >= self.max:
            retry_after = int(self.window - (now - intentos[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Demasiados intentos fallidos. Reintentá en {retry_after} segundos.",
                headers={"Retry-After": str(retry_after)},
            )

    def register_failure(self, key: str) -> None:
        """Registra un intento fallido para esa IP."""
        now = time.time()
        self._fails.setdefault(key, []).append(now)
        self._prune(key, now)


# Instancia única compartida para login + register
login_limiter = RateLimiter(max_attempts=5, window_seconds=15 * 60)