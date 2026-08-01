---
title: ModuLoop
summary: A hardware music sequencer built by four of us for senior design at UMass Amherst. I led the software architecture, on a Teensy 4.1.
status: Completed
year: 2024
order: 5
featured: false
technologies:
  - C++
  - Teensy 4.1
  - Embedded audio
  - QSPI PSRAM
languages:
  - C++
schemaType: CreativeWork
related:
  - hardware-and-audio
  - systems
repository: https://github.com/cpcurtin/SDP-Team-28
live: https://websites.umass.edu/ece-sdp/team-28/
liveLabel: Team page
---

ModuLoop was senior design at UMass Amherst, two semesters across fall 2023 and
spring 2024, built by four of us: Conor Curtin, Shawn Colby, Ryan Gordon and me.
The reference point was the Teenage Engineering Pocket Operator. Conor and Ryan
were both in the UMass drumline and wanted something they could build drum loops
on without opening a laptop. The devices they had used were each limited in one
of three ways: a fixed sound library, a fixed number of steps, or a companion
application you had to run alongside the hardware. We set out to remove all
three.

I came in with almost no music background, so the first thing I had to learn was
the vocabulary of timing — steps inside beats, beats inside measures, measures
chained into a phrase. That turned out to be the real starting point, because
those four words are the data structure the entire program is built on.

I was the software lead. That meant the module architecture and most of the
integration work: the LCD and directional pad end to end, the screen logic for
sounds, effects and saved configurations, custom sound storage and caching, the
dispatch that fires both audio paths on the same step, and the battery and power
management system. I was also the steward of the source tree. Four people were
editing one firmware image, and unifying that into something that compiled and
ran was a standing job rather than an occasional one.

The rest of the system belonged to the rest of the team. Conor and Ryan took
every board we built and the entire analog path — mixing the two audio sources,
the filters, the amplifiers — along with the enclosure and the speakers in it.
Shawn owned the metronome, which on a sequencer is the one subsystem nobody else
is allowed to be casual about, and the library of live effects that run on top
of it. What follows is my half.

## The shape of the program

The device runs on a Teensy 4.1, an ARM Cortex-M7 clocked at 600 MHz, in C++
through Teensyduino. There is no operating system and no scheduler — one main
loop, and a timer interrupt that has to be serviced before the next step is due.

I structured the program as one module per hardware concern: SD storage, custom
sound playback, MIDI, LCD, navigation, the button matrix, the LED matrix,
measures, effects. Each is a `.ino` implementation with a matching header, and
`main.ino` does nothing but initialize each one in order and then poll. That
division was less about elegance than about four people editing the same
firmware at once. Every subsystem had an owner, and the header was the contract
between us. Reconciling the branches was still my job, but the merges were about
program state rather than about who had reformatted whose file. The largest of
those was the restructuring between our third and fourth design reviews, where
most of the codebase moved at once and had to come back together working.

## Steps, beats, measures

The music model is nested structs. A `Sound` is a MIDI bank, instrument and note
or a pointer to a cached sample. A `Step` holds up to four sounds, a `Beat` holds
up to six steps, a `Measure` holds up to four beats, and a `Track` holds a chain
of measures. Every one of those limits is a hardware limit wearing a data
structure.

The front panel is a four-by-nine grid of silicone buttons with an LED behind
each one. The left four-by-six is the measure matrix — one button per step. The
right four-by-three is the palette: twelve slots, each holding a sound or an
effect. You pick a sound on the LCD, assign it to a palette button, then press
measure buttons to place it. Ryan wired the grid as a row-column address through
decoders, which brought the pin cost down from 26 GPIO to 18, and I took the
scan results and turned them into edits on the measure.

## Four sounds at once, and the thing that broke it

The specification we cared most about was four sounds layered on a single step,
in any combination of preset and custom. The preset side went to a VS1053b, an
off-board chip that implements General MIDI in hardware and takes a serial
command sequence. The custom side was supposed to be just as direct:
uncompressed RAW files at 16 bits and 44.1 kHz, read off the Teensy's built-in
microSD socket over four-bit SDIO.

It did not work, and it did not work in a way that no amount of rewriting would
have fixed. Class 10 SD cards are fast for sequential access. Read three or four
files concurrently, one block at a time, and the controller inside the card
introduces enough latency to stall the audio library outright. The bug was in
the media, not in my code.

The fix was to stop reading during playback. I soldered an eight-pin 8 MB QSPI
PSRAM module to the pads on the underside of the Teensy — 133 MHz, 32-byte
wrapped burst transfers — and made it a cache. Selecting a custom sound loads it
into PSRAM once. Playing it hands the sample to the PT8211 DAC over I2S, where
DMA moves the blocks without blocking the main loop. The SD card became a
startup and assignment concern instead of a playback one, and four-sound
polyphony fell out immediately.

Nothing about that was in the original plan. It is the part of the project I
point at when someone asks what senior design taught me: the specification was
correct, the software was correct, and the component in the middle simply would
not do the thing its datasheet implied.

## Two audio paths, one step

Having both sound sources working separately is not the same as having them
work together, and the gap between those two states is where a lot of my time
went. The paths have almost nothing in common. A preset sound is a serial
message to a chip that is not on the Teensy at all: select the bank, select the
instrument, send note-on, and the VS1053b's internal DAC produces the sound on
its own schedule. A custom sound is a buffer already sitting in PSRAM, handed to
the PT8211 over I2S and moved by DMA. One is a command to a peer device, the
other is a stream the processor is feeding.

Both have to land on the same step boundary, and a step at 200 BPM with six
steps to the beat is not a generous window. My work begins where Shawn's ends:
the metronome trap tells me a step is due, and everything after that is mine to
get out on time. The dispatch is a single pass. When the trap fires, the
previous step's sounds are stopped and the new step's four slots are walked in
order, each one routed by whether it carries a MIDI bank or a pointer to a
cached sample. Everything in that pass had to stay non-blocking.
The serial writes are short and synchronous; the sample playback starts DMA and
returns immediately. Neither is allowed to wait on the other, and neither is
allowed to still be working when the next trap comes due.

That constraint is the reason the PSRAM cache mattered beyond polyphony. A
sample read from the SD card mid-step would have introduced a stall on one of
the two paths and nothing on the other, so the layered sound would arrive
smeared rather than simply late — the failure mode you can hear.

## The pin budget

Between the DAC, the MIDI chip, the LCD, the d-pad, the tempo potentiometer,
three decoders and the matrix, the Teensy's pins were the scarcest resource in
the system. Some assignments could not move at all — the SD socket and the flash
pads are fixed by the board — so everything else had to be laid out around them.
The allocation table lives in a comment block at the top of `main.h`, which is
the single most edited comment in the repository and the closest thing the
project has to a floor plan.

## The menu is a tree

The interface is a four-row by twenty-column character LCD over I2C, driven by a
four-button directional pad. I built it as model-view-controller, which was
worth the ceremony on a display that narrow. The model is a tree of navigation
structs; each node holds the full array of items it can show, a four-row window
into that array, the current index, and links to its parent and children. The
view is that window. The d-pad is the controller and touches nothing else.

The bottom row is reserved for a status banner carrying tempo, measure and
track, so the usable window is really three rows deep. Everything selectable is
populated at startup — the sounds directory is scanned off the SD card, the MIDI
library is enumerated from the chip's instrument tables, the saved tracks are
listed — which means the menu never asserts a sound that is not actually there.

Almost every decision the user makes passes through this tree. Custom sounds,
MIDI melodic sounds down through octave and note, MIDI percussion, the seven
effects, beats per measure and steps per beat, adding and removing and
reordering measures, and the whole track save and load path. Each of those is a
branch with its own leaf actions, and the leaf is where the selection stops
being a menu item and becomes a change to the running state — usually by arming
the next palette button press to receive whatever was just chosen. Getting that
handoff to feel obvious on three visible rows took more iterations than any
other part of the interface.

## Saving a track

Tracks are written to the SD card as JSON with ArduinoJson, named `TRACK-XXX`
from a three-character name the user picks on the LCD. A saved file holds the
entire nested structure: every measure, its beats, its steps, the sounds on each
step, the beats-per-measure and steps-per-beat settings, and the palette state.
Loading frees the current track's memory except for cached sounds the incoming
track also uses, then rebuilds the structs from the file.

JSON was a deliberate choice over a packed binary format. The project is open
source, and a save file someone can open in a text editor is one somebody else
can write a tool against.

## Running off a battery

Portability was a requirement from the start, which made power my problem too. I
sized the pack from a full-system power analysis and specified a 1S3P 18650
lithium-ion pack — 3.7 V nominal, 10,050 mAh, 37 Wh — with protection built into
the pack itself for overcharge, under-discharge and overcurrent.

Pack protection alone is not a power system, so I integrated an Adafruit
PowerBoost 1000c between the battery and everything else. Its charge controller
does load sharing, which is the feature that matters in practice: plugging the
device in or unplugging it mid-loop does not interrupt playback, and a charged
battery is bypassed rather than needlessly cycled. Its converter takes the
battery's sagging 3.7 V nominal up to a stable 5.2 V for the Teensy, the LCD and
the analog board, and its enable pin became the device's actual power switch.

There is one failure mode from this that the repository still warns about in
all-capitals. The firmware's serial initialization blocks waiting for a host to
connect. On wall power with a laptop attached it returns instantly, so it is
invisible during development. On battery, with nothing on the other end of the
USB port, it never returns and the device simply appears dead. It sits behind a
compile-time flag now, and the note telling you to set it is deliberately hard
to miss.

## Where it ended up

The finished device met every specification we wrote at the start and several we
added along the way: four-sound polyphony across preset and custom sounds,
timing accurate to within 2% at 200 BPM, seven hold-to-apply effects, measure
chaining and reordering, variable beats and steps, track save and load, analog
high-pass and low-pass filters on the output, and battery or wall power. It fits
in an enclosure Conor and Ryan built out of a 3D-printed faceplate and stained
poplar, with the speakers mounted in the front of it.

Team 28 won the Course Coordinator Award, one of three given out each year and
chosen by the ECE faculty who oversee the whole senior design program. Our
[team page](https://websites.umass.edu/ece-sdp/team-28/) still hosts the four
design reviews, the demo day poster and video, and the final report.

It was my first time writing C++, and my first time on a system with this much
hardware talking to itself. My embedded background was the ATmega328p, which
made the Teensy feel familiar in a way that was occasionally a trap:
Teensyduino looks like Arduino and mostly behaves like it, but the libraries are
modified and not exhaustively equivalent to the originals. The polyphony
roadblock lived exactly in that gap. Taking on something large without knowing
the best practices of the language you are writing it in is uncomfortable, and
in retrospect it is also the whole job.

## The team

ModuLoop was Team 28 of the UMass Amherst ECE senior design program, class of 2024.

- [Conor Curtin](https://www.linkedin.com/in/conor-curtin-66697a18a/) — boards
  and analog audio, and the manager who kept four people and a budget pointed in
  the same direction.
- [Ryan Gordon](https://www.linkedin.com/in/ryan-gordon-142175260/) — boards and
  analog audio, and the enclosure the whole thing lives in.
- Shawn Colby — the metronome, and the library of live effects that run on top
  of it.
- Evan Rovelli — software architecture, integration and the source tree.

Our advisor was
[Professor Baird Soules](https://www.umass.edu/engineering/about/directory/baird-soules),
Senior Lecturer and Director of Experiential Learning in ECE. He gave us a year
of guidance on a project that changed shape more than once, and the version of
ModuLoop that ended up in the case is better for it. Thank you.
