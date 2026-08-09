---
title: tidyup
summary: A local-first file organizer that never phones home. On-device embeddings propose a tidy directory tree, and nothing moves without approval.
status: Pre-alpha
year: 2026
order: 1
featured: true
technologies:
  - Rust
  - ONNX Runtime
  - SQLite
  - Tokio
  - Dioxus
languages:
  - Rust
schemaType: SoftwareApplication
applicationCategory: UtilitiesApplication
operatingSystem: macOS, Linux, Windows
repository: https://github.com/erovelli/tidyup
---

I was planning to buy a new laptop, and I did not want to carry the old one's
mess across. What I wanted was to take everything scattered across the local
disk, sort it semantically into the structure I keep in iCloud Drive, and end
up with a machine whose contents I could actually account for. I wanted to
supervise that: see every proposed move before it happened, undo any of it
afterward, keep projects and codebases intact instead of shredded across
folders, and get files renamed when their names had stopped describing them.

Nothing I found would do that without uploading my files. So the tool is
tidyup: it walks a source directory recursively, works out what is in each file
using models that run entirely on your machine, and proposes a tidier
structure, either sorted in place or migrated into a target hierarchy it learns
from your existing folders. Nothing moves until you approve it, either item by
item or by explicitly opting into confidence-threshold approval. By default,
nothing is uploaded or logged remotely; the local journal exists so changes can
be audited and reversed. There is no account and no telemetry.

It is eleven Rust crates and about thirty thousand lines, begun in April 2026,
and it is in pre-alpha: the pipeline runs end to end, and the tuning is not
finished.

The destination does not have to be iCloud. Anything the filesystem can see
works: a mounted NAS, another machine, whatever sync client keeps a folder on
disk. iCloud is just where my own files go.

## Why it stays on your machine

The reason to care is specific to what this tool is for. Nobody runs a file
organizer over the directory they opened this morning; you run it over the
places you have not looked in years. Old tax paperwork, scans of documents you
needed once, exports from services you have since left, whatever was in
Downloads in 2019. Forgotten files are exactly where personal information
accumulates, precisely because you stopped keeping track of it. Pointing a
general-purpose coding agent or a hosted model at that directory and asking it
to sort things out means handing a third party the contents of every file you
have lost track of, and you cannot give informed consent to that, because if
you knew what was in there you would not need the tool.

So the default build does the whole job on your own hardware. The models sit on
your disk, the classification runs in your own process, and the contents of
your files never leave it. Once the model files are installed, put the machine
in airplane mode and nothing about the tool changes. There are optional
backends for people who want them, including a remote one that sends extracted
content to its configured endpoint. They are off by default, and switching
either on is a deliberate act rather than a setting you might flip by accident.

Everything else in the design follows from that: the classifier had to be
something small enough to run locally, the models had to live on disk instead
of behind an endpoint, and renames had to be built out of evidence already in
the file. It also made a useful tiebreaker. When two designs were otherwise
close, the one that kept this property without needing to be defended won.

## Why embeddings and not a language model

The obvious way to classify a file by its contents in 2026 is to ask a small
local LLM. I started there and moved off it, and the comparison is not close on
the axes this tool cares about.

A quantized `bge-small-en-v1.5` is about 35 MB and embeds a document in roughly
50 ms on CPU. The LLM pairing I was considering was around 800 MB and 1 to 10
seconds per file. On a Downloads folder with two thousand files, one of those is
an interactive review session and the other is an overnight job.

The part that mattered more than speed is that this path does not sample. With
the same model, backend and configuration, the same file scored against the
same folders follows the same calculation, and the score decomposes into terms
I can print. A proposal's reasoning string is literally its sub-scores:
centroid match, gap to the runner-up, name-embedding match. A user who thinks
tidyup guessed wrong can see _why_ it guessed. Sampling temperature and model
version drift give you none of that, and this is a tool whose entire value
proposition is that you can audit it before you trust it.

So classification is a three-tier cascade, cheapest first. Tier 1 is heuristics
on extension, MIME and marker files, which handles `.gitignore` and
`Cargo.toml` for free in about a millisecond. Tier 2 is embedding similarity,
and it is the spine: the extracted body becomes a 384-dimension vector, scored
against each candidate folder as a weighted sum of the cosine to that folder's
content centroid, the cosine to its name embedding, and a metadata term. A top
score above threshold with a large enough gap to second place is a confident
proposal. Anything else goes to review.

Tier 3 is the optional language model, and what it does when someone turns it
on is narrower than "let the LLM classify." When Tier 2 lands in the review
zone, the model reads the content and emits a category, tags and a summary.
That text is re-embedded with the same model Tier 2 used and re-ranked against
the same candidate list under the same scoring rules, and its answer is adopted
only if it scores higher than Tier 2's did. It is a second opinion inside the
existing geometry rather than a separate authority. Its `suggested_name` field
is read and thrown away.

## Renames it cannot make up

Renaming was on the list from the start, but as a convenience rather than an
automation: a file called `Scan_20190413_0002.pdf` is a file you will never
find again, and having something propose a better name while it is already
reading the contents is most of the value. Proposing is the operative word. The
rename path is built so that it cannot invent.

Throwing away `suggested_name` is that policy in one line. A rename proposal
has to come from evidence in the file: embedded metadata first (PDF `/Title`,
ID3 `TIT2`, EXIF `ImageDescription`), then keyphrases extracted from the
content, then nothing, in which case the file keeps its name and just moves.
There is no branch in which a name is generated, which means the guarantee is
structural rather than a matter of prompt discipline.

Whether to propose a rename at all takes two signals that both have to clear
their thresholds. One is classification confidence. The other is
filename-content mismatch, computed as one minus the cosine between the
filename embedded as text and the content embedding. `taxes_2023.pdf` holding a
tax return scores near zero, because the name already tells the truth, so leave
it alone. `DSC_0481.jpg` of a wedding scores near one, because the name carries
no information at all. Only the second one is worth touching.

Renames never auto-apply, and that asymmetry is deliberate. `--yes`
auto-approves moves above the confidence threshold and explicitly _rejects_
renames, so approving one requires sitting through an interactive run. A wrong
move is annoying and reversible in an obvious way; a wrong rename silently
breaks every symlink, document and script that pointed at the old path, and you
find out months later.

The keyphrase extractor is an inlined YAKE, n-gram aware up to three words. It
picks the document's language by stopword overlap across English, Spanish,
French and German so that a French document does not get renamed `le_la_des`.
That is a small thing that is honestly a little absurd next to an English-only
classifier. The embedding model still reads everything as English, so
non-English classification is weak in a way the rename path is not. A
multilingual model is the real fix and it is a 500 MB one, so it is on the
roadmap rather than in the build.

## Things that move together

A coding project is not a hundred files. Shred one across a taxonomy and you
have broken a build, a git checkout and an IDE index, and the user's folder is
worse than when they started. So before any per-file classification happens,
the walk looks for bundles.

Hard bundles are found by marker and are not AI at all: a `.git/` directory,
`Cargo.toml`, `package.json`, `pyproject.toml`, an `.xcodeproj`, Gradle files,
neighboring notebooks. Find a marker and the whole subtree becomes opaque.
Nothing inside it is ever classified individually, and the bundle is placed as a
unit. Soft bundles are looser groupings with no shared directory: photo bursts
whose EXIF capture times fall inside a sixty-second window, music albums
sharing an ID3 album tag, document series that form a filename family like
`invoice-2024-01`. Those move as file-sets, member by member, with a shelf copy
of each original and a write-ahead journal that makes an interrupted move
recoverable.

Directory bundles have a stronger fast path. On one volume, the whole bundle
moves with a single rename of its root. Across volumes there is no equivalent
operation, so tidyup copies the tree, verifies it by BLAKE3 hash and only then
deletes the source. Every bundle is shelved before either path begins. That does
not make a multi-file or cross-volume move physically atomic, but it does mean
an interruption is journaled and the originals can be recovered.

## Why Rust, specifically

A substantial amount of tidyup was written by an agent, and the commit log says
so, the hardening work in particular. I picked Rust for that reason rather than
in spite of it. My conviction going in, which the project has mostly confirmed,
is that Rust is the best language available for high-volume agentic
development, and that the reason is the compiler.

When code arrives faster than you can read it, review capacity is the
constraint on everything. The useful question stops being "is this code good"
and becomes "how much of this code can something other than me reject before I
ever see it." Rust moves an unusually large amount of correctness into that
category. Use-after-free and double-free are structurally impossible.
References cannot outlive what they point at. There is no null, so absence is
an `Option` you are forced to open. Errors are `Result` values that cannot be
dropped on the floor without the compiler saying so. `Send` and `Sync` are
types, not conventions, so cross-thread data races are a compile error rather
than a heisenbug you find in production. Every one of those is a runtime
failure in most languages, caught if you are lucky by a test somebody thought
to write.

The property I did not anticipate valuing most is exhaustive matching. Add a
variant to an enum in `tidyup-domain` and every site in every crate that now
has an unhandled case stops compiling. That is the anti-drift mechanism, and it
matters far more when the thing making the edit does not hold the whole system
in its head. A partial refactor is not a subtle bug that surfaces in three
weeks; it is a build failure in the same minute. It is very hard to leave a
change half-finished in Rust and not know it.

The diagnostics close the loop. A `rustc` error carries a span, an explanation
of the rule being violated, and frequently the edit that would fix it. The
output is structured enough that an agent consumes it directly, which means
most of the correction happens before a person is involved. `cargo check`,
`cargo fmt`, `cargo clippy` and `cargo test` are one toolchain with one right
answer each, so there is no configuration to litigate.

So I tuned the harness to be as loud as it would go. The workspace forbids
`unsafe_code` outright, runs clippy at pedantic plus nursery, and treats
warnings as errors in CI. It also flags `unwrap`, `expect`, `todo!` and
`unimplemented!`. That last group is the one I would keep if I could keep only
one: those are the four shapes code reaches for when it does not know what to
do, and making them fail the build means "I did not handle this" cannot quietly
pass as "handled." The rule for production code is to return a `Result` and
propagate.

Some of this shows up as architecture rather than as errors. The frontend port
traits are passed as trait objects that must be `Send + Sync`, which is what
forced the desktop UI's Dioxus signals to be `SyncStorage`-backed. That is not a
style preference the compiler happened to have; it is a true fact about the
design that I would have discovered later and more expensively.

The cost is real and worth naming. An agent that runs into the borrow checker
will very often satisfy it with a `.clone()` instead of restructuring the
ownership, and the result compiles, passes, and quietly allocates. The compiler
has no opinion about that. Which is the smaller version of the actual limit,
and the thing the next section is about.

## The audit

Everything in that last section is true and none of it saved me. I ran a
hardening pass over the data-safety paths, and the results were bad enough to
be worth writing down, because every one of these bugs was memory-safe,
type-correct, clippy-clean at pedantic, and passing every test I had written.

Rollback deleted the destination file before restoring from the backup shelf,
and did not verify the shelf copy first. If the shelf copy was missing or
corrupt, the sequence was: delete the only good copy, then fail to restore it.
A run also flipped to `RolledBack` when every single restore inside it had
failed. Rollback is the feature the entire safety story rests on, and it was the
most dangerous code in the repository.

The fix was to verify everything before touching anything. Shelf records now
carry a content digest: BLAKE3 for files, and a canonical tree digest for
bundle subtrees that follows symlinks the way the shelving copy does. A
precheck runs first and confirms that the shelf copy matches its recorded
digest, that the original location is still free or still holds the shelved
content, and that the destination still matches what was moved. A file you
edited after applying is reported as a conflict and left exactly where it is. A
new file that has since been saved into the vacated original path is never
clobbered. Restores displace the destination aside with a same-volume rename,
copy the shelf content back, and only then delete the displaced copy, so there
is no window in which your data exists only on the shelf. A run flips to
`RolledBack` only when every item restored cleanly; anything else stays
retryable.

Apply had the mirror-image problem. It moved the file first and journaled the
move afterward, which meant a crash in between left a file that had moved but
that rollback could never find, because rollback enumerates _applied_ changes.
Ctrl-C in the middle of a photo burst hit exactly that hole. The order is
inverted now: shelve, write the journal entry, then move. A crash between the
journal write and the move leaves a recoverable over-approximation, a change
marked applied that never happened, and rollback's precheck sees the
destination missing, verifies that the original still matches the shelf and
safely reconciles the journaled change.

There was also a time-of-check-to-time-of-use gap wide enough to drive a
review session through. Files are hashed at scan time and re-hashed
immediately before the move; if the bytes changed while you were reviewing, the
move is aborted rather than carried out under a classification of contents that
no longer exist.

None of this is interesting to a user and all of it is the actual product. The
pitch is "every change is reversible," and a rollback that can eat a file makes
the pitch a lie.

It is also the honest boundary on the previous section. The compiler checks
that a program is well-formed, not that it is right. Nothing in the type system
has an opinion about whether you should verify the backup before deleting the
original, or journal the move before making it. Ordering, invariants, what
survives a crash: that is all judgment, and it is exactly where the review
attention freed up by everything else needs to go. Rust raises the floor a long
way. It does not touch the ceiling.

## Proving the premise wrong, or failing to

The whole tool rests on a claim that sounds obvious and might not be true:
routing files by their contents beats routing them by their filenames. If that
is false, the 35 MB model and the 50 ms and the ONNX runtime buy nothing over a
regex.

`cargo xtask eval-routing` is the experiment that could falsify it. It takes a
directory somebody already organized and treats it as ground truth. The folder
a file is in _is_ its label, so 20 Newsgroups or a BBC-News-by-category dump
drops straight in. It holds out files per label, builds each folder's content
centroid from the training split, routes the held-out files with the real
embedding backend and the real migration scoring rule, and reports top-1 and
top-3 accuracy with bootstrap confidence intervals against three baselines: the
filename embedding, most-frequent-label, and extension. The filename baseline is
the one that matters, since it is the cheap thing tidyup claims to beat.
`--fail-under` turns the content-minus-filename delta into a pass/fail gate, and
a nightly CI lane runs it against the real model.

The honest caveat is that public corpora are cleanly separable in a way a real
Downloads folder is not, so a good number there is an upper bound and a
necessary condition, not a sufficient one. If it cannot sort 20 Newsgroups it
certainly cannot sort your desktop.

The same honesty applies to confidence. tidyup reports a raw weighted-cosine
score, not a probability. The calibration machinery exists: Platt scaling, a
fitting tool, expected calibration error reported before and after. The shipped
default is still uncalibrated, because fitting it needs a held-out labeled
corpus bigger than my fixture set. Shipping "87% confident" without that corpus
would be a number that means nothing, which is worse than a raw score users
learn to read by watching it.

## One brain, two faces

The workspace is hexagonal: `tidyup-domain` has no I/O, async code or
dependencies on other tidyup crates; `tidyup-core` holds port traits and no
implementations; and the adapter crates for storage, extraction, embeddings
and inference depend on core rather than on one another. The classification
pipeline receives the model and extractor implementations through those ports,
while using the extraction crate's MIME routing utilities directly.
`unsafe_code` is forbidden workspace-wide; clippy runs pedantic and nursery
with warnings as errors.

The payoff is at the top. The CLI and the Dioxus desktop UI share every line of
business logic and differ in exactly two trait implementations: how to report
progress, and how to collect a review decision. The CLI does indicatif bars and
terminal prompts; the UI does signal-backed progress and a oneshot channel from
a diff view. They build the same `ServiceContext`, load the same extractors and
the same model. A third frontend, whether a TUI or a web app or an MCP server,
is two traits, not a refactor.

There is a GUI at all because of who this is supposed to be for. Command-line
tools are unfriendly in ways their authors stop noticing, and the person with
the worst folder on earth is usually not going to install a Rust toolchain and
read `--help`. tidyup is free and open source, and if the only usable version
of "sort my files without uploading them" costs money, the promise is a
narrower one than I wanted to make. A native desktop app is the version of this
tool that a non-technical person can actually be handed. Making the review step
visual is also just the right shape for the job. A list of proposed moves with
confidence on each one is a thing to look at, not a thing to scroll past in a
terminal.

Splitting eleven crates for a personal tool is more structure than the file
count justifies, and I would not defend it on abstraction grounds. What it
actually bought is isolation between the heavy dependencies. The ONNX runtime,
SQLite and the optional model stack are each large and each pull in a lot, and
keeping them in separate crates means none of them leaks into the rest of the
graph or into a build that does not want them.

## Where it is

The CLI runs `scan`, `migrate`, `watch`, `rollback`, `prune`, `status` and
`config` end to end, and tagged releases publish checksummed binaries for
Linux, macOS on both architectures, and Windows. The desktop UI builds from
source. Optional image and audio models classify photos and music by content
rather than by extension, and are not installed by default, because together
they are most of a gigabyte and text is the case that matters first.

Pre-alpha means the machinery is real and the tuning is not. Confidence is a
raw score rather than a calibrated probability, and earning a calibrated one
needs a labeled corpus larger than the fixture set I have. Signed binaries,
package-manager distribution and a video encoder are the rest of the list.

The tool exists because of a laptop migration I have not done yet. That is the
next thing it does.
