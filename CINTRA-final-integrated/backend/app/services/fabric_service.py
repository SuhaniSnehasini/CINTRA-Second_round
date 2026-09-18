import httpx

from ..config import (
    FABRIC_ENABLED,
    FABRIC_GATEWAY_TIMEOUT_SECONDS,
    FABRIC_GATEWAY_URL,
)


class FabricServiceError(Exception):
    """Raised when communication with the Fabric Gateway fails."""

    pass


def _gateway_url(path: str) -> str:
    """Build a URL for the Fabric Gateway."""
    return f"{FABRIC_GATEWAY_URL.rstrip('/')}{path}"


def record_custody_event(
    *,
    evidence_id: str,
    event_id: str,
    action: str,
    actor_badge_id: str | None,
    from_custodian: str | None,
    to_custodian: str | None,
    reason: str | None,
    file_sha256: str,
    timestamp: str,
) -> dict:
    """
    Record one custody event on Hyperledger Fabric.
    """

    if not FABRIC_ENABLED:
        raise FabricServiceError(
            "Hyperledger Fabric integration is disabled."
        )

    payload = {
        "evidence_id": evidence_id,
        "event_id": event_id,
        "action": action,
        "actor_badge_id": actor_badge_id,
        "from_custodian": from_custodian,
        "to_custodian": to_custodian,
        "reason": reason,
        "file_sha256": file_sha256,
        "timestamp": timestamp,
    }

    url = _gateway_url("/api/fabric/custody")

    try:
        with httpx.Client(
            timeout=FABRIC_GATEWAY_TIMEOUT_SECONDS
        ) as client:
            response = client.post(
                url,
                json=payload,
            )

    except httpx.RequestError as exc:
        raise FabricServiceError(
            "Unable to connect to the Fabric Gateway: "
            f"{str(exc)}"
        ) from exc

    try:
        response_data = response.json()
    except ValueError as exc:
        raise FabricServiceError(
            "Fabric Gateway returned an invalid JSON response."
        ) from exc

    if response.status_code >= 400:
        message = response_data.get(
            "message",
            "Fabric Gateway request failed.",
        )

        gateway_error = response_data.get("error")

        if gateway_error:
            message = f"{message} Details: {gateway_error}"

        raise FabricServiceError(message)

    if not response_data.get("success"):
        raise FabricServiceError(
            response_data.get(
                "message",
                "Fabric transaction was not successful.",
            )
        )

    if response_data.get("blockchain_status") != "RECORDED":
        raise FabricServiceError(
            "Fabric Gateway did not confirm the custody event as RECORDED."
        )

    transaction_id = response_data.get("transaction_id")

    if not transaction_id:
        raise FabricServiceError(
            "Fabric Gateway did not return a blockchain transaction ID."
        )

    return response_data


def get_fabric_history(evidence_id: str) -> dict:
    """
    Retrieve custody history from Hyperledger Fabric.
    """

    if not FABRIC_ENABLED:
        raise FabricServiceError(
            "Hyperledger Fabric integration is disabled."
        )

    url = _gateway_url(
        f"/api/fabric/custody/{evidence_id}"
    )

    try:
        with httpx.Client(
            timeout=FABRIC_GATEWAY_TIMEOUT_SECONDS
        ) as client:
            response = client.get(url)

    except httpx.RequestError as exc:
        raise FabricServiceError(
            "Unable to connect to the Fabric Gateway: "
            f"{str(exc)}"
        ) from exc

    try:
        response_data = response.json()
    except ValueError as exc:
        raise FabricServiceError(
            "Fabric Gateway returned an invalid JSON response."
        ) from exc

    if response.status_code >= 400:
        message = response_data.get(
            "message",
            "Fabric history query failed.",
        )

        gateway_error = response_data.get("error")

        if gateway_error:
            message = f"{message} Details: {gateway_error}"

        raise FabricServiceError(message)

    if not response_data.get("success"):
        raise FabricServiceError(
            response_data.get(
                "message",
                "Fabric history query failed.",
            )
        )

    return response_data
