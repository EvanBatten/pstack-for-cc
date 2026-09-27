# Token cost and code quality

pstack spends tokens to buy quality: panels of several models, fresh verifier agents, decision logs. She is open that her setup assumes a large budget.

> "btw a word of caution if you're price conscious: using multiple agents, especially frontier ones, use a lot of expensive tokens." ([tweet, 2026-05-25](https://x.com/poteto/status/2059046010966684134))

Our version runs on a subscription, where a few parallel sessions can use up a session limit. So the goal is to keep the parts that raise quality most per token and scale the rest to the task.

| Lever | How to use it |
|---|---|
| Budget | `/pstack:setup-pstack` offers `unlimited`, `large`, `medium` and `small`. Each step down moves judgment roles to the parent model, code roles toward `haiku`, and shortens every panel. No panel drops below two entries. Start at `medium` |
| Panels | `arena`, `architect` and `interrogate` cost one agent per panel entry. Save them for decisions that are expensive to reverse |
| Task size | Send one-line edits and config changes straight to the agent. Use `poteto-mode` when a wrong answer would cost more than the ceremony |
| Verification | This is the spend to protect. A control CLI makes each check cheap, so invest there, and cut panels before you cut checks |
| Parallelism | Two to four concurrent workers is realistic on a subscription. Larger fan-out means API billing through the Agent SDK or GitHub Actions |
| Hard rules | A lint rule costs nothing per run and replaces an instruction that every session would otherwise pay to read |
