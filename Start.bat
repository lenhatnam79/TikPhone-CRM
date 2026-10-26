@echo off
cd /d "%~dp0"
python app\server.py --devices
pause
