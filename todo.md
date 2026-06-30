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
- [x] Redesign Firestore collections around `workoutPlans`, `exercises`, `userProfiles`, `currentBaselines`, `workoutSessions`, and `completedWorkouts`
- [x] Move from `tmp_` collections to production collections
- [x] Replace Glute Machine with Lat Pulldown
- [x] Extract workout progression logic into `src/workoutEngine.ts`
- [x] Extract sync/join/cancel/stale-session decisions into `src/workoutSync.ts`
- [x] Add automated baseline progression tests
- [x] Add automated workout engine tests
- [x] Add automated sync state tests
- [x] Add tandem exercise support
- [x] Correct tandem order to alternate exercises
- [x] Keep compound exercise movements grouped by person during tandem
- [x] Add Phase A workout group model/path helpers
- [x] Add dry-run default group migration script
- [x] Add group model and migration tests
- [x] Purge temporary sync events for all non-active workout sessions
- [x] Move runtime/history state back to top-level collections with explicit group ids
- [x] Add temporary group selection flow for assumed Mike/Victoria user
- [x] Add completed-workout history chart
- [x] Add tandem partner target swap UI
- [x] Add workout background image
- [x] Wait for workout plan and baselines before allowing workout start

## Immediate

- [x] Push latest local commits when ready
- [x] Run default group migration when ready
- [x] Flip app reads/writes to group-scoped paths after migration is verified
- [x] Confirm local app reads `workoutPlans/default` successfully
- [x] Confirm deployed app reads updated `workoutPlans/default` successfully
- [ ] Test on real devices
  - [x] Start / Join workout
  - [x] Warm-up timer
  - [ ] Rapid rep/weight taps on slow gym internet
  - [x] Who-goes-first sync
  - [x] Postpone exercise sync
  - [x] Cancel workout sync
  - [x] Complete workout sync
  - [x] Completed history graph
  - [x] Weight progression updates
  - [x] Inner / outer thigh machine flow
  - [x] Tandem simple exercise flow
  - [x] Tandem with compound exercise flow
  - [ ] Tandem partner target swap

## Data-Driven Workout Plans

- [x] Decide which exercises to replace
- [x] Add new `exercises/{exerciseId}` documents
- [x] Update `workoutPlans/default.exerciseIds`
- [x] Add default current baselines for new exercise IDs
- [x] Separate current baselines from profile preferences
- [x] Decide whether set/reps/setPlan should live in `workoutPlans/default.items` (exercise docs own defaults; plan items stay available for overrides/order)
- [ ] Add an admin/edit UI for workout plans, if manual Firebase editing becomes annoying

## Groups

- [x] Define the default `mike-victoria` workout group in code
- [x] Define group-scoped Firestore path helpers
- [x] Add non-destructive migration from global collections to `workoutGroups/{groupId}`
- [x] Run `npm run migrate:default-group:dry-run` from bash and inspect output
- [x] Run `npm run migrate:default-group` from bash when ready
- [x] Update app data access to use `workoutGroups/{groupId}/...`
- [x] Add temporary group selection layer for assumed Mike/Victoria user
- [x] Add tests for temporary group selection behavior
- [ ] Add full group onboarding UI
- [ ] Add authentication
- [ ] Add Firestore rules for group membership

## UX Improvements

- [x] Add cancel workout to the who goes first screen
- [ ] Add loading states
  - [x] Loading workout group
  - [ ] Saving
  - [x] Loading workout plan / baselines before start
- [ ] Improve mobile layout
- [ ] Increase button sizes
- [ ] Reduce accidental taps
- [ ] Make current state clearer: person, set, exercise
- [ ] Remove debug text from completed workout screen
- [ ] Improve completed history graph styling
- [ ] Improve tandem selection UI wording/guardrails after more gym testing
- [ ] Improve tandem partner target swap affordance after gym testing

## Reliability

- [ ] Add visible Firestore write failure handling
- [ ] Handle missing or invalid Firestore workout plan data gracefully in the UI
- [x] Protect workout completion summary from duplicate writes
- [x] Use transactional event/session writes for critical transitions
- [x] Reload completed workouts when the active group changes and after completion
- [ ] Add browser-level smoke tests for critical UI wiring

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
- [ ] Add session history browsing
- [ ] Add more workout metrics
- [ ] Add custom domain

---

## Notes

- Firestore is the source of truth for active session state.
- Local hardcoded workout data remains the fallback if Firestore plan data is missing or invalid.
- Exercise IDs are the durable keys; exercise names are display text and backward compatibility.
- Compound exercises use movement IDs for per-movement weights and results.
- Tandem is session-only state; it does not require a database schema change.
- The core workout rules are tested through `npm run test`, not browser automation.
- Keep changes incremental and test frequently on real phones.
