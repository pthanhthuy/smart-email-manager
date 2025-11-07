"""
Label service for managing custom email labels and applying them to emails.

Allows users to create custom labels based on natural language prompts,
and automatically applies labels to matching emails in ChromaDB.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.vector_store import VectorStore

logger = get_logger(__name__)


class LabelService:
    """Service for managing custom email labels."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize label service."""
        self.settings = settings or get_settings()
        self.labels_file = Path(self.settings.labels_storage_path)
        self.labels_file.parent.mkdir(parents=True, exist_ok=True)
        self.llm = ChatOpenAI(
            model=self.settings.openai_model,
            temperature=0.3,
            openai_api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_base_url,
        )
        self._load_labels()

    def _load_labels(self) -> None:
        """Load labels from storage."""
        if self.labels_file.exists():
            try:
                with open(self.labels_file, "r") as f:
                    data = json.load(f)
                    # Handle both dict and list formats
                    if isinstance(data, list):
                        self.labels = {label["id"]: label for label in data}
                    else:
                        self.labels = data
            except Exception as e:
                logger.error("Error loading labels: %s", e)
                self.labels = {}
        else:
            self.labels = {}

    def _save_labels(self) -> None:
        """Save labels to storage."""
        try:
            with open(self.labels_file, "w") as f:
                json.dump(self.labels, f, indent=2)
        except Exception as e:
            logger.error("Error saving labels: %s", e)

    async def create_label(
        self, name: str, description: str, prompt: str, color: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new label definition and auto-apply to matching emails."""
        label_id = f"label_{uuid.uuid4().hex[:12]}"

        label = {
            "id": label_id,
            "name": name,
            "description": description,
            "prompt": prompt,
            "createdAt": datetime.utcnow().isoformat(),
            "emailCount": 0,
            "color": color or "#6b7280",
        }

        self.labels[label_id] = label
        self._save_labels()

        # Auto-apply label to existing emails
        logger.info("Auto-applying new label '%s' to existing emails...", name)
        # Note: auto_apply_label will be called separately via API to avoid blocking
        # email_count = await self.auto_apply_label(label_id)
        # label["emailCount"] = email_count

        logger.info("Created label '%s' (ID: %s)", name, label_id)
        return label

    def get_all_labels(self) -> List[Dict[str, Any]]:
        """Get all labels."""
        return list(self.labels.values())

    def get_label(self, label_id: str) -> Optional[Dict[str, Any]]:
        """Get specific label."""
        return self.labels.get(label_id)

    def update_label(self, label_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update label definition."""
        if label_id not in self.labels:
            raise ValueError(f"Label {label_id} not found")

        # Update allowed fields
        allowed_fields = ["name", "description", "prompt", "color"]
        for field in allowed_fields:
            if field in updates:
                self.labels[label_id][field] = updates[field]

        self.labels[label_id]["updatedAt"] = datetime.utcnow().isoformat()
        self._save_labels()

        # Re-apply label if prompt changed
        if "prompt" in updates:
            logger.info("Re-applying label '%s' due to prompt change...", label_id)

        return self.labels[label_id]

    def delete_label(self, label_id: str) -> bool:
        """Delete label definition."""
        if label_id not in self.labels:
            return False

        del self.labels[label_id]
        self._save_labels()
        logger.info("Deleted label %s", label_id)
        return True

    async def _email_matches_label(self, email: Dict[str, Any], label: Dict[str, Any]) -> bool:
        """Check if email matches label criteria using AI."""
        prompt_template = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are an email classification assistant. Determine if an email matches the given label criteria.

Label Description: {label_description}
Label Criteria: {label_prompt}

Return only "YES" if the email matches the criteria, or "NO" if it doesn't.""",
                ),
                (
                    "human",
                    """Email:
From: {from_field}
Subject: {subject}
Body: {body}

Does this email match the label criteria? Answer YES or NO only.""",
                ),
            ]
        )

        from_field = email.get("from", "Unknown")
        subject = email.get("subject", "No subject")
        body = (email.get("body") or email.get("snippet") or "")[:1000]

        try:
            chain = prompt_template | self.llm
            response = await chain.ainvoke(
                {
                    "label_description": label["description"],
                    "label_prompt": label["prompt"],
                    "from_field": from_field,
                    "subject": subject,
                    "body": body,
                }
            )

            response_text = response.content if hasattr(response, "content") else str(response)
            return response_text.strip().upper() == "YES"
        except Exception as e:
            logger.warning("Error checking label match: %s", e)
            return False

    async def auto_apply_label(self, label_id: str, vector_store: Optional[VectorStore] = None) -> int:
        """Automatically apply label to all matching emails in ChromaDB."""
        if label_id not in self.labels:
            raise ValueError(f"Label {label_id} not found")

        label = self.labels[label_id]

        if not vector_store:
            from app.api.deps import get_vector_store

            vector_store = get_vector_store()

        # Get all emails from ChromaDB
        all_emails = vector_store.get_all_emails(limit=None)
        logger.info("Checking %s emails against label '%s'...", len(all_emails), label["name"])

        matching_emails = []
        skipped_already_labeled = 0
        
        for email_data in all_emails:
            email_id = email_data.get("id")
            metadata = email_data.get("metadata", {})

            # Check if email already has this label
            existing_labels_str = metadata.get("labels", "")
            existing_labels = [l.strip() for l in existing_labels_str.split(",") if l.strip()]
            if label_id in existing_labels:
                skipped_already_labeled += 1
                continue

            # Check if email matches label criteria using AI
            email_dict = {
                "id": email_id,
                "from": metadata.get("from"),
                "subject": metadata.get("subject"),
                "body": email_data.get("document"),
                "snippet": metadata.get("snippet"),
            }

            if await self._email_matches_label(email_dict, label):
                matching_emails.append(email_id)
                logger.debug("Email %s matches label '%s' criteria", email_id, label["name"])
        
        logger.info("Found %s matching emails, %s already have this label, %s will be updated", 
                   len(matching_emails), skipped_already_labeled, len(matching_emails))

        # Update emails in ChromaDB with new label based on found matching emails
        if matching_emails:
            updated_count = await self._update_emails_with_label(vector_store, matching_emails, label_id)
            
            # Update label count based on actual emails with this label in ChromaDB
            all_emails_after = vector_store.get_all_emails(limit=None)
            actual_count = sum(
                1
                for email in all_emails_after
                if label_id in (email.get("metadata", {}).get("labels", "") or "").split(",")
            )
            label["emailCount"] = actual_count
            self._save_labels()
            logger.info("Applied label '%s' to %s emails (updated %s, total now: %s)", 
                       label["name"], len(matching_emails), updated_count, actual_count)
            return updated_count

        logger.info("No matching emails found for label '%s'", label["name"])
        return 0

    async def _update_emails_with_label(
        self, vector_store: VectorStore, email_ids: List[str], label_id: str
    ) -> int:
        """Update emails in ChromaDB with new label. Label becomes the email category (classification)."""
        if label_id not in self.labels:
            raise ValueError(f"Label {label_id} not found")
        
        label = self.labels[label_id]
        label_name = label.get("name", label_id).lower()  # Use label name as category
        
        collection = vector_store.get_collection()
        updated_count = 0

        for email_id in email_ids:
            try:
                # Get current email data with all metadata
                result = collection.get(ids=[email_id], include=["metadatas", "documents"])
                if not result.get("ids"):
                    continue

                old_metadata = result["metadatas"][0]
                old_category = old_metadata.get("category", "other")
                old_labels = old_metadata.get("labels", "")
                
                # Create new metadata dict with all existing fields
                # Label becomes the category (email classification)
                new_metadata = {
                    "subject": old_metadata.get("subject", "No subject"),
                    "from": old_metadata.get("from", "Unknown"),
                    "to": old_metadata.get("to", ""),
                    "date": old_metadata.get("date", ""),
                    "threadId": old_metadata.get("threadId", ""),
                    "snippet": old_metadata.get("snippet", ""),
                    "labels": label_id,  # Store label ID in labels field
                    "important": old_metadata.get("important", "false"),
                    "category": label_name,  # Label name becomes the category (classification)
                    "categoryConfidence": "0.9",  # High confidence since user explicitly applied label
                }
                
                # Log what we're doing
                if old_category != label_name:
                    logger.debug("Replacing old category '%s' with new label category '%s' for email %s", 
                               old_category, label_name, email_id)
                if old_labels and old_labels != label_id:
                    logger.debug("Replacing old labels '%s' with new label '%s' for email %s", 
                               old_labels, label_id, email_id)

                # Update in ChromaDB with the new metadata
                collection.update(ids=[email_id], metadatas=[new_metadata])
                updated_count += 1
                logger.debug("Updated email %s: category='%s' (label: %s)", email_id, label_name, label_id)
            except Exception as e:
                logger.warning("Error updating email %s with label: %s", email_id, e)

        return updated_count

    def apply_label_to_emails(
        self, label_id: str, email_ids: List[str], vector_store: VectorStore
    ) -> int:
        """Manually apply label to specific emails. Label becomes the email category (classification)."""
        if label_id not in self.labels:
            raise ValueError(f"Label {label_id} not found")

        label = self.labels[label_id]
        label_name = label.get("name", label_id).lower()  # Use label name as category

        # Update emails in ChromaDB (synchronous version)
        updated_count = 0
        collection = vector_store.get_collection()

        for email_id in email_ids:
            try:
                result = collection.get(ids=[email_id], include=["metadatas", "documents"])
                if not result.get("ids"):
                    continue

                old_metadata = result["metadatas"][0]
                old_category = old_metadata.get("category", "other")
                old_labels = old_metadata.get("labels", "")
                
                # Create new metadata dict with all existing fields
                # Label becomes the category (email classification)
                new_metadata = {
                    "subject": old_metadata.get("subject", "No subject"),
                    "from": old_metadata.get("from", "Unknown"),
                    "to": old_metadata.get("to", ""),
                    "date": old_metadata.get("date", ""),
                    "threadId": old_metadata.get("threadId", ""),
                    "snippet": old_metadata.get("snippet", ""),
                    "labels": label_id,  # Store label ID in labels field
                    "important": old_metadata.get("important", "false"),
                    "category": label_name,  # Label name becomes the category (classification)
                    "categoryConfidence": "0.9",  # High confidence since user explicitly applied label
                }
                
                # Log what we're doing
                if old_category != label_name:
                    logger.debug("Replacing old category '%s' with new label category '%s' for email %s", 
                               old_category, label_name, email_id)
                if old_labels and old_labels != label_id:
                    logger.debug("Replacing old labels '%s' with new label '%s' for email %s", 
                               old_labels, label_id, email_id)
                
                collection.update(ids=[email_id], metadatas=[new_metadata])
                updated_count += 1
                logger.debug("Applied label %s to email %s: category='%s'", label_id, email_id, label_name)
            except Exception as e:
                logger.warning("Error applying label to email %s: %s", email_id, e)

        # Update label count based on actual updated emails
        if label_id in self.labels:
            # Count how many emails currently have this label
            all_emails = vector_store.get_all_emails(limit=None)
            current_count = sum(
                1
                for email in all_emails
                if label_id in (email.get("metadata", {}).get("labels", "") or "").split(",")
            )
            self.labels[label_id]["emailCount"] = current_count
            self._save_labels()

        return updated_count

    def remove_label_from_emails(
        self, label_id: str, email_ids: List[str], vector_store: VectorStore
    ) -> int:
        """Remove label from specific emails."""
        collection = vector_store.get_collection()
        removed_count = 0

        for email_id in email_ids:
            try:
                result = collection.get(ids=[email_id], include=["metadatas"])
                if not result.get("ids"):
                    continue

                metadata = result["metadatas"][0]
                existing_labels_str = metadata.get("labels", "")
                existing_labels = [l.strip() for l in existing_labels_str.split(",") if l.strip()]

                # Remove label
                if label_id in existing_labels:
                    existing_labels.remove(label_id)
                    metadata["labels"] = ",".join(existing_labels) if existing_labels else ""

                    # Update in ChromaDB
                    collection.update(ids=[email_id], metadatas=[metadata])
                    removed_count += 1
            except Exception as e:
                logger.warning("Error removing label from email %s: %s", email_id, e)

        # Update label count
        if label_id in self.labels:
            self.labels[label_id]["emailCount"] = max(
                0, self.labels[label_id].get("emailCount", 0) - removed_count
            )
            self._save_labels()

        return removed_count

