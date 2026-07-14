import logging
from fastapi import HTTPException
from . import models

_log = logging.getLogger(__name__)


def check_overlap(db, prop_id: str, checkin: str, checkout: str, exclude_id: str = None):
    """Raise 409 if there's a non-cancelled reservation overlapping these dates."""
    q = db.query(models.Reservation).filter(
        models.Reservation.prop_id == prop_id,
        models.Reservation.status != "cancelled",
        models.Reservation.checkin < checkout,
        models.Reservation.checkout > checkin,
    )
    if exclude_id:
        q = q.filter(models.Reservation.id != exclude_id)
    conflict = q.first()
    if conflict:
        msg = f"Já existe uma reserva de {conflict.checkin} a {conflict.checkout} ({conflict.guest_name})"
        _log.warning(f"Sobreposição detectada: prop={prop_id} {checkin}→{checkout} vs {conflict.checkin}→{conflict.checkout} ({conflict.guest_name})")
        raise HTTPException(409, msg)
