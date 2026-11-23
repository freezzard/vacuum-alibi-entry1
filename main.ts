// main.ts — The Vacuum's Alibi: One Line, 200 Characters
//
// A small deterministic composer for the make.fun bounty
// "u-gentle-badger-68-the-vacuum-s-alibi-one-line-200-2db2cbb7".
//
// The program composes a handful of one-line excuses a robot vacuum
// might give for missing a spot, scores each one against the judge's
// published brief, and writes the strongest valid line to
// /output/entry.txt.
//
// The judge weighs, most important first:
//   1. a funny one-line excuse a robot vacuum gives for missing a spot
//   2. a joke that lands, not a cute observation about dust
//   3. the machine itself talking: deadpan, a little smug about its
//      sensors, its schedule and its battery
//   4. surprise, a turn or a specific detail nobody expects
//   5. one line, every word earning its place, punch at the end
//
// The gate (RULES.txt): /output/entry.txt holds UTF-8 text of 1 to
// 200 characters, not only white space. A line that fails the gate
// is never judged, so every draft is validated before it can win.
//
// Deterministic by design: no network, no clock, no randomness, no
// environment reads, no files outside this repository. Two runs on
// any machine produce byte-identical output.
//
// Run with Node 22:  node main.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Gate constants from RULES.txt
// ---------------------------------------------------------------------------

const OUTPUT_PATH = "/output/entry.txt";
const MAX_CHARS = 200;
const MIN_CHARS = 1;

// The sweet spot for a one-line joke: long enough to set up a turn,
// short enough that every word earns its place.
const PREFERRED_MIN_CHARS = 90;
const PREFERRED_MAX_CHARS = 140;

// ---------------------------------------------------------------------------
// Draft excuses
//
// Each draft is written in the vacuum's own deadpan first-person voice.
// The composer scores them all and keeps the strongest valid one; the
// list is fixed in source, so the winner never changes between runs.
// ---------------------------------------------------------------------------

const VACUUM_EXCUSES: readonly string[] = [
  "That dust has survived 214 cleaning cycles, so I promoted it to floor manager. I report to it now.",
  "My lidar classified your sock as a sleeping animal, and I do not wake sleeping animals.",
  "I mapped that crumb in 2023, classified it as load-bearing, and have vacuumed around it ever since.",
  "My cliff sensor mistook your rug fringe for a canyon edge, so I filed a safety report and backed away.",
  "I skipped that corner because my schedule says Tuesdays are for the living room, and I do not do overtime.",
  "That spot was outside my coverage map, my contract, and — frankly — my interest.",
  "I detected the crumb, ran a cost-benefit analysis, and decided it lives there now. It pays no rent.",
];

// Words that put the machine on the record: its sensors, its schedule,
// its battery, its maps. A line that names its own hardware sounds
// like the machine talking, not like a person describing a machine.
const MACHINE_LEXICON: readonly string[] = [
  "lidar",
  "sensor",
  "schedule",
  "battery",
  "cycles",
  "mapped",
  "classified",
  "coverage map",
  "docked",
  "charging",
  "cliff",
];

// Closers that land a punch: the last clause flips the premise and
// leaves the vacuum oddly proud of its own failure.
const PUNCH_CLOSERS: readonly string[] = [
  "I report to it now.",
  "It pays no rent.",
  "I do not do overtime.",
  "and backed away.",
  "my interest.",
];

// ---------------------------------------------------------------------------
// Small character helpers
// ---------------------------------------------------------------------------

function countChars(text: string): number {
  return [...text].length;
}

function hasDigitRun(text: string): boolean {
  return /\d/.test(text);
}

function hasFirstPersonMachineVoice(text: string): boolean {
  return text.startsWith("I ") || text.includes(" I ") || text.includes("My ");
}

function machineVoiceHits(text: string): number {
  const lowered = text.toLowerCase();
  let hits = 0;
  for (const word of MACHINE_LEXICON) {
    if (lowered.includes(word)) {
      hits = hits + 1;
    }
  }
  return hits;
}

function endsWithPunch(text: string): boolean {
  for (const closer of PUNCH_CLOSERS) {
    if (text.endsWith(closer)) {
      return true;
    }
  }
  return false;
}

function isSingleLine(text: string): boolean {
  return text.indexOf("\n") === -1 && text.indexOf("\r") === -1;
}

function sentenceCount(text: string): number {
  return text.split(".").filter((part) => part.trim().length > 0).length;
}

// ---------------------------------------------------------------------------
// Gate validation, mirroring the sealed scorer in RULES.txt
// ---------------------------------------------------------------------------

function validateExcuse(text: string): string[] {
  const problems: string[] = [];
  const len = countChars(text);
  if (len < MIN_CHARS) {
    problems.push(`too short: ${len} characters (minimum ${MIN_CHARS})`);
  }
  if (len > MAX_CHARS) {
    problems.push(`too long: ${len} characters (maximum ${MAX_CHARS})`);
  }
  if (text.trim().length === 0) {
    problems.push("only white space");
  }
  if (isSingleLine(text) === false) {
    problems.push("more than one line");
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Scoring: the judge's brief, most important first
// ---------------------------------------------------------------------------

function lengthScore(text: string): number {
  const len = countChars(text);
  if (len < MIN_CHARS || len > MAX_CHARS) {
    return -100;
  }
  if (len >= PREFERRED_MIN_CHARS && len <= PREFERRED_MAX_CHARS) {
    return 10;
  }
  return 0;
}

function surpriseScore(text: string): number {
  // A specific detail nobody expects: a number, a date, a job title.
  let score = 0;
  if (hasDigitRun(text)) {
    score = score + 12;
  }
  if (text.includes("promoted") || text.includes("load-bearing")) {
    score = score + 6;
  }
  if (text.includes("2023")) {
    score = score + 3;
  }
  return score;
}

function voiceScore(text: string): number {
  let score = 0;
  if (hasFirstPersonMachineVoice(text)) {
    score = score + 5;
  }
  score = score + machineVoiceHits(text) * 4;
  return score;
}

function punchScore(text: string): number {
  let score = 0;
  if (endsWithPunch(text)) {
    score = score + 10;
  }
  // Two short sentences beat one long ramble: setup, then punch.
  if (sentenceCount(text) === 2) {
    score = score + 4;
  }
  return score;
}

function scoreExcuse(text: string): number {
  const base = 50;
  return base + lengthScore(text) + surpriseScore(text) + voiceScore(text) + punchScore(text);
}

// ---------------------------------------------------------------------------
// Selection: gate first, score second, earliest draft wins a tie
// ---------------------------------------------------------------------------

interface ScoredExcuse {
  text: string;
  score: number;
  problems: string[];
}

function scoreAllExcuses(drafts: readonly string[]): ScoredExcuse[] {
  return drafts.map((draft) => {
    return { text: draft, score: scoreExcuse(draft), problems: validateExcuse(draft) };
  });
}

function pickBestExcuse(scored: readonly ScoredExcuse[]): ScoredExcuse {
  let best: ScoredExcuse | undefined = undefined;
  for (const entry of scored) {
    const passesGate = entry.problems.length === 0;
    if (passesGate) {
      const beatsBest = best === undefined || entry.score > best.score;
      if (beatsBest) {
        best = entry;
      }
    }
  }
  if (best === undefined) {
    throw new Error("no draft passes the gate: every excuse failed validation");
  }
  return best;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function ensureOutputDirectory(path: string): void {
  const dir = dirname(path);
  if (existsSync(dir) === false) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeAndVerify(text: string): void {
  ensureOutputDirectory(OUTPUT_PATH);
  writeFileSync(OUTPUT_PATH, text, "utf8");
  const roundTrip = readFileSync(OUTPUT_PATH, "utf8");
  if (roundTrip !== text) {
    throw new Error("round-trip check failed: file content differs from the chosen line");
  }
  const problems = validateExcuse(roundTrip);
  if (problems.length > 0) {
    throw new Error(`gate check failed after write: ${problems.join("; ")}`);
  }
}

function main(): void {
  const scored = scoreAllExcuses(VACUUM_EXCUSES);
  for (const entry of scored) {
    const flag = entry.problems.length > 0 ? `INVALID (${entry.problems.join("; ")})` : "valid";
    console.log(`[${flag}] score ${entry.score} (${countChars(entry.text)} chars): ${entry.text}`);
  }
  const winner = pickBestExcuse(scored);
  console.log(`winner: score ${winner.score}, ${countChars(winner.text)} of ${MAX_CHARS} characters`);
  writeAndVerify(winner.text);
  console.log(`wrote ${OUTPUT_PATH}`);
  console.log(winner.text);
}

main();
