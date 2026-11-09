from django.contrib import admin

from .models import Order, PaymentTransaction, Plan, Subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ["code", "price_uzs", "period_days", "daily_question_limit", "is_active", "order"]
    list_editable = ["price_uzs", "daily_question_limit", "is_active", "order"]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ["user", "plan", "status", "current_period_end", "provider"]
    list_filter = ["status", "provider", "plan"]
    search_fields = ["user__email"]
    raw_id_fields = ["user"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "plan", "amount_tiyin", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["user__email"]
    readonly_fields = ["user", "plan", "amount_tiyin", "created_at"]


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    """Read-only: provider callbacks are the only writer."""

    list_display = ["id", "provider", "provider_txn_id", "user", "plan", "amount_tiyin", "state", "create_time"]
    list_filter = ["provider", "state"]
    search_fields = ["provider_txn_id", "user__email"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
