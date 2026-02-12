# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Fix PDF Detection for Non-.pdf URLs

## Context

PDFs served at URLs without a `.pdf` extension (e.g., `https://arxiv.org/pdf/2106.09685`) are not caught by the manifest's URL patterns (`*://*/*.pdf`). This means `pdf-detector.ts` never runs on these pages. Instead, `content-script.ts` runs and treats the page as a regular web page, which cannot interact with Chrome's opaque PDF embed element.

This causes two bugs:
1. **Side panel stops working** after clicking ...

### Prompt 2

commit all changes in git tree (files in versioned and unversioned) except for IMPLEMENTATION.txt. Read the previous commits for the commit message structure.

