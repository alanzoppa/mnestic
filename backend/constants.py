"""Shared constants for the mnestic backend."""


# Chunking
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 400
SNIPPET_MAX_LEN = 200

# Graph
MAX_GRAPH_NODES = 1000
MAX_GRAPH_WHERE_IDS = 250

# Similarity
DEFAULT_SIMILAR_N = 10
DEFAULT_SIMILAR_THRESHOLD = 0.75

# Embedding
EMBED_DIM = 4096
BATCH_SIZE = 50
EMBED_PREFIX_DOC = ""
EMBED_PREFIX_QUERY = "Instruct: Retrieve personal notes about people, projects, and meetings by semantic similarity\nQuery: "
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_EMBED_BATCH_SIZE = 10

# Reranker
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"
RERANK_BATCH_SIZE = 32
RERANK_MAX_CANDIDATES = 100
RERANK_TOP_K = 20

# Note filename
MAX_FILENAME_LEN = 200
MAX_FILENAME_ATTEMPTS = 100