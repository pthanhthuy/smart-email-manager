"""
ChromaDB vector store abstraction.

Note: This implementation uses direct ChromaDB API calls with pre-computed embeddings,
which is efficient for our use case. LangChain's Chroma integration is primarily useful
when embeddings are generated automatically, but since we generate embeddings separately
and store them, the direct approach is appropriate. Future enhancements could use
LangChain's Chroma wrapper if we want to leverage LangChain's retriever interface.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import chromadb
from chromadb.api import Collection

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class VectorStore:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._client = None
        self._collection: Optional[Collection] = None

    def _create_client(self):
        if self.settings.chroma_use_local:
            logger.info("Connecting to local ChromaDB")
            return chromadb.Client()
        else:
            logger.info("Connecting to ChromaDB cloud (tenant=%s database=%s)", self.settings.chroma_tenant, self.settings.chroma_database)
            return chromadb.CloudClient(
                tenant=self.settings.chroma_tenant,
                database=self.settings.chroma_database,
                api_key=self.settings.chroma_api_key,
                # optional: disable telemetry
            )

    @property
    def client(self):
        if not self._client:
            self._client = self._create_client()
        return self._client

    def get_collection(self) -> Collection:
        if self._collection:
            return self._collection
        name = self.settings.chroma_collection_name
        try:
            collection = self.client.get_collection(name=name)
            logger.info('Loaded Chroma collection "%s"', name)
        except Exception:
            logger.info('Creating Chroma collection "%s"', name)
            collection = self.client.create_collection(
                name=name,
                metadata={"description": "Email embeddings for semantic search", "hnsw:space": "cosine"},
            )
        self._collection = collection
        return collection

    def add_emails(self, emails: List[dict]) -> int:
        if not emails:
            raise ValueError("No emails to add to vector store.")
        collection = self.get_collection()
        ids = [email["id"] for email in emails]
        embeddings = [email["embedding"] for email in emails]
        metadatas = [
            {
                "subject": email.get("subject") or "No subject",
                "from": email.get("from") or "Unknown",
                "to": email.get("to") or "",
                "date": email.get("date") or "",
                "threadId": email.get("threadId") or "",
                "snippet": email.get("snippet") or "",
                "labels": ",".join(email.get("labels") or []),
                "important": "true" if email.get("important") else "false",
            }
            for email in emails
        ]
        documents = [email.get("embeddingText") or email.get("snippet") or email.get("subject") or "" for email in emails]
        collection.upsert(ids=ids, embeddings=embeddings, metadatas=metadatas, documents=documents)
        logger.info("Upserted %s emails into Chroma", len(ids))
        return len(ids)

    def search(self, query_embedding: List[float], limit: int = 10) -> List[dict]:
        collection = self.get_collection()
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            include=["metadatas", "documents", "distances"],
        )
        matches: List[dict] = []
        ids = results.get("ids", [[]])[0]
        if not ids:
            return matches
        metadatas = results.get("metadatas", [[]])[0]
        documents = results.get("documents", [[]])[0]
        distances = results.get("distances", [[]])[0]
        for idx, email_id in enumerate(ids):
            distance = distances[idx] if distances else None
            metadata = metadatas[idx] if metadatas else {}
            matches.append(
                {
                    "id": email_id,
                    "metadata": metadata,
                    "document": documents[idx] if documents else None,
                    "distance": distance,
                    "similarity": 1 - distance if distance is not None else None,
                }
            )
        return matches

    def stats(self) -> Dict[str, Any]:
        collection = self.get_collection()
        count = collection.count()
        return {
            "totalEmails": count,
            "collectionName": self.settings.chroma_collection_name,
            "ready": True,
        }

    def delete(self, ids: List[str]) -> int:
        collection = self.get_collection()
        collection.delete(ids=ids)
        return len(ids)

    def clear(self) -> bool:
        if not self._client:
            return True
        name = self.settings.chroma_collection_name
        self.client.delete_collection(name=name)
        self._collection = None
        return True

