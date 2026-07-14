import os, logging
import stripe

logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY     = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

stripe.api_key = STRIPE_SECRET_KEY


def create_checkout_session(reservation, property_obj, success_url: str, cancel_url: str) -> dict | None:
    """Create a Stripe Checkout session for the full stay value. Returns {id, url}, or None if Stripe isn't configured."""
    if not STRIPE_SECRET_KEY:
        logger.warning("Stripe não configurado — checkout session não criada")
        return None
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            customer_email=reservation.guest_email or None,
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "unit_amount": max(int(round(reservation.price * 100)), 0),
                    "product_data": {
                        "name": f"{property_obj.name} — {reservation.checkin} a {reservation.checkout}",
                    },
                },
                "quantity": 1,
            }],
            metadata={"reservation_id": reservation.id},
            success_url=success_url,
            cancel_url=cancel_url,
        )
        logger.info(f"Stripe checkout session {session.id} criada para reserva {reservation.id}")
        return {"id": session.id, "url": session.url}
    except Exception as e:
        logger.error(f"Stripe create_checkout_session exception: {e}")
        return None


def verify_webhook(payload: bytes, sig_header: str):
    """Verify and construct a Stripe webhook event. Raises on invalid signature."""
    return stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
