@echo off
title CogniCraft Development Environment

echo 🚀 Starting CogniCraft Development Environment...
echo.

echo Starting Backend Server...
start "CogniCraft Backend" cmd /k "cd backend && npm run dev"

echo Starting Frontend Server...
start "CogniCraft Frontend" cmd /k "npm run dev"

echo.
echo ✅ Development servers started!
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit...
pause > nul 