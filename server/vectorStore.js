/**
 * FILE #2: Vector Store
 * Purpose: Store and search email embeddings in ChromaDB Cloud
 * 
 * What this does:
 * - Connect to ChromaDB Cloud
 * - Store email embeddings with metadata
 * - Search for similar emails (semantic search!)
 * - Return matching results
 */

const { ChromaClient, CloudClient } = require('chromadb');

// Global client instance
let chromaClient = null;
let collection = null;

/**
 * Initialize ChromaDB client
 * @returns {Promise<ChromaClient>} - ChromaDB client
 */
async function initChroma() {
  try {
    if (chromaClient) {
      console.log('ℹ️ ChromaDB client already initialized');
      return chromaClient;
    }

    // Check if using local or cloud
    const useLocal = process.env.CHROMA_USE_LOCAL === 'true';

    if (useLocal) {
      // Local ChromaDB
      console.log('🔌 Connecting to local ChromaDB...');
      chromaClient = new ChromaClient();
      console.log('✅ Connected to local ChromaDB');
    } else {
      // ChromaDB Cloud - use CloudClient
      console.log('🔌 Connecting to ChromaDB Cloud...');
      console.log(`   Tenant: ${process.env.CHROMA_TENANT}`);
      console.log(`   Database: ${process.env.CHROMA_DATABASE}`);
      
      chromaClient = new CloudClient({
        apiKey: process.env.CHROMA_API_KEY,
        tenant: process.env.CHROMA_TENANT,
        database: process.env.CHROMA_DATABASE
      });
      
      console.log('✅ Connected to ChromaDB Cloud');
    }

    return chromaClient;

  } catch (error) {
    console.error('❌ Error initializing ChromaDB:', error.message);
    console.error('   Full error:', error);
    throw error;
  }
}

/**
 * Get or create email collection
 * @returns {Promise<Collection>} - ChromaDB collection
 */
async function getCollection() {
  try {
    if (collection) {
      return collection;
    }

    const client = await initChroma();
    const collectionName = process.env.CHROMA_COLLECTION_NAME || 'email-embeddings';

    console.log(`📦 Getting collection: ${collectionName}...`);

    // Try to get existing collection, create if doesn't exist
    try {
      collection = await client.getCollection({
        name: collectionName
      });
      console.log(`✅ Collection "${collectionName}" loaded`);
    } catch (error) {
      // Collection doesn't exist, create it
      console.log(`📦 Creating new collection: ${collectionName}...`);
      collection = await client.createCollection({
        name: collectionName,
        metadata: {
          description: 'Email embeddings for semantic search',
          'hnsw:space': 'cosine' // Use cosine similarity
        }
      });
      console.log(`✅ Collection "${collectionName}" created`);
    }

    return collection;

  } catch (error) {
    console.error('❌ Error getting collection:', error.message);
    throw error;
  }
}

/**
 * Add emails to ChromaDB
 * @param {Array} emails - Array of email objects with embeddings
 * @returns {Promise<number>} - Number of emails added
 */
async function addEmails(emails) {
  try {
    if (!emails || emails.length === 0) {
      throw new Error('No emails to add');
    }

    console.log(`\n💾 Adding ${emails.length} emails to ChromaDB...`);

    const coll = await getCollection();

    // Prepare data for ChromaDB
    const ids = [];
    const embeddings = [];
    const metadatas = [];
    const documents = [];

    for (const email of emails) {
      // Use email ID as unique identifier
      ids.push(email.id);

      // The embedding vector
      embeddings.push(email.embedding);

      // Metadata (searchable fields)
      metadatas.push({
        subject: email.subject || 'No subject',
        from: email.from || 'Unknown',
        to: email.to || '',
        date: email.date || '',
        threadId: email.threadId || '',
        snippet: (email.snippet || '').substring(0, 200), // Limit length
        labels: (email.labels || []).join(','),
        important: email.important ? 'true' : 'false'
      });

      // Document text (for reference)
      documents.push(email.embeddingText || email.snippet || email.subject);
    }

    // Add to ChromaDB (will upsert if IDs already exist)
    await coll.upsert({
      ids,
      embeddings,
      metadatas,
      documents
    });

    console.log(`✅ Added ${emails.length} emails to ChromaDB!\n`);
    return emails.length;

  } catch (error) {
    console.error('❌ Error adding emails to ChromaDB:', error.message);
    throw error;
  }
}

/**
 * Search for similar emails
 * @param {number[]} queryEmbedding - Query vector embedding
 * @param {number} limit - Number of results to return
 * @param {object} filter - Optional metadata filter
 * @returns {Promise<Array>} - Array of matching emails
 */
async function searchEmails(queryEmbedding, limit = 10, filter = null) {
  try {
    console.log(`\n🔍 Searching ChromaDB (limit: ${limit})...`);

    const coll = await getCollection();

    // Query ChromaDB
    const results = await coll.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      include: ['metadatas', 'documents', 'distances']
    });

    // Process results
    const matches = [];
    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        matches.push({
          id: results.ids[0][i],
          metadata: results.metadatas[0][i],
          document: results.documents[0][i],
          distance: results.distances[0][i],
          similarity: 1 - results.distances[0][i] // Convert distance to similarity (0-1)
        });
      }
    }

    console.log(`✅ Found ${matches.length} matching emails\n`);
    return matches;

  } catch (error) {
    console.error('❌ Error searching ChromaDB:', error.message);
    throw error;
  }
}

/**
 * Get collection stats
 * @returns {Promise<object>} - Collection statistics
 */
async function getStats() {
  try {
    const coll = await getCollection();
    const count = await coll.count();

    return {
      totalEmails: count,
      collectionName: process.env.CHROMA_COLLECTION_NAME || 'email-embeddings',
      ready: true
    };

  } catch (error) {
    console.error('❌ Error getting stats:', error.message);
    return {
      totalEmails: 0,
      ready: false,
      error: error.message
    };
  }
}

/**
 * Delete emails from collection
 * @param {string[]} ids - Array of email IDs to delete
 * @returns {Promise<number>} - Number of emails deleted
 */
async function deleteEmails(ids) {
  try {
    if (!ids || ids.length === 0) {
      throw new Error('No email IDs provided');
    }

    console.log(`🗑️ Deleting ${ids.length} emails from ChromaDB...`);

    const coll = await getCollection();
    await coll.delete({ ids });

    console.log(`✅ Deleted ${ids.length} emails`);
    return ids.length;

  } catch (error) {
    console.error('❌ Error deleting emails:', error.message);
    throw error;
  }
}

/**
 * Clear entire collection
 * @returns {Promise<boolean>} - Success status
 */
async function clearCollection() {
  try {
    console.log('🗑️ Clearing entire collection...');

    const client = await initChroma();
    const collectionName = process.env.CHROMA_COLLECTION_NAME || 'email-embeddings';

    // Delete collection
    await client.deleteCollection({ name: collectionName });

    // Reset collection reference
    collection = null;

    console.log('✅ Collection cleared');
    return true;

  } catch (error) {
    console.error('❌ Error clearing collection:', error.message);
    throw error;
  }
}

module.exports = {
  initChroma,
  getCollection,
  addEmails,
  searchEmails,
  getStats,
  deleteEmails,
  clearCollection
};

