# Danish flex-time tracker

This personal fork of OpenClockwork v2.1.0 simplifies Solo mode for clocking in and out, checking worked hours and maintaining a flex balance. The original Apache-2.0 license and upstream attribution are preserved.

## Included customizations

- Danish interface by default, Copenhagen-aware dates and day boundaries.
- Unified time page with a large clock button, compact flex balance, today's and this week's hours, editable daily records and time history.
- Horizontal week on desktop and swipeable day cards on mobile.
- Work, vacation, sickness and working-from-home entries. Vacation and sickness credit the scheduled day instead of creating timed work sessions.
- A 37-hour schedule: 7 hours 30 minutes Monday–Thursday and 7 hours Friday. Breaks are recorded manually by clocking out and back in.
- Denmark holiday calendar, including the historical removal of Store Bededag from 2024, and a date picker for additional workplace holidays.
- Simplified navigation, accessible settings switches, a light blue/navy theme and updated app icons.

## Configuration and deployment

Use the upstream installation instructions and select Solo mode. The production build override sets `SOLO_DAILY_TARGET_MINUTES=450,450,450,450,420,0,0` (Monday first). Configure the account's weekly target, workdays, timezone, opening flex balance and holiday selection through its settings. These account values and existing time records live in the database, not in this repository. Leave automatic break rules empty for manual breaks.

Build from source using `docker-compose.prod.yml` and `docker-compose.prod.build.yml` with a private environment file. Keep production credentials and database backups outside Git. Back up the database before updating an existing installation.

## Verification

Before this source snapshot was published, the deployed customization passed 198 web tests, the shared-library tests, 15 isolated API summary tests, and production API/web builds. The mobile PWA and desktop application were also checked through their real screens. Publishing this snapshot does not migrate account data.

Upstream source: https://github.com/patrickschiller/openclockwork

Base commit: `5bbaeb2753108a366db8ffa47715ff56b44650ca` (v2.1.0).
