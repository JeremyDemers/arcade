from __future__ import annotations

import unittest

from app.repository import leaderboard_key, normalized_username, public_user_id


class RepositoryHelpersTests(unittest.TestCase):
    def test_high_scores_sort_before_lower_scores(self) -> None:
        high = leaderboard_key("tetris", 50_000, "2026-01-01T00:00:00Z", "a")
        low = leaderboard_key("tetris", 5_000, "2026-01-01T00:00:00Z", "b")
        self.assertLess(high, low)

    def test_tied_scores_sort_oldest_first(self) -> None:
        older = leaderboard_key("neon-shatter", 10_000, "2026-01-01T00:00:00Z", "a")
        newer = leaderboard_key("neon-shatter", 10_000, "2026-01-02T00:00:00Z", "b")
        self.assertLess(older, newer)

    def test_identity_helpers_are_stable(self) -> None:
        identity = {"name": "Jeremy  Demers!", "email": "jeremy@example.com"}
        self.assertEqual(normalized_username(identity), "jeremy_demers")
        self.assertEqual(public_user_id("abc"), public_user_id("abc"))
        self.assertEqual(len(public_user_id("abc")), 16)


if __name__ == "__main__":
    unittest.main()
