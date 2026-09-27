# Sources

Where the claims in these notes come from, with her words quoted so they can be checked. Compiled 2026-09-19.

## How the sources were read

| Source | How |
|---|---|
| Official README and plugin files | Read directly from [cursor/plugins](https://github.com/cursor/plugins/tree/main/pstack). A copy of the README is at [UPSTREAM-README.md](../../docs/UPSTREAM-README.md) |
| X guide articles | X does not serve article bodies without a login, so the text was read through mirrors, linked below. Tweet text, dates and like counts came from X's public syndication API |
| Conference talk | Read from the video's own English captions. Timestamps are approximate, and captions garble proper nouns |

## Lauren Tan

| Source | Link | Used for |
|---|---|---|
| pstack README | [raw](https://raw.githubusercontent.com/cursor/plugins/main/pstack/README.md), [marketplace](https://cursor.com/marketplace/cursor/pstack) | Aims and framing |
| The Complete Guide to pstack Pt. 1, "Verification is all you need" | [tweet](https://x.com/poteto/status/2094457600259842065) (2026-08-31), [article](https://x.com/i/article/2094151284949688320), mirrors: [Thread Navigator](https://threadnavigator.com/thread/2094457600259842065/), [cached](https://bittide.aicompass.dev/article/6eefebaa-70d7-4962-84be-a251bff0d431) | Verification skill, Build the Lever, Feature Map |
| The Complete Guide to pstack Pt. 2 | [tweet](https://x.com/poteto/status/2097732320606507506) (2026-09-09), [article](https://x.com/i/article/2094940651607715840), mirror: [vuink](https://vuink.com/post/k-d-dpbz/poteto/status/2097732320606507506) | Research, planning, prototyping, architecture. Only the opening section was retrievable |
| How I Use Cursor | [tweet](https://x.com/poteto/status/2058975157503570132) (2026-05-25), [article](https://x.com/i/article/2057201109002059776) | Quoted through [Leslie Li](https://leslieli.dev/notes/go-deep-first-pstack/), who cites it as her primary source |
| Follow-up on token cost | [tweet](https://x.com/poteto/status/2059046010966684134) (2026-05-25) | Retrieved verbatim |
| Conference talk, 55:30 | [YouTube](https://www.youtube.com/watch?v=PaPpyQocMww) | Hard rules, auto-merge, evals |

### Quotes

From the README:

> "throughput without quality is not a goal i aspire to. if you want to go fast, go deep first."

> "personally, i don't believe in planning. the best spec is code."

From Guide Pt. 1:

> "In this series of posts, I'm going to show you how I use pstack, my personal set of skills for doing rigorous engineering work. It's allowed me to ship 2,000 PRs a month to production with high confidence."

> "we prefer to give agents tools rather than just markdown. For verification skills, this means creating a small CLI that scripts interaction and debugging of your app in a small, agent friendly utility. This means that agents consume fewer tokens trying to do a task (run a CLI command instead of writing a throwaway script to click on something), and makes your verification skill more reproducible and testable."

> "an easily searchable map of all the features available in your app, what it does, and how to get to it from a user's perspective."

> "You can think of the Feature Map as a form of 'materialized memory'... Personally, I think your codebase is the ultimate form of memory. Code is a projection of the decision making you and your team have made and represents the source of truth for what's happened and how things actually work."

> "I recommend running /maintain-verification-skill at least once a day... You may even want to put an oncall rotation on it."

From Guide Pt. 2:

> "This is the exact workflow that allows me to ship thousands of PRs a month into production while keeping code quality extraordinarily high."

From How I Use Cursor, through Li:

> "Agents are like new hires in a constant state of amnesia and idiocy. They don't remember what you tell them, and they never really learn anything new."

> "Naive parallelization just makes them write slop faster."

### Talk timestamps

| Topic | Time | Quote |
|---|---|---|
| Agents merge her PRs | ~03:24 | "I actually have my agents now automerging PRs for me... I woke up today and there were like 20 PRs landed and I just reviewed them on main" |
| Volume | ~04:43 | "last month I shipped a thousand PRs which is ridiculous... this month we're only on the 12th, I'm already at like almost 800 PRs landed" |
| Verification first | ~05:33 | "the most important skill that you should have in your toolbox when you work with agents is verification" |
| Evals stay hidden | ~19:02 | sub-agent directories are "cleverly named to not let the sub agent know that it's being evaluated because agents can actually tell and when they do they change their behavior" |
| Build trust before scale | ~26:37 | "I would definitely encourage you not to try to jump from... I'm going to spawn hundred of thousand or thousands of cloud agents right now" |
| Greenfield risk | ~32:01 | "green field applications especially are... like the biggest risk in my opinion" |
| No code comments | ~39:01 | "I actually ban code comments as well... 99% of the time agents just write code comments that kind of describe some historical thing that is actually totally irrelevant" |
| Import boundaries in CI | ~41:54 | "we actually check the dependency graph to make sure you're not accidentally importing code from one directory to another" |
| Two tiers of enforcement | ~44:55 | CI and static analysis "make CI red"; "for rules and skills and bogbot, your agents can still forget" |
| Review comments become rules | ~46:59 | "instead of me commenting on the PR, how do I turn this into a hard rule... a lint rule... a CI failure" |

## Other write-ups

| Author | Link | Useful for |
|---|---|---|
| Flavio Copes | [A deep dive into pstack](https://flaviocopes.com/pstack/) (2026-08-21) | A walkthrough of the catalog. "'Verify it' becomes a repository capability instead of a new conversation every time." |
| Leslie Li | [Go Deep First](https://leslieli.dev/notes/go-deep-first-pstack/) | The sequence: encode how you debug, require a real artifact before done, then add workers |
| The Neuron | [pstack explained](https://www.theneuron.ai/explainer-articles/pstack-explained-lauren-tans-system-for-trustworthy-ai-agents/) (2026-09-10) | An overview of v0.15.1 |
| Rob Shocks | [video, 12:57](https://www.youtube.com/watch?v=lUhXa8GiXns) | A one-shot build with pstack. At ~09:06 the verification pass caught three false claims the agent had made and corrected them |

Ports to other hosts: [0xrsydn/pstack-pi](https://github.com/0xrsydn/pstack-pi), [backnotprop/pstack](https://github.com/backnotprop/pstack), [open-pstack](https://hysenlabs.com/en/projects/ericlitman-open-pstack).

## Accuracy notes

- Skill, playbook and principle counts differ between write-ups because the plugin changed between versions. The counts in these notes are from v0.15.2 as copied here.
- Two mirror dates are wrong. Guide Pt. 1 was posted 2026-08-31 and Pt. 2 on 2026-09-09.
- Each guide has a tweet ID and a separate article ID. Cite the tweet. The article URL is where the text lives and needs a login.
- The talk's upload title quotes a phrase that does not appear in the transcript. She identifies herself as working at Cursor throughout.
- Captions garble one product name many ways (Grockbot, Grogbot, bogbot and others), so quotes that contain it are left as captioned. The talk separately names Bugbot as Cursor's CI code-review tool (~42:04).
