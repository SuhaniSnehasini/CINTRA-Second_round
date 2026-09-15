import hashlib
import hmac
import logging
import secrets
from abc import ABC, abstractmethod

import httpx

from .. import config

logger = logging.getLogger("cintra.otp")


class OTPProviderError(Exception):
    pass


class OTPProvider(ABC):
    name: str = "base"

    @abstractmethod
    def send_otp(self, destination: str, otp: str, request_id: str) -> str | None:
        """Send OTP. Return provider transaction id if available. Never persist the OTP here."""

    def uses_external_verification(self) -> bool:
        return False

    def verify_otp(self, destination: str, otp: str, provider_reference: str | None) -> bool:
        return False


class ConsoleOTPProvider(OTPProvider):
    name = "console"

    def send_otp(self, destination: str, otp: str, request_id: str) -> str | None:
        last4 = destination[-4:] if destination else "0000"
        logger.info("CINTRA console OTP for destination ending %s request=%s code=%s", last4, request_id, otp)
        print(f"[CINTRA OTP] request={request_id} destination_last4={last4} otp={otp}")
        return f"console:{request_id}"


class TwilioOTPProvider(OTPProvider):
    name = "twilio"

    def send_otp(self, destination: str, otp: str, request_id: str) -> str | None:
        sid = config.TWILIO_ACCOUNT_SID
        token = config.TWILIO_AUTH_TOKEN
        from_number = config.TWILIO_FROM_NUMBER
        verify_sid = config.TWILIO_VERIFY_SERVICE_SID
        if not sid or not token:
            raise OTPProviderError("Twilio credentials are not configured.")
        try:
            if verify_sid:
                url = f"https://verify.twilio.com/v2/Services/{verify_sid}/Verifications"
                auth = (sid, token)
                response = httpx.post(
                    url,
                    auth=auth,
                    data={"To": destination, "Channel": "sms"},
                    timeout=15,
                )
            else:
                if not from_number:
                    raise OTPProviderError("TWILIO_FROM_NUMBER is required when Verify Service SID is not set.")
                url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
                response = httpx.post(
                    url,
                    auth=(sid, token),
                    data={
                        "From": from_number,
                        "To": destination,
                        "Body": f"CINTRA admin OTP: {otp}. It expires shortly. Do not share this code.",
                    },
                    timeout=15,
                )
            if response.status_code >= 400:
                raise OTPProviderError("OTP provider rejected the send request.")
            payload = response.json()
            return payload.get("sid") or payload.get("account_sid") or request_id
        except OTPProviderError:
            raise
        except Exception as exc:
            raise OTPProviderError("Unable to reach OTP provider.") from exc

    def uses_external_verification(self) -> bool:
        return bool(config.TWILIO_VERIFY_SERVICE_SID)

    def verify_otp(self, destination: str, otp: str, provider_reference: str | None) -> bool:
        if not self.uses_external_verification():
            return False
        sid = config.TWILIO_ACCOUNT_SID
        token = config.TWILIO_AUTH_TOKEN
        verify_sid = config.TWILIO_VERIFY_SERVICE_SID
        if not sid or not token or not verify_sid:
            raise OTPProviderError("Twilio Verify is not configured.")
        try:
            response = httpx.post(
                f"https://verify.twilio.com/v2/Services/{verify_sid}/VerificationCheck",
                auth=(sid, token),
                data={"To": destination, "Code": otp},
                timeout=15,
            )
            if response.status_code >= 400:
                return False
            return str(response.json().get("status", "")).lower() == "approved"
        except Exception as exc:
            raise OTPProviderError("Unable to verify OTP with provider.") from exc


def get_otp_provider() -> OTPProvider:
    if config.OTP_PROVIDER == "twilio":
        return TwilioOTPProvider()
    return ConsoleOTPProvider()


def hash_otp(otp: str, salt: str) -> str:
    material = f"{salt}:{otp}:{config.OTP_PEPPER}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_salt() -> str:
    return secrets.token_hex(16)


def otp_matches(otp: str, salt: str, expected_hash: str) -> bool:
    digest = hash_otp(otp, salt)
    return hmac.compare_digest(digest, expected_hash)
