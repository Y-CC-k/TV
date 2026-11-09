' TvWall auto-start launcher (no window flash).
' Runs the newest TvWall-*.exe inside this file's folder, so the timestamp-named
' exe from "npm run dist" always gets picked up without editing this script.
Option Explicit

Dim fso, folder, file, newest, newestDate, shell
Set fso = CreateObject("Scripting.FileSystemObject")
Set folder = fso.GetFolder(fso.GetParentFolderName(WScript.ScriptFullName))
Set newest = Nothing

For Each file In folder.Files
  If LCase(fso.GetExtensionName(file.Name)) = "exe" And InStr(1, file.Name, "TvWall", vbTextCompare) = 1 Then
    If newest Is Nothing Then
      Set newest = file
      newestDate = file.DateLastModified
    ElseIf file.DateLastModified > newestDate Then
      Set newest = file
      newestDate = file.DateLastModified
    End If
  End If
Next

If newest Is Nothing Then WScript.Quit 1

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = folder.Path
shell.Run """" & newest.Path & """", 1, False
