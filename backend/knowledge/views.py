"""Internal Knowledge Base endpoints.

The tick endpoint is called by Supabase ``pg_cron`` (via ``pg_net``), not by a logged-in
user, so it authenticates with a shared secret header instead of JWT. It does a bounded slice
of indexing work per call, so each request stays short even with a large backlog.
"""
import hmac

from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .indexing import run_kb_tick


class KBTickView(APIView):
    """POST /api/internal/kb/tick/ — drain a bounded batch of pending sources (secret-guarded)."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        secret = getattr(settings, "KB_TICK_SECRET", "") or ""
        provided = request.headers.get("X-KB-Tick-Secret", "") or ""
        if not secret or not hmac.compare_digest(str(secret), str(provided)):
            return Response({"detail": "forbidden"}, status=403)
        batch = getattr(settings, "KB_TICK_BATCH", 1)
        return Response(run_kb_tick(batch))
