const _ = require('lodash')
const crypto = require('crypto')

/* global WIKI */

module.exports = {
  async activate() {
    // not used
  },
  async deactivate() {
    // not used
  },
  /**
   * INIT
   */
  async init() {
    WIKI.logger.info('(SEARCH/RAG) Initializing...')
    // Connect to vector store or embedding service
    this.store = new Map()
    WIKI.logger.info('(SEARCH/RAG) Initialization completed.')
  },
  /**
   * Compute embedding for text
   * @param {String} text
   * @returns {Array<number>} embedding vector
   */
  embed(text = '') {
    const hash = crypto.createHash('sha256').update(text).digest()
    return Array.from(hash).map(b => b / 255)
  },
  cosineSimilarity(a = [], b = []) {
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    return (normA && normB) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0
  },
  /**
   * QUERY
   *
   * @param {String} q Query
   * @param {Object} opts Additional options
   */
  async query(q, opts) {
    try {
      const queryEmbedding = this.embed(q)
      let matches = []
      for (let [id, doc] of this.store.entries()) {
        if (opts.locale && opts.locale !== doc.page.localeCode) {
          continue
        }
        if (opts.path && !doc.page.path.startsWith(opts.path)) {
          continue
        }
        const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding)
        matches.push({ similarity, page: doc.page })
      }
      matches = _.orderBy(matches, 'similarity', 'desc').slice(0, WIKI.config.search.maxHits)
      return {
        results: matches.map(r => ({
          id: r.page.id || r.page.hash,
          locale: r.page.localeCode,
          path: r.page.path,
          title: r.page.title,
          description: r.page.description
        })),
        suggestions: [],
        totalHits: matches.length
      }
    } catch (err) {
      WIKI.logger.warn('Search Engine Error:')
      WIKI.logger.warn(err)
    }
  },
  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created(page) {
    const embedding = this.embed(page.safeContent)
    this.store.set(page.hash, { embedding, page })
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    const embedding = this.embed(page.safeContent)
    this.store.set(page.hash, { embedding, page })
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    this.store.delete(page.hash)
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    const doc = this.store.get(page.hash)
    if (doc) {
      this.store.delete(page.hash)
      doc.page.path = page.destinationPath
      doc.page.localeCode = page.destinationLocaleCode
      this.store.set(page.destinationHash, doc)
    }
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    WIKI.logger.info('(SEARCH/RAG) Rebuilding Index...')
    this.store.clear()
    const pages = await WIKI.models.knex
      .column({ id: 'hash' }, 'path', { locale: 'localeCode' }, 'title', 'description', 'render')
      .select()
      .from('pages')
      .where({ isPublished: true, isPrivate: false })
    for (let page of pages) {
      const content = WIKI.models.pages.cleanHTML(page.render)
      const embedding = this.embed(content)
      this.store.set(page.id, {
        embedding,
        page: {
          id: page.id,
          localeCode: page.locale,
          path: page.path,
          title: page.title,
          description: page.description
        }
      })
    }
    WIKI.logger.info('(SEARCH/RAG) Index rebuilt successfully.')
  }
}
