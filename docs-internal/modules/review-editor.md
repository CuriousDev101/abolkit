# Module: review-editor

- **Owner:** pair ol (pair ab reviews accessibility) · **Issue:** #29 · **Location:** `apps/review-editor` (may start as a page in `apps/docs`)

## Purpose

Amharic speech-to-text and translation are not reliable. This small app is where a human turns machine drafts into trustworthy captions and audio descriptions. It is the reason we can say captions are reviewed.

## Features

- List of cues with start, end and text; edit text and timing; split and merge; add and delete cues.
- Preview: click or press Enter on a cue to jump to that time in `<abol-player>`; play a cue in a loop.
- Machine-generated cues shown as "needs review" until marked reviewed; a lesson-level status (draft / reviewed).
- Edit captions (per language) and audio description cues; add an AD clip or record one.
- Save through `PUT /api/lessons/:id/captions/:lang` (and descriptions); export `.vtt`.
- Shows a consent notice if the lesson used a provider that sends data off the host.

## Accessibility (it is a tool for people who may use assistive tech)

Fully keyboard operable (table navigation, shortcuts documented and switchable), labelled inputs, error messages in plain language, no timeouts, live-region status for save results, works at 200% zoom.

## Done when

A reviewer can fix a wrong Amharic line, adjust timing, preview it and save, using only the keyboard; saved VTT loads in the player.

## Risks

Timing edits that overlap cues (validate); concurrent edits (last write wins is acceptable for the hackathon; show a warning).
