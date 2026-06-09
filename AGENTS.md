\# Meridian Rules



\## Scope



Agency SaaS only.



Out of scope:



\* Publisher Organization

\* Advertiser Organization

\* Publisher Portal

\* Advertiser Portal

\* Business Profile

\* Claim/Verification

\* Relationship Layer



\## Architecture



\* Organization = Root Tenant

\* All data is tenant scoped

\* No cross-tenant access

\* Use immutable IDs

\* Never use names as identifiers



\## Development Flow



Requirement

→ API Contract

→ Backend

→ Frontend

→ Testing



\## State Management



Maintain:



\* AGENTS.md

\* PROJECT\_CONTEXT.md

\* DECISIONS.md

\* TODO.md

\* API\_CONTRACT.md



If a task changes project state:



Update the relevant files immediately.



\## Rules



\* Keep MVP simple

\* No over-engineering

\* No future-phase abstractions

\* No new domain entities without justification

\* Never trust organization IDs from the frontend



\## Definition of Done



\* Implementation complete

\* Tests pass

\* TODO updated

\* PROJECT\_CONTEXT updated

\* DECISIONS updated (if required)

\* API\_CONTRACT updated (if required)



\## Session Start



Always read:



1\. AGENTS.md

2\. PROJECT\_CONTEXT.md

3\. DECISIONS.md

4\. TODO.md



before planning or implementation.



\## Session End



Review and update:



\* PROJECT\_CONTEXT.md

\* DECISIONS.md

\* TODO.md

\* API\_CONTRACT.md



before closing the task.



