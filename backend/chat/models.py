from django.conf import settings
from django.db import models

LANGUAGES = (("uz", "Uzbek"), ("ru", "Russian"), ("en", "English"))


class Conversation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="conversations", on_delete=models.CASCADE
    )
    title = models.CharField(max_length=255, blank=True)
    language = models.CharField(max_length=2, choices=LANGUAGES, default="uz")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title or f"Conversation #{self.pk}"

    def ensure_title(self, from_text: str):
        """Auto-generate a title from the first user message if none set."""
        if not self.title and from_text:
            text = " ".join(from_text.split())
            self.title = (text[:57] + "…") if len(text) > 57 else text
            self.save(update_fields=["title", "updated_at"])


class Message(models.Model):
    USER = "user"
    ASSISTANT = "assistant"
    ROLE_CHOICES = ((USER, "User"), (ASSISTANT, "Assistant"))

    conversation = models.ForeignKey(
        Conversation, related_name="messages", on_delete=models.CASCADE
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    tokens = models.PositiveIntegerField(null=True, blank=True)
    model = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:40]}"
