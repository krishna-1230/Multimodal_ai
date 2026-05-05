# RAG Microservices - PowerShell run instructions

# GPU service
cd .\gpu
if (-not (Test-Path .\venv)) {
	python -m venv venv
}
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Install torch with appropriate CUDA for your GPU before running GPU service
# Example: pip install torch --extra-index-url https://download.pytorch.org/whl/cu117
# The GPU service is pinned to CUDA device 1 and runs on port 5003.
python app.py

# Notes:
# - The GPU service uses `chroma_db_gpu`, `graph_db.sqlite`, and `graph_user_<user_id>.gpickle` for persistence.
# - Graph RAG is implemented with NetworkX plus SQLite persistence, not Neo4j.
# - Point the calling backend to port 5003 for the GPU service.
