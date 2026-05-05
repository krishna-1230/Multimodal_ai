# Run from project root in PowerShell
cd .\cpu_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:FLASK_APP = "app.py"
python app.py
