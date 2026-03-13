---
title: ARCA Assisted Navigation Skill
status: implemented
priority: high
---

## Summary

ARCA Assisted Navigation skill is an agent skill to be used whenever the agent needs to implement a new navigation flow on ARCA or fix a bug on an existing navigation flow. It shows a browser window for the developer to use and show the agent the browsing experience that needs to be automated.

## Acceptance Criteria

- [ ] The agent realizes it needs to kick-off a new assisted navigation session and opens a browser for the developer to enter credentials and go through flows
- [ ] Navigation should always start on https://auth.afip.gob.ar/contribuyente_/login.xhtml and allow the user to enter credentials
- [ ] The agent should record every step of the flow and every user interaction on the browser to understand what needs to be automated for every new flow. This should be recorded in the most reproducible way, such as using (but not limited to) refs of HTML components.
- [ ] The agent should both implement and add automated tests for the new automation
- [ ] The agent should interpret actions done in a paginated list of items as needed to be repeated all teh way through until the last page
- [ ] The agent should request user input in case it can't autonomously reproduce user navigation
- [ ] The agent should document every new automated flow

## Technical Notes

Base new navigation on existing navigation flows using Playwright. Record the flow using agent-browser so the agent can verify and self-correct implementation before deliverint to the user.
