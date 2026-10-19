# Releasing sheetpane

Every package under `packages/` is published together, at one version (SR-BUILD
decision 9). Publishing is **only** `.github/workflows/publish.yml`, run by a
published GitHub Release. It uses npm trusted publishing (OIDC): no `NPM_TOKEN`
exists anywhere, and none should be added.

The packages: `@sheetpane/charts`, `comments`, `condfmt`, `export`, `fixtures`,
`formulas`, `grid`, `images`, `import`, `mcp`, `numfmt`, `skills`, `styles`,
`testing`, `validation`, `visibility`, and the unscoped `create-sheetpane`. Each
ships its build output (`dist/`, or `bin/`, `templates/`, `skills/`) with its
README and LICENSE, never `src/` or tests.

## One time, by hand (the decider)

Do these once, in this order. npm binds a trusted publisher only to a package
that already exists, so the first publish cannot come from CI.

1. **npm account with 2FA.** Account `aarya11`, 2FA set to *auth-and-writes*.
2. **The `sheetpane` organisation** on npmjs.com, with `aarya11` as owner. Done.
3. **The first publish, by hand,** from a green, tagged tree. Run `npm publish`
   on the packed tarballs, never from a package folder: npm would ship
   `workspace:*` as-is.
   ```bash
   git checkout v0.1.0 && pnpm install --frozen-lockfile && pnpm run build
   npm login
   for d in packages/*/; do (cd "$d" && pnpm pack --pack-destination /tmp/sp); done
   for t in /tmp/sp/*.tgz; do npm publish "$t" --access public --otp=<code>; done
   git checkout main
   ```
   npm asks for a code from your authenticator on every write. One fresh code
   usually covers all 17 if you go straight through; if it expires, re-run the
   loop with a new code. A version already on npm is refused, not
   overwritten, so re-running is safe.
4. **A trusted publisher on each of the 17 packages.** On npmjs.com, open
   *package → Settings → Trusted Publisher → GitHub Actions* and fill in:
   - **Organization or user:** `arpitarya`
   - **Repository:** `sheetpane`
   - **Workflow filename:** `publish.yml`
   - **Environment name:** `npm`

   Then tick **Allow npm publish**. Or let `scripts/npm-trust.sh` do all 17
   with `npm trust github`. It needs npm 12 and asks for your login and 2FA.
5. **The `npm` environment in GitHub:** *Settings → Environments → New
   environment → `npm`*. Add yourself as a required reviewer if you want to
   approve each publish.

After step 4, no release needs a token, a code or your machine again.

## Every release

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat(grid): …`, `fix(mcp): …`, `docs: …`, `build(ci): …`,
`chore(release): v0.2.0`. A breaking change says `!` (`feat(grid)!: …`) and
has a `BREAKING CHANGE:` footer.

1. **Notes first.** In `CHANGELOG.md`, turn `## Unreleased` into
   `## 0.2.0 — <what this release is> (<date>)`, start a new empty
   `## Unreleased` above it, and open the section with a few lines a user
   needs: what is new, what to change before upgrading, and how to install.
   The summary is the GitHub Release title (`v0.2.0 — the first release on
   npm`, `v4.0.3 — version bump on all six names`), never the bare version;
   the section **is** the release note. `just release` refuses without
   either.
2. **Bump.** `just release 0.2.0` sets the version on every package, then
   rebuilds what pins it: the starters, the Claude Code plugin and
   `llms.txt`. It runs `just version-parity` and `just check pack-check`,
   then commits `chore(release): v0.2.0` and pushes `main`. It does not tag.
3. **Wait for CI.** `ci.yml` must finish green on the head of `main`: the
   full suite, the three-OS matrix and the templates.
4. **Publish.** `just publish 0.2.0` creates the GitHub Release
   `v0.2.0 — <summary>` on that commit, with the CHANGELOG section as its
   notes. Publishing the
   release creates the tag and runs `publish.yml`, which:
   - refuses unless `ci.yml` succeeded on this commit;
   - checks version parity and that the tag is the packages' version;
   - builds once and packs the 17 tarballs;
   - checks each tarball (README, LICENSE and build output present; no
     `src/`, no tests, no `workspace:`);
   - publishes each one with provenance. A version with a `-` (e.g.
     `0.3.0-beta.1`) goes to the `next` dist-tag, everything else to
     `latest`. A version already on npm is skipped.
5. **The tag also deploys the playground** (`pages.yml`).

## Troubleshooting

| symptom | cause | fix |
|---|---|---|
| `npm trusts this workflow` fails: *npm refused the OIDC exchange* for a package (nothing is published) | that package has no trusted publisher, or it names another workflow file (e.g. the old `release.yml`) or environment | on npmjs.com, *package → Settings → Trusted Publisher*: `arpitarya` / `sheetpane` / `publish.yml` / `npm`, **Allow npm publish** ticked; re-run the job |
| `publish npm` fails with `ENEEDAUTH`, `E401`, `E403` or "OIDC token exchange" | the trusted publisher does not match: workflow file not `publish.yml`, environment not `npm`, the repository misspelled, or **Allow npm publish** unticked | correct it on npmjs.com (*package → Settings → Trusted Publisher*), then re-run the failed job |
| the same, on a package published for the first time | npm binds trusted publishers only to existing packages | publish that package once by hand (step 3), add its trusted publisher (step 4), re-run |
| the npm step prints a version below 11.5.1 | npm too old for OIDC | the workflow installs `npm@latest`; check that step's output |
| `refusing to publish: ci.yml has not succeeded` | the release was created before CI finished, or CI is red | wait for green, or fix and push; then re-run the `build` job |
| `release tag vX != package version Y` | the release was created without `just release X` | delete the release and its tag, run `just release X`, release again |
| `version sites disagree` | a file holding the version was edited by hand | `node scripts/release.mjs <version>` rewrites them all |
| `provenance … repository … does not match` | a package's `repository.url` is not `git+https://github.com/arpitarya/sheetpane.git` | fix `repository` in that `package.json`; it must name this repository exactly |
| a tarball check fails (`ships src/`, `no dist/`) | a package's `files` list changed | restore `files` to the build output; `npm pack --dry-run` shows what would ship |

Never rename `publish.yml` or the `npm` environment. Every package's trusted
publisher names both.
