# TODO

## Done

- [x] Add rapid-tap hardening for reps and weight steppers
- [x] Disable critical action buttons while saves are in flight
- [x] Add patch version bump script
- [x] Display app version from `package.json`
- [x] Add stable exercise IDs in local workout data
- [x] Store `exerciseId` in new workout results
- [x] Keep backward compatibility with old exercise-name history/profile keys
- [x] Add Firestore-backed workout plan read path with local fallback
- [x] Add one-off workout plan seed script
- [x] Seed current workout plan data into Firestore
- [x] Commit data-driven workout plan foundation
- [x] Add compound exercise support for inner/outer thigh machine
- [x] Replace dumbbell Romanian deadlift with thigh machine in seeded default plan
- [x] Snapshot loaded workout plan into new workout sessions

## Immediate

- [ ] Push latest local commits when ready
- [ ] Commit docs updates
- [x] Confirm local app reads `workoutPlans/default` successfully
- [ ] Confirm deployed app reads updated `workoutPlans/default` successfully
- [ ] Test on real devices
  - [x] Start / Join workout
  - [ ] Warm-up timer
  - [ ] Rapid rep/weight taps on slow gym internet
  - [x] Who-goes-first sync
  - [ ] Postpone exercise sync
  - [x] Cancel workout sync
  - [ ] Complete workout sync
  - [ ] Completed history graph
  - [ ] Weight progression updates
  - [x] Inner / outer thigh machine flow

## Data-Driven Workout Plans

- [x] Decide which exercises to replace
- [x] Add new `exercises/{exerciseId}` documents
- [x] Update `workoutPlans/default.exerciseIds`
- [x] Add default profile weights for new exercise IDs
- [ ] Decide whether set/reps/setPlan should live in `workoutPlans/default.items`
- [ ] Add an admin/edit UI for workout plans, if manual Firebase editing becomes annoying

## UX Improvements

- [ ] Add cancel workout to the who goes first screen
- [ ] Add loading states
  - [ ] Connecting
  - [ ] Saving
  - [ ] Loading workout plan
- [ ] Improve mobile layout
- [ ] Increase button sizes
- [ ] Reduce accidental taps
- [ ] Make current state clearer: person, set, exercise
- [ ] Remove debug text from completed workout screen
- [ ] Improve graph styling

## Reliability

- [ ] Add visible Firestore write failure handling
- [ ] Handle missing or invalid Firestore workout plan data gracefully in the UI
- [ ] Protect workout completion summary from duplicate writes
- [ ] Consider transactions for critical transitions like Done / Next
- [ ] Auto-refresh completed workouts instead of loading only after completion

## Security

- [ ] Replace Firestore test rules with proper rules
- [ ] Ensure only intended collections are readable/writable
- [ ] Consider authentication

## Cleanup

- [ ] Clean up mojibake/encoding damage in docs and UI text
- [ ] Delete old Firestore test data
  - [ ] test collection
  - [ ] old demo sessions
  - [ ] malformed completedWorkouts
- [ ] Consider lazy-loading Recharts to reduce initial bundle size

## Future

- [ ] Improve device/person selection: Mike vs Victoria
- [ ] Persist user identity per device
- [ ] Improve weight progression algorithm
- [ ] Add session history browsing
- [ ] Add more workout metrics
- [ ] Add custom domain

---

## Notes

- Firestore is the source of truth for active session state.
- Local hardcoded workout data remains the fallback if Firestore plan data is missing or invalid.
- Exercise IDs are the durable keys; exercise names are display text and backward compatibility.
- Compound exercises use movement IDs for per-movement weights and results.
- Keep changes incremental and test frequently on real phones.
