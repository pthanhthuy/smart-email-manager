/**
 * FILE #1: Embedding Service
 * Purpose: Convert text to vector embeddings using OpenAI
 * 
 * What this does:
 * - Takes email text (subject + body)
 * - Calls OpenAI Embeddings API
 * - Returns vector (1,536 numbers representing meaning)
 */

const OpenAI = require('openai');

// Initialize OpenAI client for embeddings
// Uses custom key and base URL if provided
const openai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY_FOR_TEXT_EMBEDDING,
  baseURL: process.env.OPENAI_BASE_URL
});

/**
 * Generate embedding for a single text
 * @param {string} text - Text to convert to embedding
 * @returns {Promise<number[]>} - Vector embedding (1,536 numbers)
 */
async function generateEmbedding(text) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    console.log(`Generating embedding for text (${text.length} chars)...`);

    // Call OpenAI Embeddings API
    const response = await openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    });

    const embedding = response.data[0].embedding;
    console.log(`✅ Embedding generated (${embedding.length} dimensions)`);

    return embedding;

  } catch (error) {
    console.error('❌ Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to convert
 * @returns {Promise<number[][]>} - Array of vector embeddings
 */
async function generateEmbeddings(texts) {
  try {
    if (!texts || texts.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    console.log(`Generating embeddings for ${texts.length} texts...`);

    // OpenAI supports batch embeddings (up to 2048 texts per request)
    const response = await openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float'
    });

    const embeddings = response.data.map(item => item.embedding);
    console.log(`✅ Generated ${embeddings.length} embeddings`);

    return embeddings;

  } catch (error) {
    console.error('❌ Error generating embeddings:', error.message);
    throw error;
  }
}

/**
 * Process emails and generate embeddings
 * @param {Array} emails - Array of email objects
 * @returns {Promise<Array>} - Emails with embeddings added
 */
async function generateEmailEmbeddings(emails) {
  try {
    console.log(`\n📊 Processing ${emails.length} emails for embeddings...`);

    // Prepare texts (combine subject + body for better context)
    const texts = emails.map(email => {
      // Combine subject and snippet/body for embedding
      const subject = email.subject || 'No subject';
      const body = email.snippet || email.body || '';
      return `${subject}\n${body}`;
    });

    // Generate embeddings in batch (efficient!)
    const embeddings = await generateEmbeddings(texts);

    // Attach embeddings to email objects
    const emailsWithEmbeddings = emails.map((email, index) => ({
      ...email,
      embedding: embeddings[index],
      embeddingText: texts[index] // Store what we embedded (for debugging)
    }));

    console.log(`✅ All emails processed with embeddings!\n`);
    return emailsWithEmbeddings;

  } catch (error) {
    console.error('❌ Error processing email embeddings:', error.message);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * (Useful for local testing/comparison)
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Similarity score (0-1, higher = more similar)
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = {
  generateEmbedding,
  generateEmbeddings,
  generateEmailEmbeddings,
  cosineSimilarity
};

