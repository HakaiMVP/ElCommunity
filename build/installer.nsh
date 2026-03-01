!macro customInit
  ; Force close the app if it's running so the installer can overwrite the files
  ExecWait "taskkill /im ElCommunity.exe /f"
!macroend
