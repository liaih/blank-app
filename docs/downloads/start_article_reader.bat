@echo off
cd /d "%~dp0"
py -3 -m pip install beautifulsoup4==4.14.3
if errorlevel 1 goto done
py -3 article_reader.py
:done
pause
