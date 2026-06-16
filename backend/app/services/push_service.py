import httpx


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notification(
    expo_push_token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    payload = {
        "to": expo_push_token,
        "title": title,
        "body": body,
        "data": data or {},
        "sound": "default",
    }

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(EXPO_PUSH_URL, json=payload, headers=headers)
            print(f"Expo push response status_code: {response.status_code}")

            try:
                response_json = response.json()
                print(f"Expo push response json: {response_json}")
            except ValueError:
                response_json = None
                print(f"Expo push response text: {response.text}")

            response.raise_for_status()

            if isinstance(response_json, dict):
                items = response_json.get("data", [])
                if not isinstance(items, list):
                    items = [items]

                for index, item in enumerate(items):
                    if not isinstance(item, dict):
                        print(f"Expo push data[{index}] beklenmeyen format: {item}")
                        continue

                    item_status = item.get("status")
                    item_message = item.get("message")
                    details = item.get("details") or {}
                    details_error = details.get("error") if isinstance(details, dict) else None
                    ticket_id = item.get("id")

                    print(
                        "Expo push sonucu "
                        f"data[{index}]: status={item_status}, "
                        f"message={item_message}, "
                        f"details.error={details_error}, "
                        f"ticket_id={ticket_id}"
                    )

                    if item_status == "error":
                        print(
                            "Expo push status error: "
                            f"message={item_message}, details.error={details_error}, ticket_id={ticket_id}"
                        )
    except Exception as exc:
        print(f"Expo push notification gonderilemedi: {exc}")
