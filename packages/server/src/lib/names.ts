const adjectives = [
  "swift",
  "brave",
  "calm",
  "dark",
  "eager",
  "fair",
  "grand",
  "happy",
  "keen",
  "lucky",
  "noble",
  "proud",
  "quick",
  "rare",
  "sharp",
  "true",
  "vivid",
  "warm",
  "wild",
  "zen",
];

const animals = [
  "bear",
  "crow",
  "deer",
  "eagle",
  "fox",
  "hawk",
  "lion",
  "moose",
  "otter",
  "puma",
  "raven",
  "shark",
  "tiger",
  "viper",
  "whale",
  "wolf",
  "lynx",
  "heron",
  "cobra",
  "bison",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a fun adjective-animal name like "swift-eagle" */
export function generateName(): string {
  return `${pick(adjectives)}-${pick(animals)}`;
}
