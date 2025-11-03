"""
Response history persistence service (JSON file, similar to Node implementation).
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.models import SmartReplySuggestion

logger = get_logger(__name__)


class ResponseHistoryService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.history_file = Path(self.settings.response_history_path)
        self.max_history_size = 100

    def _load_history(self) -> List[Dict[str, Any]]:
        if not self.history_file.exists():
            return []
        try:
            with self.history_file.open("r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            logger.error("Response history file is corrupted. Resetting to empty list.")
            return []

    def _save_history(self, history: List[Dict[str, Any]]) -> None:
        self.history_file.parent.mkdir(parents=True, exist_ok=True)
        with self.history_file.open("w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, default=str)

    async def add_history_entry(
        self,
        email_data: Dict[str, Any],
        user_instruction: str,
        suggestions: List[SmartReplySuggestion],
        analysis: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        history = self._load_history()
        entry_id = f"hist_{int(datetime.utcnow().timestamp()*1000)}"
        stored_suggestions: List[Dict[str, Any]] = []
        for suggestion in suggestions:
            data = suggestion.dict()
            if not data.get("id"):
                data["id"] = f"sug_{uuid4().hex[:8]}"
            data.setdefault("selected", False)
            stored_suggestions.append(data)

        entry = {
            "id": entry_id,
            "timestamp": datetime.utcnow().isoformat(),
            "email": {
                "from": email_data.get("from"),
                "subject": email_data.get("subject"),
                "date": email_data.get("date"),
                "threadId": email_data.get("threadId"),
            },
            "userInstruction": user_instruction,
            "suggestions": stored_suggestions,
            "analysis": analysis,
            "metadata": {**metadata, "historyId": entry_id},
            "status": "generated",
        }
        history.insert(0, entry)
        if len(history) > self.max_history_size:
            history = history[: self.max_history_size]
        self._save_history(history)
        logger.info("Added response history entry %s", entry_id)
        return entry

    async def get_history(self, options: Dict[str, Any]) -> Dict[str, Any]:
        history = self._load_history()
        filtered = history
        status = options.get("status")
        if status:
            filtered = [entry for entry in filtered if entry.get("status") == status]

        start_date = options.get("startDate")
        if start_date:
            filtered = [
                entry
                for entry in filtered
                if entry.get("timestamp") and entry["timestamp"] >= start_date
            ]

        end_date = options.get("endDate")
        if end_date:
            filtered = [
                entry
                for entry in filtered
                if entry.get("timestamp") and entry["timestamp"] <= end_date
            ]

        sender = options.get("sender")
        if sender:
            filtered = [
                entry
                for entry in filtered
                if sender.lower() in (entry.get("email", {}).get("from", "") or "").lower()
            ]

        limit = int(options.get("limit", 20))
        filtered = filtered[:limit]

        stats = {
            "emailsIndexed": len(filtered),
            "aiResponses": len(filtered),
            "timeSaved": round(len(filtered) * 0.08, 1),
        }

        return {
            "success": True,
            "count": len(filtered),
            "total": len(history),
            "entries": filtered,
            "stats": stats,
        }

    async def get_history_entry(self, history_id: str) -> Dict[str, Any]:
        history = self._load_history()
        for entry in history:
            if entry.get("id") == history_id:
                return {"success": True, "entry": entry}
        raise ValueError(f"History entry not found: {history_id}")

    async def mark_suggestion_selected(self, history_id: str, suggestion_id: str) -> Dict[str, Any]:
        history = self._load_history()
        for entry in history:
            if entry.get("id") == history_id:
                for suggestion in entry.get("suggestions", []):
                    suggestion["selected"] = suggestion.get("id") == suggestion_id
                entry["status"] = "selected"
                entry["selectedAt"] = datetime.utcnow().isoformat()
                self._save_history(history)
                return {"success": True, "message": "Suggestion marked as selected", "entry": entry}
        raise ValueError(f"History entry not found: {history_id}")

    async def mark_saved_to_draft(self, history_id: str, draft_id: str) -> Dict[str, Any]:
        history = self._load_history()
        for entry in history:
            if entry.get("id") == history_id:
                entry["status"] = "saved_to_draft"
                entry["savedToDraftAt"] = datetime.utcnow().isoformat()
                entry["draftId"] = draft_id
                self._save_history(history)
                return {"success": True, "message": "Marked as saved to draft", "entry": entry}
        raise ValueError(f"History entry not found: {history_id}")

    async def clear_history(self, clear_all: bool) -> Dict[str, Any]:
        history = self._load_history()
        if clear_all:
            history = []
        else:
            history = history[:10]
        self._save_history(history)
        return {"success": True, "message": "All history cleared" if clear_all else "Old history cleared"}

    async def get_user_preferences(self) -> Dict[str, Any]:
        history = self._load_history()
        preferences = {
            "totalGenerations": len(history),
            "selectedResponses": len([entry for entry in history if entry.get("status") == "selected"]),
            "savedToDraft": len([entry for entry in history if entry.get("status") == "saved_to_draft"]),
            "preferredTones": {},
            "preferredTypes": {},
            "averageResponseLength": 0,
            "mostActiveSenders": {},
        }

        selected = []
        for entry in history:
            sender = entry.get("email", {}).get("from")
            if sender:
                preferences["mostActiveSenders"][sender] = preferences["mostActiveSenders"].get(sender, 0) + 1
            for suggestion in entry.get("suggestions", []):
                if suggestion.get("selected"):
                    selected.append(suggestion)
                    tone = suggestion.get("tone")
                    if tone:
                        preferences["preferredTones"][tone] = preferences["preferredTones"].get(tone, 0) + 1
                    suggestion_type = suggestion.get("type")
                    if suggestion_type:
                        preferences["preferredTypes"][suggestion_type] = preferences["preferredTypes"].get(suggestion_type, 0) + 1

        if selected:
            total_length = sum(len(suggestion.get("text", "")) for suggestion in selected)
            preferences["averageResponseLength"] = round(total_length / len(selected))

        return {"success": True, "preferences": preferences}

    async def test_with_sample_data(self) -> Dict[str, Any]:
        sample_email = {
            "from": "Sarah Johnson <sarah@company.com>",
            "subject": "Project Meeting Next Week",
            "date": "2025-01-20",
            "threadId": "thread_123",
        }
        sample_suggestions = [
            {
                "id": "sug_1",
                "type": "accept",
                "text": "Yes, I can join the meeting. What is the agenda?",
                "emoji": "✅",
                "tone": "professional",
            },
            {
                "id": "sug_2",
                "type": "decline",
                "text": "Sorry, I am not available for that time.",
                "emoji": "❌",
                "tone": "professional",
            },
            {
                "id": "sug_3",
                "type": "modify",
                "text": "Can we discuss the agenda first?",
                "emoji": "🔄",
                "tone": "professional",
            },
        ]
        sample_analysis = {
            "emailType": "meeting_invitation",
            "urgency": "medium",
            "tone": "professional",
            "keyPoints": ["Tuesday 2pm", "project meeting"],
        }
        sample_metadata = {
            "model": "gpt-4o-mini",
            "tokensUsed": 550,
            "cost": "0.0825",
        }
        entry = await self.add_history_entry(sample_email, "I want to accept but ask for the agenda", [SmartReplySuggestion(**s) for s in sample_suggestions], sample_analysis, sample_metadata)
        history = await self.get_history({"limit": 5})
        preferences = await self.get_user_preferences()
        return {
            "success": True,
            "message": "Response history service test completed",
            "historyEntry": entry,
            "historyCount": history["count"],
            "preferences": preferences["preferences"],
        }

