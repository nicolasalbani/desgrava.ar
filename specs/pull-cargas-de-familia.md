---
title: Pull "Cargas de Familia" from ARCA to "Perfil Impositivo" within desgrava.ar
status: implemented
priority: medium
---

## Summary

An automation should login with the user's ARCA credentials, browse into existing "Detalles de las cargas de familia" within SiRADIG's "Carga de Formulatio", go through every row in the "Detalles de las cargas de familia" table and import them into the "Cargas de familia" section on desgrava.ar

This is required so that the user doesn't need to replicate what's already in SiRADIG and avoid consistency issues between what's on SiRADIG and what's on desgrava.ar

## Acceptance Criteria

- [ ] Get all rows within the "Detalles de las cargas de familia" table
- [ ] For each row check if the person already exists within the user's "Cargas de Familia" section. If the person already exists, overwrite existing information with what's on SiRADIG. If the person doesn't exist, add a new row.
- [ ] An animation should make visible that a record was created or updated when doing so
- [ ] A new button should be added for the user to trigger pulling the info and the result of the process should be clearly visible ot the user
- [ ] If user naviagates to another page after the pull process started and while it's still running, after coming back they should continue to see the import in progress or the imported data if the process finished

## Technical Notes

The pull mechanism should be async, since there could be other automations running at any given moment. Make sure to property show the status to the user.

## Out of Scope

Pushing or exporting the desgrava.ar "Cargas de Familia" to SiRADIG is out of scope.
