"""S1 — production refuses to boot with an insecure default SECRET_KEY."""
import pytest
from django.core.exceptions import ImproperlyConfigured

from config.security import INSECURE_SECRET_KEYS, validate_secret_key


@pytest.mark.parametrize("bad_key", sorted(INSECURE_SECRET_KEYS) + [""])
def test_insecure_key_rejected_when_debug_off(bad_key):
    with pytest.raises(ImproperlyConfigured):
        validate_secret_key(bad_key, debug=False)


@pytest.mark.parametrize("bad_key", sorted(INSECURE_SECRET_KEYS) + [""])
def test_insecure_key_tolerated_in_debug(bad_key):
    validate_secret_key(bad_key, debug=True)  # must not raise


def test_real_key_accepted_when_debug_off():
    validate_secret_key("a-sufficiently-long-and-random-production-key", debug=False)
