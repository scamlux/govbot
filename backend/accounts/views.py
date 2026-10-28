from django.db.models import Count
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import cookies
from .models import User
from .serializers import (
    AdminUserSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)


def tokens_for_user(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class RegisterView(generics.CreateAPIView):
    """Create an account and return JWTs + the user profile (auto sign-in)."""

    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        data = {**tokens_for_user(user), "user": UserSerializer(user).data}
        refresh = data.pop("refresh") if cookies.wants_cookie(request) else None
        response = Response(data, status=status.HTTP_201_CREATED)
        if refresh:
            cookies.set_refresh_cookie(response, refresh)  # F1 — never in the body
        return response


class LoginView(TokenObtainPairView):
    """Email + password -> { access, refresh, user }.

    With ``X-Auth-Cookie: 1`` the refresh token is delivered as an httpOnly cookie instead
    of in the body (F1); other clients are unchanged.
    """

    permission_classes = [AllowAny]
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200 and cookies.wants_cookie(request):
            refresh = response.data.pop("refresh", None)
            if refresh:
                cookies.set_refresh_cookie(response, refresh)
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """``POST /api/auth/refresh/`` — rotate the refresh token, return a new access token.

    The refresh token comes from the JSON body (legacy clients, and the one-time migration of
    a token that used to live in localStorage) or, for opted-in clients, from the httpOnly
    cookie. A cookie-sourced token is only honoured when ``X-Auth-Cookie: 1`` is present
    (CSRF defence in depth on top of SameSite=Lax). Opted-in clients get the rotated token
    back as a cookie and never see it in the body. A refresh token that is invalid, expired
    or already rotated answers 401 and clears the cookie so the browser stops sending it.
    """

    def post(self, request, *args, **kwargs):
        opted_in = cookies.wants_cookie(request)
        token = request.data.get("refresh")
        from_cookie = False
        if not token and opted_in:
            token = cookies.refresh_from_cookie(request)
            from_cookie = bool(token)

        serializer = self.get_serializer(data={"refresh": token} if token else {})
        try:
            serializer.is_valid(raise_exception=True)  # missing token -> 400, as before
        except TokenError as exc:
            response = Response(
                InvalidToken(exc.args[0]).detail, status=status.HTTP_401_UNAUTHORIZED
            )
            if from_cookie:
                cookies.clear_refresh_cookie(response)  # stop the browser re-sending it
            return response

        data = dict(serializer.validated_data)
        refresh = data.pop("refresh", None) if opted_in else None
        response = Response(data, status=status.HTTP_200_OK)
        if refresh:
            cookies.set_refresh_cookie(response, refresh)
        return response


class AdminUserListView(generics.ListAPIView):
    """List all registered users — staff only (for the admin dashboard)."""

    permission_classes = [IsAdminUser]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        return User.objects.annotate(
            conversation_count=Count("conversations")
        ).order_by("-created_at")


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Staff-only: view / edit (is_staff, is_active, …) / delete a user.

    Guards against locking yourself out: you cannot delete your own account or
    revoke your own staff/active flags.
    """

    permission_classes = [IsAdminUser]
    serializer_class = AdminUserSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return User.objects.annotate(conversation_count=Count("conversations"))

    def perform_update(self, serializer):
        obj = serializer.instance
        if obj == self.request.user:
            data = serializer.validated_data
            if data.get("is_staff") is False or data.get("is_active") is False:
                raise ValidationError({"detail": "You cannot revoke your own access."})
        serializer.save()

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise ValidationError({"detail": "You cannot delete your own account."})
        instance.delete()


class MeView(generics.RetrieveUpdateAPIView):
    """Get or update the authenticated user's profile."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user


class LogoutView(APIView):
    """F2 — revoke the given refresh token server-side (blacklist).

    ``POST /api/auth/logout/`` with ``{"refresh": "..."}``. Always answers 205 for a
    well-formed request so the client can clear local tokens regardless; an already
    revoked/expired token is not an error from the user's point of view.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("refresh") or cookies.refresh_from_cookie(request)
        if not token and not cookies.wants_cookie(request):
            raise ValidationError({"refresh": "This field is required."})
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass  # expired / already blacklisted — logging out is still a success
        response = Response(status=status.HTTP_205_RESET_CONTENT)
        cookies.clear_refresh_cookie(response)
        return response


class DeleteAccountView(APIView):
    """F3 — the user deletes their own account (and, by cascade, their conversations).

    ``POST /api/auth/me/delete/`` with ``{"password": "..."}``. The password is required so
    a hijacked access token alone cannot erase an account. The last remaining active staff
    account cannot delete itself, so the deployment is never left without an operator.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        password = request.data.get("password") or ""
        if not user.check_password(password):
            raise ValidationError({"password": "Incorrect password."})
        if user.is_staff and not User.objects.filter(is_staff=True, is_active=True).exclude(
            pk=user.pk
        ).exists():
            raise ValidationError(
                {"detail": "The last administrator account cannot be deleted."}
            )
        # Revoke every outstanding refresh token before the user row disappears.
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)
        user.delete()
        response = Response(status=status.HTTP_204_NO_CONTENT)
        cookies.clear_refresh_cookie(response)
        return response


class ExportDataView(APIView):
    """F3 — ``GET /api/auth/me/export/``: everything GovBot stores about the caller, as JSON."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        conversations = (
            user.conversations.prefetch_related("messages__feedback").order_by("created_at")
        )
        payload = {
            "exported_at": timezone.now().isoformat(),
            "profile": UserSerializer(user).data,
            "conversations": [
                {
                    "id": c.id,
                    "title": c.title,
                    "language": c.language,
                    "created_at": c.created_at.isoformat(),
                    "messages": [
                        {
                            "role": m.role,
                            "content": m.content,
                            "sources": m.sources,
                            "created_at": m.created_at.isoformat(),
                            "feedback": (
                                {"rating": m.feedback.rating, "reason": m.feedback.reason}
                                if hasattr(m, "feedback")
                                else None
                            ),
                        }
                        for m in c.messages.all()
                    ],
                }
                for c in conversations
            ],
        }
        response = Response(payload)
        response["Content-Disposition"] = 'attachment; filename="govbot-my-data.json"'
        return response
