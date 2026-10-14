# P1 reliability fixes

- **Rig setup:** `/config` and the stage drawer share MIDI port selection, lane-source controls, and display settings. Motion, quality, visual offset, and guitar device preferences persist in this browser between songs. A remembered guitar source reconnects when the next song page mounts.
- **Voting:** taps made while the vote queue is refreshing from the database are saved in order, followed by another refresh. The queue stays busy until every queued write and the final refresh finish.
- **Guitar input:** switching source, selecting another device, stopping input, or leaving the page invalidates pending microphone requests. Tracks from obsolete requests are stopped immediately. An obsolete failure cannot stop a newer input or replace its status.
- **Show phase:** host updates to `idle`, `playing`, and the encore deadline are serialized. Failed updates retry after two seconds while the stage clock runs. A newer phase takes precedence over a stale retry. The host's Rig drawer reports failures and clears the message after recovery. Leaving the stage stops retries, waits for an in-flight write, then attempts one final `idle` update.

The database still needs the `show_phase` row and host write policy described in [the database setup](rock-anthem-database.md). A missing row or denied write is treated as a failed update. The final teardown update remains best effort; closing the browser cannot guarantee a network write completes.

Regression checks run with `npm test`: votes arriving during resync; guitar requests resolving or rejecting out of order and after teardown; phase retry timing, recovery, latest-phase selection, serialization, and disposal. Audio tests import the actual composable with fake devices and do not play audio or request microphone access.
