# Sourced (". ./in-mode.sh"), never run.
# Reads the hook payload into $input and exits the hook command when the session
# is not in poteto mode.
# `read -d ''` is a bash and zsh builtin; a shell without it leaves $input empty,
# and the fallback reads stdin with cat instead.
IFS= read -r -d '' input 2>/dev/null || :
[ -n "$input" ] || input=$(cat)
case "$input" in
  *'"agent_type"'*'"poteto-agent"'* | *'"agent_type"'*'"pstack-reader"'* | *poteto-mode*playbooks* | *[Pp][Ss][Tt][Aa][Cc][Kk]-[Ss][Kk][Ii][Pp][Ss]*) ;;
  *)
    sid=${input#*\"session_id\"}
    [ "$sid" != "$input" ] || exit 0
    sid=${sid#*\"}
    sid=${sid%%\"*}
    [ -n "$sid" ] && [ -e "$HOME/.claude/pstack/live/$sid" ] || exit 0
    ;;
esac
