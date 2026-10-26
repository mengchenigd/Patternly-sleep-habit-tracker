# Patternly — Sleep and Habit Tracker
A team project developed for an Agile Methods course, combining Scrum-based product design with AI-assisted software development.

## Project Overview
Patternly helps users record sleep and daily habits, explore patterns in their records, and set and track personal goals. The application connects four main screens: **Record → Summary → Plan → Track**.

Our team used a shared Mural board to organize application design through Scrum sprint concepts. My primary responsibility was software development: translating the team's design decisions into a functional prototype through detailed prompting, review, and iterative AI-assisted coding.

## Agile Design Process
The team used Mural to organize ideas, plan sprint work, and communicate design decisions. The application evolved through successive iterations as those decisions were translated into working features and reviewed in the prototype.

## My Contributions
### Application Development and Integration
- Took primary responsibility for translating the team's application design into a functional prototype using AI-assisted development.
- Directed implementation across the Record, Summary, Plan, and Track screens through detailed prompts and successive revisions.
- Reviewed application behavior and requested changes to connect data entry, pattern summaries, goal creation, and progress tracking into a coherent user journey.

### Product Logic and Data Consistency
- Identified a mismatch between recommendations based on sleep duration and progress charts based on sleep quality. Directed revisions to make sleep duration the primary comparison metric, with sleep quality presented separately.
- Defined a date convention in which sleep belongs to the night starting on the selected date, prompting coordinated changes across stored records, summaries, and tracking views.
- Requested current-week and previous-week sleep-quality averages alongside the duration chart to support comparison of both measures.

### Multi-User Data Isolation
- Defined requirements for separating each user's profile, daily records, goals, and check-ins.
- Directed AI-assisted implementation of account-based data access so ordinary users could manage their own information without accessing other users' records.

### User Experience Refinement
- Simplified the goal lifecycle by removing in-place goal editing from the interface and requiring users to end an existing goal before starting a replacement.
- Refined interface hierarchy, labels, explanatory text, and action placement through repeated reviews of the working application.
- Repositioned and restyled the “Give up goal” action to reduce its visual prominence while keeping it accessible.

### Iterative Validation and Demo Preparation
- Exercised the application through local and Codespaces sessions, reporting login failures and working through AI-assisted troubleshooting.
- Coordinated updates to demonstration records and preparation of a classroom version for sharing and presentation.
- Used observations from the running application to guide further revisions beyond the initial generated implementation.

AI coding tools generated substantial portions of the implementation. My contribution centered on specifying intended behavior, directing implementation, reviewing the working prototype, and identifying changes needed to align the software with the team's design.

## Application Features
- **Record:** Log sleep, morning mood, water intake, and exercise using date-based records.
- **Summary:** Visualize records and explore descriptive relationships between habits and sleep.
- **Plan:** Create suggested or custom goals with a defined duration.
- **Track:** Check in on goals and compare weekly sleep duration and average sleep quality.
- **Accounts and settings:** Maintain account-specific records, edit profiles, and replay the onboarding tutorial. An administrator-only data view supports classroom demonstration.

## Technologies
| Area | Tools |
| --- | --- |
| Collaborative design and sprint planning | Mural |
| Frontend | HTML, CSS, and JavaScript |
| Backend | Node.js |
| Data storage | SQLite |
| Development approach | AI-assisted coding and iterative prompting |
| Automated testing | Node.js built-in test runner |

## Run and Test
Requires **Node.js 22.13 or newer**. There are no external runtime dependencies.

From the project folder, run:

    npm start

Open http://localhost:4173.

To run the automated tests:

    npm test

The packaged version passed all 24 tests during verification on October 26, 2026. Coverage includes authentication, account isolation, goal rules, date handling, and analysis logic.

GitHub Pages cannot run the Node.js/SQLite backend. Use a local Node.js environment, Codespaces, or a suitable Node.js host. See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting configuration.

## Classroom Demo and Data
The following accounts are public classroom demonstration accounts, separate from the original local accounts:
| Account | Password | Access |
| --- | --- | --- |
| alice | alice-Class-fb0fcd118310e4e7 | Ordinary user |
| bob | bob-Class-13d13283309ea0c9 | Ordinary user |
| admin | admin-Class-1555f762706905e9 | Administrator |

The included `demo/patternly-demo.sqlite` contains demonstration records and goal history. On first startup, it is copied to `data/patternly-users.sqlite`; subsequent changes are saved to that working copy. Existing working databases are not overwritten. Setting `DB_PATH` bypasses demo initialization.

Working databases and associated WAL files are excluded by `.gitignore`. To reset the demo, stop the server, move the working `data` folder elsewhere, and restart. Preserve any records you need before resetting.

Demo records have fixed dates. Suggestions use a rolling 30-day window independent of the chart period, so older demonstration records may no longer produce suggestions as time advances.

## Record and Analysis Rules
- Sleep belongs to the night starting on the selected date, even when entered the following morning.
- Habits are compared with that night's sleep; morning mood is compared with the preceding night's sleep.
- Missing sleep measurements remain missing and are not treated as zero.
- Pattern summaries and suggestions use rule-based comparisons rather than an AI service. AI assistance was used during development.

Compatible older databases receive a one-time sleep-date conversion. A `*.before-night-dates-*.sqlite` backup is created before converting a nonempty database.

## Scope and Limitations
Patternly is an educational prototype. Its comparisons are exploratory associations, not evidence of causation or medical advice.

The shared demo accounts and administrator are intended for classroom use. A real deployment requires private credentials, removal of shared accounts, and further operational safeguards. This prototype does not provide password recovery, email verification, or automated backups.
