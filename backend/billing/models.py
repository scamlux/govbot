"""Billing data model (Stage 2 groundwork — everything is inert until an owner configures it).

* ``Plan``               — sellable tier; ``price_uzs`` NULL means "not for sale".
* ``Subscription``       — a user's paid period on a plan.
* ``Order``              — what the user is about to pay for (referenced by both providers as the
                           payment "account": Payme ``account.order_id`` / Click ``merchant_trans_id``).
* ``PaymentTransaction`` — one provider-side transaction for an order. ``state`` uses the Payme
                           numbering (1 created, 2 performed, -1 cancelled, -2 cancelled after
                           perform) for both providers so the two share one state machine.
                           Never store card data in ``payload``.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone

FREE_PLAN_CODE = "free"


class Plan(models.Model):
    code = models.SlugField(unique=True)
    name = models.JSONField(default=dict, help_text='{"uz": "...", "ru": "...", "en": "..."}')
    price_uzs = models.PositiveIntegerField(
        null=True, blank=True, help_text="Price in UZS (soums) per period. Empty = not for sale."
    )
    period_days = models.PositiveIntegerField(default=30)
    daily_question_limit = models.PositiveIntegerField(
        null=True, blank=True, help_text="Questions per local day. Empty = unlimited."
    )
    features = models.JSONField(default=list, blank=True, help_text="List of feature codes.")
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.code

    @property
    def for_sale(self) -> bool:
        return bool(self.is_active and self.price_uzs)

    @property
    def price_tiyin(self) -> int | None:
        return self.price_uzs * 100 if self.price_uzs else None

    def localized_name(self, lang: str) -> str:
        names = self.name if isinstance(self.name, dict) else {}
        return names.get(lang) or names.get("en") or names.get("uz") or self.code


class Subscription(models.Model):
    ACTIVE, EXPIRED, CANCELLED = "active", "expired", "cancelled"
    STATUS_CHOICES = [(ACTIVE, "active"), (EXPIRED, "expired"), (CANCELLED, "cancelled")]
    PROVIDER_CHOICES = [("payme", "Payme"), ("click", "Click"), ("manual", "Manual")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscriptions"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=ACTIVE)
    current_period_end = models.DateTimeField()
    provider = models.CharField(max_length=10, choices=PROVIDER_CHOICES, default="manual")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-current_period_end"]
        indexes = [models.Index(fields=["user", "status", "current_period_end"])]

    def __str__(self):
        return f"{self.user_id}:{self.plan_id}:{self.status}"

    @property
    def is_current(self) -> bool:
        return self.status == self.ACTIVE and self.current_period_end > timezone.now()


class Order(models.Model):
    PENDING, PAID, CANCELLED = "pending", "paid", "cancelled"
    STATUS_CHOICES = [(PENDING, "pending"), (PAID, "paid"), (CANCELLED, "cancelled")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="billing_orders"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="orders")
    amount_tiyin = models.BigIntegerField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"order#{self.pk} {self.status}"


class PaymentTransaction(models.Model):
    PAYME, CLICK = "payme", "click"
    PROVIDER_CHOICES = [(PAYME, "Payme"), (CLICK, "Click")]
    CREATED, PERFORMED, CANCELLED, CANCELLED_AFTER_PERFORM = 1, 2, -1, -2
    STATE_CHOICES = [
        (CREATED, "created"),
        (PERFORMED, "performed"),
        (CANCELLED, "cancelled"),
        (CANCELLED_AFTER_PERFORM, "cancelled after perform"),
    ]

    provider = models.CharField(max_length=10, choices=PROVIDER_CHOICES)
    provider_txn_id = models.CharField(max_length=64)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payment_transactions"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="transactions")
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="transactions")
    subscription = models.ForeignKey(
        Subscription, null=True, blank=True, on_delete=models.SET_NULL, related_name="transactions"
    )
    amount_tiyin = models.BigIntegerField()
    state = models.SmallIntegerField(choices=STATE_CHOICES, default=CREATED)
    create_time = models.DateTimeField(default=timezone.now)
    perform_time = models.DateTimeField(null=True, blank=True)
    cancel_time = models.DateTimeField(null=True, blank=True)
    reason = models.SmallIntegerField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_txn_id"], name="uniq_provider_txn"
            )
        ]

    def __str__(self):
        return f"{self.provider}:{self.provider_txn_id}:{self.state}"
