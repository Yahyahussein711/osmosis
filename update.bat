@echo off
REM Double-click this file to publish your latest changes to GitHub Pages.
cd /d "%~dp0"
echo Publishing Osmosis...
git add -A
git commit -m "update"
git push
echo.
echo Done. Your site will refresh in about a minute:
echo https://yahyahussein711.github.io/osmosis/
echo.
pause
