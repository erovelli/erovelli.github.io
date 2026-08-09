---
title: Utils
summary: Small browser utilities compiled from Rust to WebAssembly, so the work happens on your own machine instead of on someone else's server.
status: Ongoing
year: 2026
order: 4
featured: false
technologies:
  - Rust
  - WebAssembly
  - Web APIs
languages:
  - Rust
schemaType: SoftwareApplication
applicationCategory: UtilitiesApplication
operatingSystem: Web browser
repository: https://github.com/erovelli/utils
live: https://erovelli.github.io/utils/
liveLabel: Open tools
---

Utils was my first foray into writing Rust for WebAssembly. I wanted a
set of small utilities I could reach from any browser without relying on the
ad-heavy versions that tend to dominate search results or having to trust what
those sites might do with the data I gave them.

A password generator made the problem concrete. Browser developer tools can
show whether an unfamiliar site calls home, but auditing network traffic is an
awkward prerequisite for using a basic utility. It is also not intuitive for
everyone. I wanted local execution to be the default instead. In Utils, the
page, styles, JavaScript glue and WebAssembly module are static files served by
GitHub Pages. Once those assets are loaded, using a tool makes no further
network requests: the Rust code does the work in the browser. The source is
public, so that behavior can be checked in the code as well.

The project currently includes a deterministic password generator and a JWT
decoder. Each utility is its own Rust module, registered with a small
hash-based router, which keeps the collection easy to extend. The idea is to
add tools one at a time as I need them and gradually build a useful repertoire
without turning the site into a larger application than it needs to be.
