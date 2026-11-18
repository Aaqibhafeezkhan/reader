---
title: Riverbend Dev Days, day 1
date: October 2026
---

← [How to Take Notes Like a Boss](../tutorial.md)

Your ten minutes:

- [x] Add an aside to the keynote
- [x] Turn the retries question into `Q:` and `A:`
- [x] Define `!SLO`
- [x] Quote one line
- [x] Write one task per talk
- [x] Take *The Docs Nobody Reads* out into a file of its own

# Boring Software

Priya Raman, keynote

!innovation token: one new, unproven thing a team can afford to adopt; spend them where it counts
!SLO: service level objective, the reliability you promise yourselves, like 99.9% of requests under 300ms

- most outages come from the new thing, not the old thing
- each team gets about three !innovation tokens
- choose boring tech for everything that isn't your product
- she credited Dan McKinley's [Choose Boring Technology](https://boringtechnology.club/)
- graph of incidents by age of dependency, drops off after year 2
~ So the first two years of a dependency are where we pay for it.
~ Worth checking against our own incident log.
- she kept coming back to !SLO

Q (audience): When is it worth spending a token?
A (Priya): When it's the thing your customers pay you for.

> Boring is a feature you only notice when it's gone.
> -- Priya Raman

~ We've spent at least five tokens on the build alone.

- [ ] Count our innovation tokens before the planning meeting on date:2026-11-03[]
- [ ] Read Choose Boring Technology

---

# Backpressure for the Rest of Us

Tomás Ortega

!backpressure: a consumer telling a faster producer to slow down

- producer faster than consumer, something has to give
- three choices: buffer, drop, or slow the producer down
- pick one on purpose
- an unbounded queue is choosing to crash later
~[unbounded queue] Our importer does exactly this.
~ That was the outage in August.

Q (Tomás): Who has a queue with no max?
A: Half the room.

Q (audience): Do retries count?
A (Tomás): Retries are just a producer you forgot about.

~ That's the line I'll remember.

- [ ] Put a max on the importer's queue, and decide what happens when it's full

---

# The Docs Nobody Reads

→ [The Docs Nobody Reads](the-docs-nobody-reads.md)
