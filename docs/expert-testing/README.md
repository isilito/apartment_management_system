# Expert testing kit

Printable documents for setting up the system and having it evaluated by an expert tester.
All are Letter size ("short bond"), ready to print or send as PDF.

| File | Who fills it in | Purpose |
|---|---|---|
| `01 - Database Setup Tutorial.pdf` | Proponents / whoever installs the system | Step-by-step database setup for XAMPP and Vercel (same content as `docs/DATABASE_SETUP.md`) |
| `02 - Expert Tester Profile Form.pdf` (ET-01) | Expert tester, then the adviser | Proves the tester is qualified and independent: background, experience, certifications, a verification reference, supporting documents, conflict-of-interest declaration, data privacy consent, and an adviser-only verification box |
| `03 - Expert Testing Evaluation Form.pdf` (ET-02) | Expert tester | 33 pass/fail test scenarios (linked to the TC numbers in the test-case document) plus 4 blank ones, a 31-item ISO/IEC 25010 quality rating, a defect log, verdict and signature, and a results summary page for the proponents |
| `04 - Expert Assessment Form.pdf` (ET-03) | Expert tester, then the proponents | The expert's own judgment: a 1–5 rating and comments for each of 11 modules, whether each project objective was met, required revisions (priority A/B/C, with the proponents' fix and the expert's initials once checked), the final recommendation, and a signed **Certificate of Expert Evaluation** for the appendix |

**Suggested order:** send ET-01 first and have the adviser verify it. Give the tester the system URL
and ET-02, then ET-03 once testing is done. Fix the Priority A revisions in ET-03 Part C, have the
expert initial each one, and collect the signed certificate on the last page of ET-03.

## Editing

The PDFs are built from the HTML files in `source/`. To change the wording (for example, to
pre-fill the institution or adviser's name), edit the HTML and rebuild:

```powershell
powershell -ExecutionPolicy Bypass -File docs\expert-testing\source\build.ps1
```

This uses Microsoft Edge (or Chrome) in headless mode; nothing else needs to be installed.
