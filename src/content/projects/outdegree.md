---
title: Outdegree
summary: A Chrome extension that records browsing as a directed graph you can explore over time, with a Rust and WebAssembly core and no network egress.
status: Published
year: 2026
order: 3
featured: true
technologies:
  - Rust
  - WebAssembly
  - Chrome MV3
  - IndexedDB
languages:
  - Rust
  - TypeScript
schemaType: SoftwareApplication
applicationCategory: BrowserApplication
operatingSystem: Chrome
repository: https://github.com/erovelli/Outdegree
live: https://chromewebstore.google.com/detail/outdegree/kjmjfehjgbcgibkbekgacfgibfmglmod
liveLabel: Chrome Web Store
---

I had the idea for Outdegree one evening while failing to fall asleep. I was
thinking about search engines, and about Spotify Wrapped. Both take behavior
and hand it back to you as something you can look at. The question that kept me
up was what my own browsing would look like if I were the crawler. I have always
liked node-and-edge graphs, the Obsidian vault view in particular. Browsing already is a graph. The browser just insists on showing it
to you as a list.

A Chrome extension was the obvious way to capture it, and building one had been
on my list for a while. I like the whole shape of app development: not only the
thing itself, but packaging it, getting it through review, and having someone
else install it.

## How it works

The capture layer is a TypeScript service worker, and it is deliberately dull.
It listens for navigation events and appends them to one globally ordered log in
IndexedDB. A committed navigation, a link opening a new tab, a single-page app
changing its history, a tab closing: each one becomes a record, and no derived
state is kept anywhere. Under Manifest V3 the service worker is killed
aggressively and its listeners have to register synchronously, so anything
cleverer than appending is a bug waiting for a restart to land mid-sequence.

Everything interesting happens later, on the dashboard, in Rust compiled to
WebAssembly. Opening it replays the log in strict order and rebuilds the picture
from the raw events: working out where each navigation actually came from,
collapsing redirect chains, grouping hosts by registrable domain, cutting the
stream into sessions. From there the core detects communities, ranks hubs,
computes a weighted PageRank over the sites you visit, and lays the result out
with a force-directed pass. The graph renders in 2D or 3D, a session reads as a
left-to-right Sankey flow, and the tables view answers narrower questions: which
sites launch journeys, which ones absorb them, where you reliably go next.

The two layers share nothing but the event log, which is what makes the
analysis testable: it is a pure Rust crate that compiles and runs on the host,
with no browser involved. A property test asserts that folding only the new
events from a checkpoint produces bit-identical output to recomputing from
scratch, checked at every split point, because that equivalence is the thing
quietly holding the incremental path up.

I built most of it agentically, which is part of why it is in Rust. A compiler
that refuses ambiguity is a guardrail an agent runs into on its own, and a pure
core with a real test suite is something I can check without reading every line.

## What it turned out to be for

I built it to look at rather than to use. A friend read it differently: he
pointed out that it is a better way to find something you have lost. You rarely
remember the URL, but you usually remember roughly where you were and what you
were doing when you saw it, and retracing that path through a graph matches the
shape of the memory. A linear history list throws that structure away. Outdegree
mines it back out.

## Privacy by construction

Nothing leaves your machine, and the reason is not that I chose not to send it.
The extension requests no host permissions, so it has no granted ability to
contact any origin. Its content security policy sets `connect-src 'none'`, so
`fetch`, `XHR`, `WebSocket` and `sendBeacon` are refused by the browser rather
than merely unused. It runs no content scripts and is barred from incognito
windows. The only path data takes outward is a file you export yourself.

That constraint cost something, which is the part I like. `connect-src 'none'`
blocks same-origin requests too, and the standard wasm-bindgen loader fetches
the `.wasm` file the extension ships with, so the ordinary path could not
instantiate at all. The build now inlines the WebAssembly into the JavaScript
bundle as base64 and instantiates it from bytes. It costs about a third in size,
and it buys a guarantee with no exception clause.

CI verifies the claim instead of trusting it. One job audits the manifest the
build actually emits: host permissions empty, permissions confined to an
allowlist, `connect-src 'none'` present, incognito refused, no content scripts.
Another greps the built bundle for `fetch`, `XMLHttpRequest`, `WebSocket`,
`EventSource`, `sendBeacon`, `importScripts` and any external URL, and fails on
a single match. A regression has to get past both.

## Release

Tagging a version builds the packaged extension, optimizes the WebAssembly,
attaches the artifact to a GitHub Release, and submits it to the Chrome Web
Store through the store API directly rather than through a third-party action.
That last step targets a protected environment, so the submission can be held
for a manual approval before the public listing is touched.

It is MIT licensed, currently at v1.3.0. The same compiled bundle runs on Edge
unchanged, and on Firefox with a two-key manifest overlay that CI builds and
audits alongside the Chrome one.
