from django.apps import AppConfig


class ScenariosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "scenarios"

    def ready(self):
        # Register the post-save signal that refreshes scenario embeddings.
        from . import signals  # noqa: F401
