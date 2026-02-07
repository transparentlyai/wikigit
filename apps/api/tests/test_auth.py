"""Tests for GCP IAP authentication middleware and authorization helpers."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.middleware.auth import AuthMiddleware, get_current_user, require_admin


# ============================================================================
# AuthMiddleware._parse_iap_email
# ============================================================================


class TestParseIapEmail:
    """Tests for AuthMiddleware._parse_iap_email static method."""

    def test_standard_iap_format(self):
        result = AuthMiddleware._parse_iap_email("accounts.google.com:user@example.com")
        assert result == "user@example.com"

    def test_plain_email(self):
        result = AuthMiddleware._parse_iap_email("user@example.com")
        assert result == "user@example.com"

    def test_iap_format_with_subdomain_email(self):
        result = AuthMiddleware._parse_iap_email(
            "accounts.google.com:admin@sub.domain.com"
        )
        assert result == "admin@sub.domain.com"

    def test_iap_format_with_whitespace(self):
        result = AuthMiddleware._parse_iap_email(
            "accounts.google.com: user@example.com "
        )
        assert result == "user@example.com"

    def test_plain_email_with_whitespace(self):
        result = AuthMiddleware._parse_iap_email(" user@example.com ")
        assert result == "user@example.com"

    def test_empty_string_returns_none(self):
        result = AuthMiddleware._parse_iap_email("")
        assert result is None

    def test_invalid_no_at_sign(self):
        result = AuthMiddleware._parse_iap_email("invalid")
        assert result is None

    def test_invalid_no_dot_in_domain(self):
        result = AuthMiddleware._parse_iap_email("user@localhost")
        assert result is None

    def test_invalid_iap_format_with_bad_email(self):
        result = AuthMiddleware._parse_iap_email("accounts.google.com:notanemail")
        assert result is None

    def test_invalid_iap_format_with_no_domain_dot(self):
        result = AuthMiddleware._parse_iap_email("accounts.google.com:user@nodot")
        assert result is None

    def test_colon_only(self):
        result = AuthMiddleware._parse_iap_email(":")
        assert result is None

    def test_colon_with_empty_parts(self):
        result = AuthMiddleware._parse_iap_email("prefix:")
        assert result is None

    def test_multiple_colons(self):
        """The split with maxsplit=1 means only the first colon splits."""
        result = AuthMiddleware._parse_iap_email(
            "accounts.google.com:user@example.com:extra"
        )
        # After split(":", 1) => ["accounts.google.com", "user@example.com:extra"]
        # "user@example.com:extra" has @ and domain has dot, so it should parse the email part
        # but the email contains a colon which is technically in the string
        # The method checks "@" in email and "." in domain part after @
        # "user@example.com:extra".split("@") => ["user", "example.com:extra"]
        # "example.com:extra" has "." so it passes
        assert result == "user@example.com:extra"


# ============================================================================
# get_current_user
# ============================================================================


class TestGetCurrentUser:
    """Tests for get_current_user dependency."""

    def test_returns_email_when_present(self):
        request = MagicMock()
        request.state.user_email = "user@example.com"
        result = get_current_user(request)
        assert result == "user@example.com"

    def test_raises_401_when_no_user_email(self):
        request = MagicMock(spec=[])
        request.state = MagicMock(spec=[])
        # Make getattr(request.state, "user_email", None) return None
        # by ensuring user_email is not an attribute
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(request)
        assert exc_info.value.status_code == 401
        assert "Authentication required" in exc_info.value.detail

    def test_raises_401_when_user_email_is_none(self):
        request = MagicMock()
        request.state.user_email = None
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(request)
        assert exc_info.value.status_code == 401

    def test_raises_401_when_user_email_is_empty_string(self):
        request = MagicMock()
        request.state.user_email = ""
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(request)
        assert exc_info.value.status_code == 401


# ============================================================================
# require_admin
# ============================================================================


class TestRequireAdmin:
    """Tests for require_admin dependency."""

    @patch("app.middleware.auth.settings")
    def test_returns_email_for_admin(self, mock_settings):
        mock_settings.is_admin = MagicMock(return_value=True)
        request = MagicMock()
        request.state.user_email = "admin@example.com"

        result = require_admin(request)
        assert result == "admin@example.com"
        mock_settings.is_admin.assert_called_once_with("admin@example.com")

    @patch("app.middleware.auth.settings")
    def test_raises_403_for_non_admin(self, mock_settings):
        mock_settings.is_admin = MagicMock(return_value=False)
        request = MagicMock()
        request.state.user_email = "user@example.com"

        with pytest.raises(HTTPException) as exc_info:
            require_admin(request)
        assert exc_info.value.status_code == 403
        assert "does not have admin privileges" in exc_info.value.detail

    @patch("app.middleware.auth.settings")
    def test_raises_401_for_unauthenticated(self, mock_settings):
        request = MagicMock(spec=[])
        request.state = MagicMock(spec=[])

        with pytest.raises(HTTPException) as exc_info:
            require_admin(request)
        assert exc_info.value.status_code == 401
        # is_admin should never be called if user is not authenticated
        mock_settings.is_admin.assert_not_called()

    @patch("app.middleware.auth.settings")
    def test_raises_401_when_email_is_none(self, mock_settings):
        request = MagicMock()
        request.state.user_email = None

        with pytest.raises(HTTPException) as exc_info:
            require_admin(request)
        assert exc_info.value.status_code == 401
        mock_settings.is_admin.assert_not_called()

    @patch("app.middleware.auth.settings")
    def test_admin_check_uses_settings(self, mock_settings):
        """Verify that require_admin delegates admin check to settings.is_admin."""
        mock_settings.is_admin = MagicMock(return_value=True)
        request = MagicMock()
        request.state.user_email = "admin@corp.com"

        require_admin(request)
        mock_settings.is_admin.assert_called_once_with("admin@corp.com")
