# RAG Search Engine

Wiki.js includes a simple Retrieval Augmented Generation (RAG) search engine. To enable it edit your `config.yml`:

```yml
search:
  engine: rag            # enable the RAG engine
  maxHits: 100           # number of results to return
```

The RAG engine requires an embedding service and a vector store. Configure those parameters from the Admin panel under **Search**:

- **Embedding API Key** – API key for the embedding provider.
- **Vector Store Path** – Local path where embeddings will be stored.

Once configured run the index rebuild from the admin interface to generate embeddings for existing pages.
