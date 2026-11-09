"""Subscription + order business logic shared by the REST API and both providers."""
from datetime import timedelta

from django.utils import timezone

from .models import FREE_PLAN_CODE, Order, PaymentTransaction, Plan, Subscription


def active_subscription_for(user) -> Subscription | None:
    if not user or not getattr(user, "pk", None):
        return None
    return (
        Subscription.objects.filter(
            user=user, status=Subscription.ACTIVE, current_period_end__gt=timezone.now()
        )
        .select_related("plan")
        .order_by("-current_period_end")
        .first()
    )


def active_plan_for(user) -> Plan | None:
    """Plan of the user's live subscription, else the ``free`` plan (None if no plans exist)."""
    sub = active_subscription_for(user)
    if sub:
        return sub.plan
    return Plan.objects.filter(code=FREE_PLAN_CODE).first()


def activate_subscription(tx: PaymentTransaction) -> Subscription:
    """Create or extend the user's subscription by ``plan.period_days`` for a performed payment."""
    now = timezone.now()
    plan = tx.plan
    delta = timedelta(days=plan.period_days)
    sub = (
        Subscription.objects.select_for_update()
        .filter(user=tx.user, plan=plan, status=Subscription.ACTIVE, current_period_end__gt=now)
        .order_by("-current_period_end")
        .first()
    )
    if sub:
        sub.current_period_end = sub.current_period_end + delta
        sub.provider = tx.provider
        sub.save(update_fields=["current_period_end", "provider", "updated_at"])
    else:
        # A different plan replaces whatever was live; the user pays for the new plan now.
        Subscription.objects.filter(
            user=tx.user, status=Subscription.ACTIVE, current_period_end__gt=now
        ).update(status=Subscription.CANCELLED, updated_at=now)
        sub = Subscription.objects.create(
            user=tx.user, plan=plan, status=Subscription.ACTIVE,
            current_period_end=now + delta, provider=tx.provider,
        )
    tx.subscription = sub
    return sub


def revoke_subscription_period(tx: PaymentTransaction) -> None:
    """Undo the period granted by ``tx`` (refund / cancel after perform)."""
    sub = tx.subscription
    if not sub:
        return
    sub.current_period_end = sub.current_period_end - timedelta(days=tx.plan.period_days)
    if sub.current_period_end <= timezone.now():
        sub.status = Subscription.CANCELLED
    sub.save(update_fields=["current_period_end", "status", "updated_at"])


def perform_transaction(tx: PaymentTransaction) -> None:
    """Mark ``tx`` performed, the order paid, and grant the subscription. Caller holds the lock."""
    now = timezone.now()
    activate_subscription(tx)
    tx.state = PaymentTransaction.PERFORMED
    tx.perform_time = now
    tx.save()
    Order.objects.filter(pk=tx.order_id).update(status=Order.PAID)


def cancel_transaction(tx: PaymentTransaction, reason: int | None) -> None:
    """Cancel ``tx`` (state -1 before perform, -2 after). Caller holds the lock."""
    was_performed = tx.state == PaymentTransaction.PERFORMED
    if was_performed:
        revoke_subscription_period(tx)
        Order.objects.filter(pk=tx.order_id).update(status=Order.CANCELLED)
    tx.state = (
        PaymentTransaction.CANCELLED_AFTER_PERFORM if was_performed else PaymentTransaction.CANCELLED
    )
    tx.cancel_time = timezone.now()
    tx.reason = reason
    tx.save()


def to_ms(dt) -> int:
    return int(dt.timestamp() * 1000) if dt else 0
