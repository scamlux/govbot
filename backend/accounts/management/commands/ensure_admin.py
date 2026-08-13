"""Idempotently provision the admin (staff/superuser) account from env vars.

Run on every boot from entrypoint.sh. Reads ADMIN_EMAIL / ADMIN_PASSWORD:
- missing -> logs and no-ops (never blocks startup);
- account absent -> creates a superuser;
- account present -> ensures is_staff / is_superuser and resets the password to
  match the env (env is the single source of truth; to change the password,
  change ADMIN_PASSWORD and redeploy).
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create or update the admin account from ADMIN_EMAIL / ADMIN_PASSWORD env vars."

    def handle(self, *args, **options):
        email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
        password = os.environ.get("ADMIN_PASSWORD") or ""

        if not email or not password:
            self.stdout.write(
                "ensure_admin: ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping."
            )
            return

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()

        if user is None:
            User.objects.create_superuser(email=email, password=password)
            self.stdout.write(self.style.SUCCESS(f"ensure_admin: created admin {email}"))
            return

        changed = []
        if not user.is_staff:
            user.is_staff = True
            changed.append("is_staff")
        if not user.is_superuser:
            user.is_superuser = True
            changed.append("is_superuser")
        if not user.is_active:
            user.is_active = True
            changed.append("is_active")
        # Keep the password in sync with the env (source of truth).
        user.set_password(password)
        changed.append("password")
        user.save()
        self.stdout.write(
            self.style.SUCCESS(f"ensure_admin: updated admin {email} ({', '.join(changed)})")
        )
