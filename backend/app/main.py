from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes_health import router as health_router
from .api.routes_suspects import router as suspects_router
from .api.routes_identification import router as identification_router
from .api.routes_evidence import router as evidence_router
from .api.routes_cases import router as cases_router
from .api.routes_admin import router as admin_router
from .config import CINTRA_AUTO_SEED_ADMIN
from .schema_migrate import ensure_schema
from .utils.seed_data import seed_database

app = FastAPI(title="CINTRA Backend", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
app.include_router(health_router, prefix="/api/v1")
app.include_router(suspects_router, prefix="/api/v1")
app.include_router(identification_router, prefix="/api/v1")
app.include_router(evidence_router, prefix="/api/v1")
app.include_router(cases_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")


@app.on_event("startup")
def startup():
    ensure_schema()
    seed_database()
    if CINTRA_AUTO_SEED_ADMIN:
        from .utils.seed_admin_data import seed_admin_data
        seed_admin_data()
