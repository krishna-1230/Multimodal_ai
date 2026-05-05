# Run from this folder in PowerShell
if (-not (Test-Path .\venv)) {
	python -m venv venv
}
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Install torch with matching CUDA version manually, e.g.:
# pip install torch --extra-index-url https://download.pytorch.org/whl/cu117
# This GPU service is pinned to CUDA device 1 and runs on port 5003.
$env:FLASK_APP = "app.py"
python app.py
