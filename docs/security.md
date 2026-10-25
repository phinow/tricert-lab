# TriCert Lab security notes

## Assumptions

- The MVP is a single-learner, private workspace. There is no shared tenancy and no application-managed password.
- Kestrel Health Network, Project Beacon and every dataset are fictional and synthetic; no real patient or staff data is used. Real employer or client data should not be entered.
- Power BI Desktop is used separately; this application never stores Power BI credentials or embeds a report.
- The hosting platform supplies the private owner access boundary and encrypted managed storage.

## Controls implemented

- Server-side length, type, enumeration, integer-range, and date validation for every persisted action.
- React output encoding and parameterized D1 statements.
- No secrets in source or browser storage.
- A narrow action allowlist on the state endpoint; unsupported actions fail closed.
- Append-only activity records for profile, progress, attempt, and artifact mutations.
- Synthetic downloadable data with explicit classification and handling exercises.
- Readiness does not unlock from completion alone; evidence, judgment, mocks, and teach-back are separate gates.
- Secure errors return bounded application messages rather than SQL or stack details.

## Residual risks and next phase

- The MVP assumes the hosting owner boundary is sufficient for one learner. Multi-user use requires authenticated per-user IDs, authorization checks on every object, session rotation, CSRF review, rate limiting, and tenant isolation tests.
- Local device access remains a risk; use device encryption and screen lock.
- Artifact export produces local files that inherit the destination device’s protection.
- D1 recovery and platform backup behavior should be exercised before treating the workspace as the only copy of portfolio evidence.
- Dependency findings require review with each release; do not apply forced major-version upgrades without regression testing.

## Recovery exercise

Export key artifacts as Markdown at the end of each week. Quarterly, verify that the current source archive, D1 migration, and synthetic datasets can create a clean deployment and that an exported artifact can be opened independently.
