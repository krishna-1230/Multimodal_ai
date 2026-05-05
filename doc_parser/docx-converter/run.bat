@echo off

REM Activate the virtual environment
call .\venv\Scripts\activate.bat

REM Set Flask application
set FLASK_APP=app.py

REM Run the Flask application
flask run

REM Keep window open after execution
pause
