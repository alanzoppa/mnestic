"""Shared constants for the notes browser backend."""


# Chunking
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 400
SNIPPET_MAX_LEN = 200

# Graph
MAX_GRAPH_NODES = 500
MAX_GRAPH_WHERE_IDS = 100

# Similarity
DEFAULT_SIMILAR_N = 10
DEFAULT_SIMILAR_THRESHOLD = 0.75

# Embedding
EMBED_DIM = 256
BATCH_SIZE = 50
EMBED_PREFIX_DOC = "search_document"
EMBED_PREFIX_QUERY = "search_query"

# Note filename
MAX_FILENAME_LEN = 200
MAX_FILENAME_ATTEMPTS = 100