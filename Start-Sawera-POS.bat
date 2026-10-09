@echo off
title Sawera Sweets & Bakers POS - Local Server
echo ======================================================================
echo          SAWERA SWEETS & BAKERS - POS SYSTEM (LOCAL SERVER)
echo ======================================================================
echo.
echo  * Database: Hard Drive (data\sawera_pos.sqlite) - 100%% Permanent
echo  * Opening POS in browser: http://localhost:5000
echo.
echo  To close software, simply close this window.
echo ======================================================================
echo.

cd /d "%~dp0"

REM Open default browser
start "" "http://localhost:5000"

REM Run Node.js production server
node server.js

pause
