"""Standalone operational scripts (seeders / maintenance).

Nothing in this package is imported by the production runtime (``app/``).
Scripts reuse the application's configuration, SQLAlchemy session and models
but never start the API, the stream gateway or any external integration.
"""
