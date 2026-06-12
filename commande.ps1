Get-Children C:\Program Files\Microsoft VS Code -Recurse -File |
Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-30)} |
Sort-Object LastWriteTime -Descending |
Select-Object LastWriteTime, FullName
