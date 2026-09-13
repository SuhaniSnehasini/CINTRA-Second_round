import os
os.environ["DATABASE_URL"] = "sqlite:///./test_cintra.db"
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine
from app.utils.seed_data import seed_database

@pytest.fixture(autouse=True)
def database():
    Base.metadata.drop_all(bind=engine)
    seed_database()
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
