@echo off
rem  Build the psss screensaver host.
rem
rem  vcvars64 is called because the ILC/link step of a self-contained publish invokes
rem  `vswhere.exe` BARE, and when it is not on PATH the failure surfaces as MSB3073 with
rem  vswhere's own stderr folded into the linker command line — measured 2026-09-14 while
rem  retiring the plan's first risk. Adjust the two paths if Visual Studio moves.
set "PATH=C:\Program Files (x86)\Microsoft Visual Studio\Installer;%PATH%"
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
cd /d "%~dp0"
dotnet publish -c Release %*
