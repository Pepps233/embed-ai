


class EmbeddingService:
    """
    Service for generating embeddings using BGE / Instructor models.
    """

    def __init__(self):
        self.model = None
        self.model_name = "BAAI/bge-small-en-v1.5"

    async def initialize(self):
        """Load the embedding model."""
        pass

    async def embed_text(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        raise NotImplementedError("Embedding service not yet implemented")

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts."""
        raise NotImplementedError("Embedding service not yet implemented")

embedding_service = EmbeddingService()
