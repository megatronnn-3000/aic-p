import pytest

from aic.config import load_config

SETTINGS = (
    "RENDER",
    "VERCEL",
    "VERCEL_ENV",
    "APP_ENV",
    "DATABASE_URL",
    "STORAGE_BACKEND",
    "S3_BUCKET",
    "TRUST_PROXY",
    "MAIL_ASYNC",
)
POSTGRES = "postgres://user:password@db.example.com/aic"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in SETTINGS:
        monkeypatch.delenv(name, raising=False)


def test_local_defaults():
    config = load_config()
    assert config["APP_ENV"] == "development"
    assert config["TRUST_PROXY"] is False
    assert config["MAIL_ASYNC"] is True


def test_render_defaults(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    config = load_config()
    assert config["APP_ENV"] == "production"
    assert config["TRUST_PROXY"] is True
    assert config["MAIL_ASYNC"] is True


def test_vercel_defaults(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", POSTGRES)
    config = load_config()
    assert config["APP_ENV"] == "production"
    assert config["TRUST_PROXY"] is True
    # Mail goes out inline: a frozen function would strand a background thread.
    assert config["MAIL_ASYNC"] is False
    assert config["STORAGE_BACKEND"] == "database"


def test_vercel_defaults_can_be_overridden(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", POSTGRES)
    monkeypatch.setenv("MAIL_ASYNC", "true")
    monkeypatch.setenv("TRUST_PROXY", "false")
    config = load_config()
    assert config["MAIL_ASYNC"] is True
    assert config["TRUST_PROXY"] is False


@pytest.mark.parametrize("vercel_env", ["production", "preview"])
def test_vercel_deployments_require_a_database_url(monkeypatch, vercel_env):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", vercel_env)
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        load_config()


def test_vercel_dev_can_use_sqlite(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "development")
    assert load_config()["DATABASE_URL"].startswith("sqlite")
