export interface Program {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export const programs: Program[] = [
  {
    id: "help-desk",
    name: "Company Help Desk App",
    description:
      "An AI-powered help desk that triages support tickets, suggests solutions from your knowledge base, and escalates to human agents when needed.",
    tags: ["Customer Support", "AI", "Automation"],
  },
  {
    id: "kerbal-plugin",
    name: "Kerbal Space Program Plugin",
    description:
      "A mission planning assistant that calculates delta-v budgets, suggests optimal transfer windows, and helps design efficient spacecraft.",
    tags: ["Gaming", "Simulation", "Space"],
  },
  {
    id: "slack-word-game",
    name: "Slack Word Game",
    description:
      "A daily word puzzle bot for Slack that posts challenges, tracks team leaderboards, and keeps your workspace engaged between standups.",
    tags: ["Productivity", "Gaming", "Slack"],
  },
  {
    id: "scrum-standup",
    name: "SCRUM Standup Helper",
    description:
      "Automates async standups by collecting updates, flagging blockers, and generating sprint summaries for your team's daily sync.",
    tags: ["DevOps", "Productivity", "Automation"],
  },
];
