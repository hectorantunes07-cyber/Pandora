!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "PANDORA — Created by Sonnier"
  !define MUI_WELCOMEPAGE_TEXT "Unlock your PC's potential with local hardware diagnostics and reversible Windows settings.$\r$\n$\r$\nPANDORA does not promise FPS improvements. You review system changes before applying them.$\r$\n$\r$\nThis build is not digitally signed. Publisher metadata does not establish verified publisher status."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Uninstall PANDORA"
  !define MUI_WELCOMEPAGE_TEXT "Before uninstalling, open PANDORA and use Backups & Restore to revert any changes you no longer want.$\r$\n$\r$\nUninstalling removes the app. It does not silently change Windows settings or remove your local rollback history. Keep that history if you may reinstall PANDORA."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
