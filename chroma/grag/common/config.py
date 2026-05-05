import os

# General settings
ENV = os.environ.get('RAG_ENV', 'dev')

# CPU defaults
CPU_BATCH_SIZE = int(os.environ.get('CPU_BATCH_SIZE', 64))
CPU_NSEED = int(os.environ.get('CPU_NSEED', 100))
CPU_EF_SEARCH = int(os.environ.get('CPU_EF_SEARCH', 150))
CPU_RERANK_TOPK = int(os.environ.get('CPU_RERANK_TOPK', 10))

# GPU defaults
GPU_BATCH_SIZE = int(os.environ.get('GPU_BATCH_SIZE', 128))
GPU_NSEED = int(os.environ.get('GPU_NSEED', 200))
GPU_INDEX_NLIST = int(os.environ.get('GPU_INDEX_NLIST', 512))
GPU_INDEX_NPROBE = int(os.environ.get('GPU_INDEX_NPROBE', 16))
GPU_RERANK_TOPK = int(os.environ.get('GPU_RERANK_TOPK', 20))

# General tuning
EXPAND_HOPS = int(os.environ.get('EXPAND_HOPS', 1))
REPLACE_OLD_THAN_DAYS = int(os.environ.get('REPLACE_OLD_THAN_DAYS', 30))
