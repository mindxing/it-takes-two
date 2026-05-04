# TODO

## 🚀 Immediate (Post-Deploy)

- [ ] Commit and push deployed working version
- [ ] Test on real devices (2 phones)
  - [ ] Start / Join workout
  - [ ] Sync between devices
  - [ ] Cancel workout sync
  - [ ] Complete workout sync
  - [ ] Completed history graph
  - [ ] Weight progression updates

## 🔒 Security

- [ ] Replace Firestore test rules with proper rules
- [ ] Ensure only intended data is readable/writable

## ⚙️ Reliability

- [ ] Add loading states
  - [ ] "Connecting..."
  - [ ] "Saving..."
- [ ] Add error handling
  - [ ] Firestore write failures
  - [ ] Missing session
- [ ] Handle race conditions
  - [ ] Double taps on buttons
  - [ ] Simultaneous updates from two devices
  - [ ] Cancel during update

## 👤 User Identity

- [ ] Improve device/person selection (Mike vs Victoria)
- [ ] Persist user identity per device

## 🧹 Cleanup

- [ ] Remove dev/test buttons (or guard with `import.meta.env.DEV`)
- [ ] Delete old Firestore test data
  - [ ] test collection
  - [ ] old demo sessions
  - [ ] malformed completedWorkouts

## 📱 UX Improvements

- [ ] Improve mobile layout
- [ ] Increase button sizes
- [ ] Reduce accidental taps
- [ ] Make current state clearer (person, set, exercise)

## 📊 Data & Features

- [ ] Auto-refresh completed workouts (no reload)
- [ ] Improve graph styling
- [ ] Add more workout metrics (optional)

## 🧠 Future Enhancements

- [ ] Improve weight progression algorithm
- [ ] Add session history browsing
- [ ] Add custom domains (optional)
- [ ] Add authentication (optional)

---

## 📝 Notes

- Firestore is the source of truth
- Avoid mixing local-only state with synced state
- Keep changes incremental and test frequently
