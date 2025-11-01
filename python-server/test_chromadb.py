#!/usr/bin/env python3
"""Test script for ChromaDB vector store."""

import sys
import os

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def test_chromadb():
    print("Testing ChromaDB vector store...")
    
    try:
        # Test basic ChromaDB import
        import chromadb
        print("✅ ChromaDB imported successfully")
        
        # Test local client creation
        client = chromadb.Client()
        print("✅ Local ChromaDB client created")
        
        # Test cloud client creation (if configured)
        try:
            from app.core import settings
            print(f"ChromaDB settings:")
            print(f"  chroma_use_local: {settings.chroma_use_local}")
            print(f"  chroma_cloud_url: {settings.chroma_cloud_url}")
            print(f"  chroma_tenant: {settings.chroma_tenant}")
            print(f"  chroma_database: {settings.chroma_database}")
            
            if not settings.chroma_use_local and settings.chroma_cloud_url:
                cloud_client = chromadb.HttpClient(
                    host=settings.chroma_cloud_url,
                    tenant=settings.chroma_tenant,
                    database=settings.chroma_database,
                )
                print("✅ Cloud ChromaDB client created")
            
        except Exception as e:
            print(f"⚠️  Settings import failed: {e}")
        
        # Test VectorStore
        from app.services.vector_store import VectorStore
        vs = VectorStore()
        print("✅ VectorStore created successfully")
        
        # Test collection access
        collection = vs.get_collection()
        print("✅ Collection accessed successfully")
        
        # Test stats
        stats = vs.stats()
        print(f"✅ Stats: {stats}")
        
        print("\n🎉 All tests passed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = test_chromadb()
    sys.exit(0 if success else 1)
