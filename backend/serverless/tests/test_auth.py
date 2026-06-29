from __future__ import annotations

import time
import unittest

from app.auth import create_token, decode_token


class TokenTests(unittest.TestCase):
    def test_round_trip(self) -> None:
        token = create_token("google-subject", "player", secret="x" * 48)
        payload = decode_token(token, secret="x" * 48)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["sub"], "google-subject")
        self.assertEqual(payload["username"], "player")
        self.assertGreater(payload["exp"], time.time())

    def test_rejects_wrong_secret(self) -> None:
        token = create_token("google-subject", "player", secret="x" * 48)
        self.assertIsNone(decode_token(token, secret="y" * 48))


if __name__ == "__main__":
    unittest.main()
