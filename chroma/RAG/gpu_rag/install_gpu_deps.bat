@echo off
echo Installing GPU dependencies for RTX 3060...
echo.

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing PyTorch with CUDA 11.8 support...
pip install torch==2.1.2+cu118 torchvision==0.16.2+cu118 torchaudio==2.1.2+cu118 --index-url https://download.pytorch.org/whl/cu118

echo Installing other GPU dependencies...
pip install transformers==4.36.2 accelerate==0.25.0 psutil==5.9.6

echo Installing remaining requirements...
pip install -r requirements.txt

echo.
echo GPU dependencies installation complete!
echo.
echo To test GPU setup, run: python gpu_optimizer.py
echo To start the RAG server, run: python app.py
echo.
pause 