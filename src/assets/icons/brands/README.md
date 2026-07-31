# Brand marks

Two sources, because no single set has both. Each file is copied unchanged from
its origin; if you replace one, keep the provenance note honest.

`github.svg` — `simple-icons@16.21.0`, CC0 1.0.

- https://simpleicons.org/
- https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md

`linkedin.svg` — `bootstrap-icons@1.13.1`, MIT.

- https://icons.getbootstrap.com/
- https://github.com/twbs/icons/blob/main/LICENSE

Simple Icons was the obvious source for both and is not: it carried LinkedIn
once and no longer does, so `simple-icons@16.21.0` ships 3436 marks without it.
Do not go looking for a version that still has it — pinning an older release to
recover a mark the set deliberately dropped is not the fix. Bootstrap Icons is
MIT, still ships it, and draws it solid, which is what `.brand-icon` needs: the
span masks the file with `currentColor`, so a stroke-based glyph would render
as a filled blob.

The viewBoxes differ, 24 against 16, and that is fine. The mask is sized
`contain` and both glyphs are full-bleed within their own box, so they render
into the same 24px square regardless. LinkedIn's mark is a filled rectangle and
so carries more ink than the Octocat silhouette at the same size; that is the
mark, not a sizing bug, and shrinking it to compensate would just make it look
wrong next to every other LinkedIn button on the web.

GitHub's and LinkedIn's names and marks remain subject to their own trademark
guidelines. Both are used here only to label a link to Evan's own profile.
