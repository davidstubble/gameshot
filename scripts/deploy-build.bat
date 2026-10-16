@echo off
REM ========================================================
REM GameShot Deployment Script (Windows)
REM Supports: Local Build, Docker Container, and Vercel/Cloud
REM ========================================================

echo [1/4] Checking environment...
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo pnpm not found. Using npx pnpm...
    set PNPM_CMD=npx --yes pnpm@9.12.0
) else (
    set PNPM_CMD=pnpm
)

echo [2/4] Installing dependencies...
call %PNPM_CMD% install --frozen-lockfile
if %ERRORLEVEL% NEQ 0 (
    echo Error during dependency installation.
    exit /b %ERRORLEVEL%
)

echo [3/4] Building web application bundle...
call %PNPM_CMD% run build:web
if %ERRORLEVEL% NEQ 0 (
    echo Error during web build.
    exit /b %ERRORLEVEL%
)

echo [4/4] Building production server...
call %PNPM_CMD% run build
if %ERRORLEVEL% NEQ 0 (
    echo Error during server build.
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo GameShot Build Complete!
echo.
echo To run the production server locally:
echo   %PNPM_CMD% run start
echo.
echo To run via Docker container:
echo   docker build -t gameshot:latest .
echo   docker run -p 3000:3000 gameshot:latest
echo ========================================================
