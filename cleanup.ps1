Get-ChildItem .claude\worktrees | ForEach-Object {
    try { Remove-Item $_.FullName -Recurse -Force -ErrorAction Stop; Write-Host "Removed: $($_.Name)" }
    catch { Write-Host "Skipped (locked): $($_.Name)" }
}
git worktree prune
git worktree list
