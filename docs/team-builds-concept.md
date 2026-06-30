# Team Builds Concept

## Core Idea

At the end of a workout, the app already shows total weight lifted. That number can be surprisingly large, which makes it a strong raw material for a team progression feature.

Team Builds turns lifted weight into construction progress. Instead of only saying "you lifted 20 tons," the app says the team moved, hauled, delivered, forged, planted, or assembled materials for a shared project.

The experience should be cooperative, not competitive. Individual workouts contribute to the team build, but the product should avoid rankings, leaderboards, or weight-based status. The main emotional loop is:

1. A participant finishes a workout.
2. Their total lifted weight becomes project material.
3. The shared project visibly advances.
4. The team sees the build come to life over weeks or months.

## Visual Direction

The visual should start as a mostly grey illustration and slowly fill in with color as the team completes work.

For example:

- Unbuilt or locked areas are pale grey, like a blueprint, stone sketch, or unpainted model.
- Current phase areas gain partial color as the team contributes.
- Completed phases are fully colored and may add extra details, motion, lights, characters, props, or environmental effects.
- Completion produces a finished collectible image for the team's history.

The important part is that progress feels visible after normal workouts. A long project should not wait until 25%, 50%, 75%, and 100% to feel different. Each phase should have smaller visual changes that can update frequently.

## Pacing

Projects are expected to take weeks to months to complete all phases.

Recommended structure:

- One project contains several major phases.
- Each phase contains smaller visual milestones.
- Workouts contribute material toward the active phase.
- Phase completions create a small event moment.
- Full project completion creates a larger celebration moment.

The app should be able to tune project size by team activity. A small team and a large team can both use the same theme, but the total material target may differ.

## Contribution Model

The simplest contribution model is raw workout tonnage:

```text
workout contribution = total pounds lifted during completed workout
```

This is easy to understand and keeps the construction metaphor clear. If raw tonnage later makes beginners feel underrepresented, the app can soften the model without changing the theme system:

- Cap unusually large single-workout contributions.
- Add completion bonuses for finishing a planned workout.
- Add personal-record bonuses.
- Convert weight through a curve rather than using it strictly linearly.

For the proof of concept, raw tonnage is probably the right starting point because it makes the metaphor obvious.

## Messaging Tone

The copy should connect weight directly to construction:

- "You delivered 12,480 lb of cargo."
- "The team hauled 84,000 lb of lumber this week."
- "Your workout finished the greenhouse frame."
- "The landing pad is 63% complete."
- "Opening Night is 82,000 lb away."

Avoid competitive language:

- No rankings.
- No "top contributor" framing.
- No vote weight based on pounds lifted.
- No shaming low contributions.

## Proof Of Concept Candidate

The first proof of concept should focus on one theme with a clear construction metaphor, a small set of phases, and a grey-to-color visual progression.

Strong candidates:

- Theme Park: broad appeal, lots of visual variety, natural phase structure, fun final animation.
- Moon Base: strongest weight-to-cargo metaphor, distinctive visual identity, good long-term expansion.
- Farmstead: warm and cozy, easy to understand, good fit for weeks-to-months growth.

Theme Park may be the best first proof of concept because it supports recognizable phases, fun color reveals, and a strong completion moment without needing much explanation.

## Detailed Theme: Theme Park

### Fantasy

The team is building a theme park from the ground up. Lifted weight becomes steel, lumber, concrete, ride parts, lighting rigs, landscaping, and supplies.

The unfinished park starts as a grey site map. As the team contributes, rides and areas turn colorful and animated.

### Possible Phases

1. Main Gate
   - Entry arch
   - Ticket booths
   - Team banner
   - First lights

2. Midway
   - Paths
   - Food stalls
   - Game booths
   - Benches and signs

3. Carousel Plaza
   - Platform
   - Canopy
   - Ride figures
   - Music lights

4. Coaster Frame
   - Steel supports
   - Track pieces
   - Lift hill
   - Test car

5. Water Ride
   - Channel
   - Pump house
   - Boats
   - Splash effects

6. Ferris Wheel
   - Base
   - Wheel frame
   - Gondolas
   - Night lighting

7. Adventure Zone
   - Themed rocks and trees
   - Ride facade
   - Queue details
   - Props and signs

8. Opening Night
   - Guests arrive
   - Rides animate
   - Lights turn on
   - Fireworks

### Example Copy

- "You delivered 11,840 lb of steel for the coaster."
- "The team installed 6 new Ferris wheel gondolas."
- "Your workout finished the entry arch."
- "Phase complete: the midway lights are on."
- "Opening Night is 82,000 lb away."

### Why It Works

Theme Park gives the team many small things to unlock. It can appeal to people who like playful visuals, motion, lights, and recognizable landmarks. It also supports variants later, such as seaside boardwalk, spooky park, space park, winter carnival, or jungle adventure park.

## Detailed Theme: Moon Base

### Fantasy

The team is delivering cargo to the moon and assembling a base. Lifted weight becomes cargo mass launched from Earth: habitat modules, steel, solar panels, rover parts, greenhouse supplies, tools, and life-support equipment.

The unfinished moon base starts as a grey lunar site. Completed modules turn bright, lights come on, and small astronauts, rovers, antenna signals, or greenhouse plants appear over time.

### Possible Phases

1. Landing Zone
   - Landing pad
   - Beacon lights
   - Cargo crates
   - Dust-cleared work area

2. Power Grid
   - Solar panel frames
   - Battery packs
   - Cable lines
   - First powered lights

3. Habitat Core
   - Main habitat shell
   - Airlock
   - Windows
   - Interior glow

4. Rover Bay
   - Garage platform
   - Tool racks
   - Rover chassis
   - Rover tracks

5. Greenhouse
   - Dome frame
   - Glass panels
   - Soil trays
   - First plants

6. Research Dome
   - Dome shell
   - Sensor equipment
   - Lab lights
   - Satellite dish

7. Comms Tower
   - Tower base
   - Antenna mast
   - Signal animation
   - Team flag

8. Colony Lights
   - Full base lighting
   - Moving rover
   - Astronauts outside
   - Earth in the sky

### Example Copy

- "You delivered 14,200 lb of lunar cargo."
- "The team installed the next solar array."
- "Your workout sealed the habitat airlock."
- "Phase complete: the greenhouse has power."
- "The comms tower needs 38,000 lb of equipment."

### Why It Works

Moon Base has the clearest conversion from lifted weight to transported mass. It feels ambitious and a little silly in a good way. It also makes large totals feel natural because space construction should require huge amounts of cargo.

## Other Theme Ideas

- Farmstead: haul lumber, stone, soil, fencing, feed, and tools to build a farmhouse, barn, fields, silo, orchard, and harvest festival.
- House: pour foundation, raise framing, install roof, finish rooms, add porch, landscape yard, and hold a housewarming.
- Garden: move soil, place stones, build paths, plant beds, raise trellises, add pond, light lanterns, and reach full bloom.
- Pyramid: quarry and stack stone blocks, reveal sandstone layers, carve details, light torches, add banners, and complete a sunlit monument.
- Castle: quarry stone, raise walls, build gates, towers, courtyard, banners, great hall, and final feast.
- Treehouse Village: raise platforms, bridges, rope ladders, lanterns, tiny homes, lookout posts, and a canopy gathering place.
- Aquarium: deliver glass, rock, coral structures, filtration equipment, habitats, lighting, and gradually introduce sea life.
- Wildlife Sanctuary: build trails, shelters, observation decks, ponds, restoration zones, and release animals as phases complete.
- Music Venue: build the stage, lights, sound booth, seating, backstage, marquee, and opening-night show.
- Skatepark: pour concrete, build ramps, rails, bowls, murals, lights, and host the first session.
- Airship: forge frame pieces, build hull panels, engines, cabins, balloons, navigation deck, and launch sequence.
- Pirate Ship: gather timber, raise hull, mast, sails, cannons, captain's quarters, and set sail.
- Underwater Lab: deliver pressure hulls, airlocks, power systems, research pods, submarine dock, and reef lights.
- Mountain Camp: haul supplies, build tents, cabins, trail markers, climbing wall, fire circle, and summit flag.
- Recording Studio: build rooms, acoustic panels, mixing desk, instruments, live room, lights, and first session.

## Open Questions For Later

- Should a team choose the next phase, or should the first version use a fixed phase order?
- Should projects scale automatically based on team size and recent activity?
- Should contribution be raw weight only, or should completed workouts and personal records add bonuses?
- Should the final artifact be shareable outside the app?
- Should completed projects stay in a team gallery?
- Should themes have seasonal variants or limited-time builds?

## First Prototype Scope

For the first proof of concept, keep the scope narrow:

- One project theme.
- Fixed phase order.
- Raw workout tonnage as material contribution.
- Grey-to-color illustration states.
- A post-workout message that explains what the workout added.
- A team build screen showing current phase, total progress, and the visual.

The goal is to prove that the workout total feels more fun when it visibly builds something with the team.
