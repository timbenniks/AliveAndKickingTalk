# Solo choreography

The existing solo cue now coordinates the camera, beams and stage lighting
through the same 1.4-second transition in and out:

- The camera pushes toward the fretboard and reduces its wandering.
- The existing beams fade in as a single slowly sweeping fan.
- Side lighting and the backline wash soften while the fretboard key and
  crowd backlight gain a little emphasis. Moving heads adopt the two cue colors.

Pausing holds the transition and beam sweep. Reduced motion disables the solo
movement and lighting transition. Existing solo detection and pyro are unchanged;
no new lights, particles or post-processing passes are added.

`npm test` checks entry, release, pause and reduced motion, including transition
timing at 30, 60, 120 and 144fps.
