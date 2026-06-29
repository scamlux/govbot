from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "display_name",
            "avatar_url",
            "preferred_language",
            "is_staff",
            "created_at",
        ]
        read_only_fields = ["id", "email", "avatar_url", "is_staff", "created_at"]


class AdminUserSerializer(serializers.ModelSerializer):
    """Read-only user listing for the admin dashboard."""

    display_name = serializers.CharField(read_only=True)
    conversation_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "display_name",
            "preferred_language",
            "is_staff",
            "is_active",
            "conversation_count",
            "created_at",
            "last_login",
        ]


class RegisterSerializer(serializers.ModelSerializer):
    """Create a new account with email + password."""

    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["email", "password", "full_name", "preferred_language"]
        extra_kwargs = {
            "full_name": {"required": False},
            "preferred_language": {"required": False},
        }

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """Email + password -> JWT pair, with the user profile attached to the response."""

    def validate(self, attrs):
        data = super().validate(attrs)  # {"access", "refresh"}
        data["user"] = UserSerializer(self.user).data
        return data
