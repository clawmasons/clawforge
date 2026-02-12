export interface Program {
  id: string;
  name: string;
  description: string;
  tags: string[];
  status: "available" | "open";
  callToAction: string;
}

export const programs: Program[] = [
  // ── Original 4 programs ──────────────────────────────────────────────
  {
    id: "help-desk",
    name: "Company Help Desk App",
    description:
      "An AI-powered help desk that triages support tickets, suggests solutions from your knowledge base, and escalates to human agents when needed.",
    tags: ["Featured", "Customer Support", "AI", "Automation"],
    status: "available",
    callToAction: "Launch Now",
  },
  {
    id: "kerbal-plugin",
    name: "Kerbal Space Program Plugin",
    description:
      "A mission planning assistant that calculates delta-v budgets, suggests optimal transfer windows, and helps design efficient spacecraft.",
    tags: ["Gaming", "Simulation", "Space"],
    status: "available",
    callToAction: "Launch Now",
  },
  {
    id: "slack-word-game",
    name: "Slack Word Game",
    description:
      "A daily word puzzle bot for Slack that posts challenges, tracks team leaderboards, and keeps your workspace engaged between standups.",
    tags: ["Productivity", "Gaming", "Slack"],
    status: "available",
    callToAction: "Play Now",
  },
  {
    id: "scrum-standup",
    name: "SCRUM Standup Helper",
    description:
      "Automates async standups by collecting updates, flagging blockers, and generating sprint summaries for your team's daily sync.",
    tags: ["DevOps", "Productivity", "Automation"],
    status: "available",
    callToAction: "Launch Now",
  },

  // ── Open programs (courses & learning) ───────────────────────────────
  {
    id: "calculus-for-everyone",
    name: "Calculus for Everyone",
    description:
      "An interactive course that teaches calculus from limits to integrals with visual explanations, practice problems, and adaptive pacing.",
    tags: ["Open", "Math", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "rocket-science-101",
    name: "Rocket Science 101",
    description:
      "Learn orbital mechanics, propulsion systems, and mission design through hands-on simulations and guided lessons.",
    tags: ["Open", "Space", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "clawforge-development",
    name: "Clawforge Development",
    description:
      "A self-paced course for contributors who want to build programs on Clawforge — covers the SDK, deployment, and best practices.",
    tags: ["Open", "DevOps", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "intro-to-ml",
    name: "Intro to Machine Learning",
    description:
      "Covers supervised learning, neural networks, and model evaluation with interactive notebooks and real datasets.",
    tags: ["Featured", "Open", "AI", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "creative-writing-workshop",
    name: "Creative Writing Workshop",
    description:
      "A collaborative workshop where you craft short stories, poems, and essays with AI-guided feedback and peer review.",
    tags: ["Featured", "Open", "Writing", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "guitar-fundamentals",
    name: "Guitar Fundamentals",
    description:
      "Learn chords, scales, and fingerpicking patterns with an AI tutor that listens to your playing and offers real-time tips.",
    tags: ["Open", "Music", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "quantum-computing-intro",
    name: "Quantum Computing Intro",
    description:
      "Demystifies qubits, gates, and quantum algorithms through visual circuit builders and runnable code examples.",
    tags: ["Open", "Science", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "pixel-art-bootcamp",
    name: "Pixel Art Bootcamp",
    description:
      "Master sprite design, color theory, and animation for retro games in a hands-on, project-based course.",
    tags: ["Open", "Art", "Gaming"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "python-for-scientists",
    name: "Python for Scientists",
    description:
      "A fast-track course on NumPy, pandas, and matplotlib for researchers who need to analyze data and publish results.",
    tags: ["Open", "Science", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "personal-finance-101",
    name: "Personal Finance 101",
    description:
      "Covers budgeting, investing, debt management, and retirement planning with practical exercises and calculators.",
    tags: ["Open", "Finance", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "climate-science-fundamentals",
    name: "Climate Science Fundamentals",
    description:
      "Understand greenhouse gases, climate models, and mitigation strategies through interactive data explorations.",
    tags: ["Open", "Environment", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "intro-to-philosophy",
    name: "Intro to Philosophy",
    description:
      "Explore epistemology, ethics, and metaphysics through guided readings, Socratic dialogues, and thought experiments.",
    tags: ["Open", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "spanish-conversational",
    name: "Conversational Spanish",
    description:
      "Practice real-world Spanish through AI-powered dialogue, pronunciation feedback, and culture lessons.",
    tags: ["Open", "Language", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "first-aid-training",
    name: "First Aid Training",
    description:
      "Interactive scenarios that teach CPR, wound care, and emergency response with step-by-step visual guides.",
    tags: ["Open", "Health", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "organic-chemistry",
    name: "Organic Chemistry",
    description:
      "Tackle reaction mechanisms, stereochemistry, and synthesis planning with 3D molecule viewers and practice sets.",
    tags: ["Open", "Science", "Education"],
    status: "open",
    callToAction: "Join",
  },
  {
    id: "game-design-theory",
    name: "Game Design Theory",
    description:
      "Study mechanics, player psychology, and level design principles through case studies of classic and modern games.",
    tags: ["Featured", "Open", "Gaming", "Education"],
    status: "open",
    callToAction: "Join",
  },

  // ── Available programs ───────────────────────────────────────────────
  {
    id: "game-jam-starter",
    name: "Game Jam Starter Kit",
    description:
      "Scaffolds a complete game project with physics, input handling, and asset pipelines — ready for your next game jam.",
    tags: ["Gaming", "Automation"],
    status: "available",
    callToAction: "Build",
  },
  {
    id: "ai-song-composer",
    name: "AI Song Composer",
    description:
      "Generate melodies, harmonies, and arrangements from text prompts, then export to MIDI or sheet music.",
    tags: ["Music", "AI"],
    status: "available",
    callToAction: "Compose",
  },
  {
    id: "brand-identity-gen",
    name: "Brand Identity Generator",
    description:
      "Creates logo concepts, color palettes, and typography pairings from a brief description of your brand.",
    tags: ["Art", "AI", "Design"],
    status: "available",
    callToAction: "Design",
  },
  {
    id: "ml-model-trainer",
    name: "ML Model Trainer",
    description:
      "Upload a dataset, pick an algorithm, and train a model with automatic hyperparameter tuning and evaluation metrics.",
    tags: ["AI", "Science"],
    status: "available",
    callToAction: "Train",
  },
  {
    id: "data-dashboard",
    name: "Data Dashboard Builder",
    description:
      "Connect to any data source and build interactive dashboards with drag-and-drop charts, filters, and live refresh.",
    tags: ["Analytics", "Automation"],
    status: "available",
    callToAction: "Analyze",
  },
  {
    id: "screenplay-writer",
    name: "Screenplay Writer",
    description:
      "Co-write screenplays with an AI that understands three-act structure, character arcs, and industry formatting.",
    tags: ["Writing", "AI"],
    status: "available",
    callToAction: "Write",
  },
  {
    id: "robot-sim",
    name: "Robot Simulator",
    description:
      "Design, program, and test virtual robots in a physics-accurate 3D environment before deploying to hardware.",
    tags: ["Robotics", "Simulation"],
    status: "available",
    callToAction: "Simulate",
  },
  {
    id: "ai-art-studio",
    name: "AI Art Studio",
    description:
      "Generate, refine, and remix digital art with style transfer, inpainting, and collaborative canvas tools.",
    tags: ["Featured", "Art", "AI"],
    status: "available",
    callToAction: "Create",
  },
  {
    id: "puzzle-generator",
    name: "Puzzle Generator",
    description:
      "Creates unique logic puzzles, crosswords, and Sudoku variants with adjustable difficulty for any skill level.",
    tags: ["Gaming", "Education"],
    status: "available",
    callToAction: "Solve",
  },
  {
    id: "code-debugger",
    name: "Code Debugger",
    description:
      "Paste a stack trace or error log and get step-by-step root cause analysis with suggested fixes.",
    tags: ["DevOps", "AI"],
    status: "available",
    callToAction: "Debug",
  },
  {
    id: "weather-forecaster",
    name: "Weather Forecaster",
    description:
      "Visualizes real-time weather data, generates hyperlocal forecasts, and sends customizable alerts.",
    tags: ["Science", "Analytics"],
    status: "available",
    callToAction: "Forecast",
  },
  {
    id: "genome-explorer",
    name: "Genome Explorer",
    description:
      "Browse, annotate, and compare genomic sequences with built-in alignment tools and variant calling.",
    tags: ["Science", "Health"],
    status: "available",
    callToAction: "Explore",
  },
  {
    id: "stock-analyzer",
    name: "Stock Analyzer",
    description:
      "Combines technical indicators, fundamental data, and sentiment analysis to surface trading opportunities.",
    tags: ["Finance", "Analytics"],
    status: "available",
    callToAction: "Analyze",
  },
  {
    id: "site-builder",
    name: "Website Builder",
    description:
      "Describe your website in plain English and get a production-ready site with responsive design and SEO baked in.",
    tags: ["Design", "Automation"],
    status: "available",
    callToAction: "Build",
  },
  {
    id: "kids-tutor",
    name: "Kids Tutor",
    description:
      "An adaptive learning companion that teaches reading, math, and science to kids ages 5–12 with games and rewards.",
    tags: ["Education", "AI"],
    status: "available",
    callToAction: "Teach",
  },
  {
    id: "poetry-forge",
    name: "Poetry Forge",
    description:
      "Co-create poems with an AI that knows meter, rhyme schemes, and dozens of poetic forms from haiku to villanelle.",
    tags: ["Writing", "AI"],
    status: "available",
    callToAction: "Write",
  },
  {
    id: "space-mission-planner",
    name: "Space Mission Planner",
    description:
      "Plan interplanetary trajectories, calculate fuel requirements, and visualize orbital maneuvers in 3D.",
    tags: ["Featured", "Space", "Simulation"],
    status: "available",
    callToAction: "Plan",
  },
  {
    id: "chess-engine",
    name: "Chess Engine",
    description:
      "Play against an adjustable-strength AI, analyze games with engine evaluations, and drill openings and endgames.",
    tags: ["Featured", "Gaming", "AI"],
    status: "available",
    callToAction: "Play",
  },
  {
    id: "homebrew-assistant",
    name: "Homebrew Assistant",
    description:
      "Design beer recipes, calculate IBU and ABV, schedule brew days, and log tasting notes for every batch.",
    tags: ["Food", "Automation"],
    status: "available",
    callToAction: "Brew",
  },
  {
    id: "startup-launcher",
    name: "Startup Launcher",
    description:
      "Generates business plans, financial models, pitch decks, and competitive analyses from your startup idea.",
    tags: ["Featured", "Finance", "AI"],
    status: "available",
    callToAction: "Launch",
  },
  {
    id: "market-predictor",
    name: "Market Predictor",
    description:
      "Runs Monte Carlo simulations and regression models on financial data to forecast market trends.",
    tags: ["Finance", "Analytics"],
    status: "available",
    callToAction: "Predict",
  },
  {
    id: "meal-planner",
    name: "Meal Planner",
    description:
      "Generates weekly meal plans based on dietary preferences, generates shopping lists, and suggests recipes.",
    tags: ["Food", "Health"],
    status: "available",
    callToAction: "Plan",
  },
  {
    id: "garden-planner",
    name: "Garden Planner",
    description:
      "Maps your plot, suggests companion plantings, schedules watering, and tracks harvest yields over seasons.",
    tags: ["Environment", "Automation"],
    status: "available",
    callToAction: "Grow",
  },
  {
    id: "task-automator",
    name: "Task Automator",
    description:
      "Build no-code automation workflows that connect your apps, trigger on events, and handle error retries.",
    tags: ["Automation", "Productivity"],
    status: "available",
    callToAction: "Automate",
  },
  {
    id: "language-partner",
    name: "Language Partner",
    description:
      "Practice conversation in 30+ languages with an AI that adapts to your level and corrects grammar in real time.",
    tags: ["Featured", "Language", "AI"],
    status: "available",
    callToAction: "Practice",
  },
  {
    id: "budget-tracker",
    name: "Budget Tracker",
    description:
      "Categorizes transactions, visualizes spending trends, and sends alerts when you approach budget limits.",
    tags: ["Finance", "Productivity"],
    status: "available",
    callToAction: "Track",
  },
  {
    id: "fantasy-football-ai",
    name: "Fantasy Football AI",
    description:
      "Analyzes player stats, injury reports, and matchup data to recommend optimal lineups and waiver wire picks.",
    tags: ["Gaming", "Analytics"],
    status: "available",
    callToAction: "Dominate",
  },
  {
    id: "polymarket-tracker",
    name: "Polymarket Tracker",
    description:
      "Monitors prediction market odds, surfaces arbitrage opportunities, and tracks your portfolio performance.",
    tags: ["Finance", "Analytics"],
    status: "available",
    callToAction: "Trade",
  },
  {
    id: "bug-hunter",
    name: "Bug Hunter",
    description:
      "Scans codebases for common vulnerabilities, race conditions, and memory leaks, then suggests targeted fixes.",
    tags: ["DevOps", "AI"],
    status: "available",
    callToAction: "Scan",
  },
  {
    id: "product-builder",
    name: "Product Builder",
    description:
      "Turns product specs into wireframes, user flows, and a clickable prototype in minutes.",
    tags: ["Design", "Automation"],
    status: "available",
    callToAction: "Build",
  },
  {
    id: "app-monitor",
    name: "App Monitor",
    description:
      "Tracks uptime, response times, and error rates across your services with smart alerting and runbook links.",
    tags: ["DevOps", "Automation"],
    status: "available",
    callToAction: "Monitor",
  },
  {
    id: "disease-research-ai",
    name: "Disease Research AI",
    description:
      "Aggregates medical literature, identifies drug interaction patterns, and suggests research hypotheses.",
    tags: ["Health", "AI", "Science"],
    status: "available",
    callToAction: "Research",
  },
  {
    id: "education-platform",
    name: "Education Platform Builder",
    description:
      "Create and deploy a complete online learning platform with courses, quizzes, certificates, and analytics.",
    tags: ["Education", "Automation"],
    status: "available",
    callToAction: "Build",
  },
  {
    id: "science-accelerator",
    name: "Science Accelerator",
    description:
      "Automates literature reviews, extracts data from papers, and generates meta-analysis summaries.",
    tags: ["Science", "AI"],
    status: "available",
    callToAction: "Accelerate",
  },
  {
    id: "carbon-tracker",
    name: "Carbon Footprint Tracker",
    description:
      "Estimates your personal or organizational carbon footprint and suggests actionable reduction strategies.",
    tags: ["Environment", "Analytics"],
    status: "available",
    callToAction: "Track",
  },
  {
    id: "video-editor",
    name: "AI Video Editor",
    description:
      "Automatically cuts, color-grades, and captions your raw footage into polished videos ready to publish.",
    tags: ["Art", "AI"],
    status: "available",
    callToAction: "Edit",
  },
  {
    id: "character-animator",
    name: "Character Animator",
    description:
      "Rig and animate 2D or 3D characters with motion capture, procedural animation, and keyframe editing.",
    tags: ["Art", "Simulation"],
    status: "available",
    callToAction: "Animate",
  },
  {
    id: "3d-print-slicer",
    name: "3D Print Slicer",
    description:
      "Optimizes STL models for printing with automatic support generation, infill tuning, and cost estimation.",
    tags: ["Design", "Automation"],
    status: "available",
    callToAction: "Slice",
  },
  {
    id: "drone-flight-planner",
    name: "Drone Flight Planner",
    description:
      "Plans autonomous flight paths, avoids no-fly zones, and processes aerial imagery for mapping and inspection.",
    tags: ["Robotics", "Simulation"],
    status: "available",
    callToAction: "Fly",
  },
  {
    id: "cocktail-mixer",
    name: "Cocktail Mixer",
    description:
      "Suggests cocktail recipes based on your bar inventory, generates shopping lists, and teaches mixing techniques.",
    tags: ["Featured", "Food", "AI"],
    status: "available",
    callToAction: "Mix",
  },
  {
    id: "ctf-trainer",
    name: "CTF Trainer",
    description:
      "Practice capture-the-flag challenges across web, crypto, forensics, and binary exploitation categories.",
    tags: ["Featured", "Security", "Education"],
    status: "available",
    callToAction: "Hack",
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description:
      "Analyzes pull requests for bugs, style violations, and performance issues, then posts inline suggestions.",
    tags: ["DevOps", "AI"],
    status: "available",
    callToAction: "Review",
  },
  {
    id: "paper-publisher",
    name: "Paper Publisher",
    description:
      "Formats manuscripts for journal submission, manages citations, and generates LaTeX or Word output.",
    tags: ["Science", "Writing"],
    status: "available",
    callToAction: "Publish",
  },
  {
    id: "stream-overlay",
    name: "Stream Overlay Studio",
    description:
      "Design custom stream overlays, alerts, and widgets with drag-and-drop tools and real-time preview.",
    tags: ["Gaming", "Design"],
    status: "available",
    callToAction: "Stream",
  },
  {
    id: "novel-writer",
    name: "Novel Writer",
    description:
      "Outline plots, develop characters, and draft chapters with an AI co-author that maintains narrative consistency.",
    tags: ["Writing", "AI"],
    status: "available",
    callToAction: "Write",
  },
  {
    id: "podcast-producer",
    name: "Podcast Producer",
    description:
      "Records, edits, and publishes podcast episodes with automatic transcription, show notes, and chapter markers.",
    tags: ["Music", "Automation"],
    status: "available",
    callToAction: "Produce",
  },
  {
    id: "book-translator",
    name: "Book Translator",
    description:
      "Translates entire books while preserving tone, cultural nuance, and formatting across 50+ language pairs.",
    tags: ["Language", "AI"],
    status: "available",
    callToAction: "Translate",
  },
  {
    id: "event-organizer",
    name: "Event Organizer",
    description:
      "Manages RSVPs, schedules speakers, coordinates vendors, and sends automated reminders for your events.",
    tags: ["Productivity", "Automation"],
    status: "available",
    callToAction: "Organize",
  },
  {
    id: "campaign-manager",
    name: "Campaign Manager",
    description:
      "Plan and execute marketing campaigns with audience segmentation, A/B testing, and ROI tracking.",
    tags: ["Analytics", "Automation"],
    status: "available",
    callToAction: "Run",
  },
  {
    id: "physics-sim",
    name: "Physics Simulator",
    description:
      "Visualize and experiment with mechanics, thermodynamics, and electromagnetism in an interactive sandbox.",
    tags: ["Science", "Simulation"],
    status: "available",
    callToAction: "Simulate",
  },
  {
    id: "cipher-cracker",
    name: "Cipher Cracker",
    description:
      "Decodes substitution ciphers, Vigenère, Enigma simulations, and modern encryption puzzles step by step.",
    tags: ["Security", "Education"],
    status: "available",
    callToAction: "Crack",
  },
  {
    id: "scene-renderer",
    name: "Scene Renderer",
    description:
      "Renders photorealistic 3D scenes with ray tracing, global illumination, and material authoring tools.",
    tags: ["Art", "Simulation"],
    status: "available",
    callToAction: "Render",
  },
  {
    id: "quilt-designer",
    name: "Quilt Designer",
    description:
      "Design quilt patterns with block libraries, fabric previews, and yardage calculators for every project.",
    tags: ["Art", "Design"],
    status: "available",
    callToAction: "Design",
  },
  {
    id: "star-catalog",
    name: "Star Catalog",
    description:
      "Browse deep-sky objects, plan observation sessions, and log what you see through your telescope.",
    tags: ["Space", "Science"],
    status: "available",
    callToAction: "Explore",
  },
  {
    id: "dna-sequencer",
    name: "DNA Sequencer",
    description:
      "Process raw sequencing reads, align them to reference genomes, and call variants with publication-ready reports.",
    tags: ["Science", "Health"],
    status: "available",
    callToAction: "Sequence",
  },
  {
    id: "playlist-curator",
    name: "Playlist Curator",
    description:
      "Generates themed playlists by analyzing mood, tempo, and genre from your listening history and preferences.",
    tags: ["Music", "AI"],
    status: "available",
    callToAction: "Curate",
  },
  {
    id: "film-scorer",
    name: "Film Scorer",
    description:
      "Compose original soundtracks synchronized to your video timeline with customizable mood and instrumentation.",
    tags: ["Music", "AI"],
    status: "available",
    callToAction: "Score",
  },
  {
    id: "trivia-host",
    name: "Trivia Host",
    description:
      "Run live or async trivia games with customizable categories, scoring rules, and team support.",
    tags: ["Gaming", "Productivity"],
    status: "available",
    callToAction: "Host",
  },
  {
    id: "mystery-solver",
    name: "Mystery Solver",
    description:
      "Play interactive detective stories where you gather clues, interrogate suspects, and piece together the truth.",
    tags: ["Gaming", "Writing"],
    status: "available",
    callToAction: "Solve",
  },
  {
    id: "wildlife-tracker",
    name: "Wildlife Tracker",
    description:
      "Log animal sightings, track migration patterns, and contribute observations to citizen science databases.",
    tags: ["Environment", "Science"],
    status: "available",
    callToAction: "Track",
  },
  {
    id: "mushroom-identifier",
    name: "Mushroom Identifier",
    description:
      "Upload a photo and get species identification, edibility info, and look-alike warnings backed by expert data.",
    tags: ["Environment", "Science"],
    status: "available",
    callToAction: "Identify",
  },
  {
    id: "bonsai-grower",
    name: "Bonsai Grower",
    description:
      "Track your bonsai collection with species-specific care schedules, pruning reminders, and growth journals.",
    tags: ["Environment", "Productivity"],
    status: "available",
    callToAction: "Grow",
  },
  {
    id: "kombucha-brewer",
    name: "Kombucha Brewer",
    description:
      "Manage SCOBY health, track fermentation timelines, and experiment with flavor combinations for every batch.",
    tags: ["Food", "Health"],
    status: "available",
    callToAction: "Brew",
  },
  {
    id: "bbq-pitmaster",
    name: "BBQ Pitmaster",
    description:
      "Monitor smoker temperature, calculate cook times by cut weight, and log recipes with tasting notes.",
    tags: ["Food", "Automation"],
    status: "available",
    callToAction: "Smoke",
  },
  {
    id: "satellite-launcher",
    name: "Satellite Launcher",
    description:
      "Simulate CubeSat deployments, estimate launch windows, and model power budgets for small satellite missions.",
    tags: ["Space", "Simulation"],
    status: "available",
    callToAction: "Launch",
  },
  {
    id: "robot-programmer",
    name: "Robot Programmer",
    description:
      "Write and test robot control code in a visual block-based editor with instant simulation feedback.",
    tags: ["Robotics", "Education"],
    status: "available",
    callToAction: "Program",
  },
  {
    id: "circuit-designer",
    name: "Circuit Designer",
    description:
      "Design, simulate, and export PCB layouts with component libraries and automatic design-rule checks.",
    tags: ["Robotics", "Design"],
    status: "available",
    callToAction: "Wire",
  },
  {
    id: "weather-modeler",
    name: "Weather Modeler",
    description:
      "Run simplified atmospheric models, visualize pressure systems, and compare predictions against real observations.",
    tags: ["Science", "Simulation"],
    status: "available",
    callToAction: "Model",
  },
  {
    id: "reef-mapper",
    name: "Reef Mapper",
    description:
      "Process underwater imagery to map coral coverage, detect bleaching, and generate conservation reports.",
    tags: ["Environment", "Science"],
    status: "available",
    callToAction: "Map",
  },
  {
    id: "forest-monitor",
    name: "Forest Monitor",
    description:
      "Analyze satellite imagery to detect deforestation, track regrowth, and estimate carbon sequestration.",
    tags: ["Environment", "Analytics"],
    status: "available",
    callToAction: "Protect",
  },
  {
    id: "ocean-cleaner",
    name: "Ocean Cleanup Planner",
    description:
      "Model ocean current data to optimize cleanup operations and estimate plastic accumulation zones.",
    tags: ["Environment", "Science"],
    status: "available",
    callToAction: "Clean",
  },
  {
    id: "tree-planter",
    name: "Tree Planting Optimizer",
    description:
      "Selects native species, plans planting grids, and forecasts canopy coverage for reforestation projects.",
    tags: ["Environment", "Automation"],
    status: "available",
    callToAction: "Plant",
  },
  {
    id: "medicine-advisor",
    name: "Medicine Advisor",
    description:
      "Cross-references symptoms, medications, and lab results to support clinical decision-making for providers.",
    tags: ["Health", "AI"],
    status: "available",
    callToAction: "Consult",
  },
  {
    id: "api-scaler",
    name: "API Scaler",
    description:
      "Load-tests your API endpoints, identifies bottlenecks, and recommends caching and scaling strategies.",
    tags: ["DevOps", "Analytics"],
    status: "available",
    callToAction: "Scale",
  },
  {
    id: "query-optimizer",
    name: "Query Optimizer",
    description:
      "Analyzes slow SQL queries, suggests indexes, rewrites joins, and benchmarks improvements automatically.",
    tags: ["DevOps", "Analytics"],
    status: "available",
    callToAction: "Optimize",
  },
  {
    id: "cluster-deployer",
    name: "Cluster Deployer",
    description:
      "Provisions Kubernetes clusters, manages helm charts, and handles rolling deployments with one-click rollback.",
    tags: ["DevOps", "Automation"],
    status: "available",
    callToAction: "Deploy",
  },
  {
    id: "prompt-engineer",
    name: "Prompt Engineer",
    description:
      "Test, version, and optimize prompts across models with A/B comparisons and automated quality scoring.",
    tags: ["Featured", "AI", "Productivity"],
    status: "available",
    callToAction: "Engineer",
  },
  {
    id: "contract-auditor",
    name: "Smart Contract Auditor",
    description:
      "Scans Solidity contracts for reentrancy, overflow, and access-control vulnerabilities with fix suggestions.",
    tags: ["Security", "Finance"],
    status: "available",
    callToAction: "Audit",
  },
  {
    id: "feature-shipper",
    name: "Feature Shipper",
    description:
      "Turns feature specs into implementation plans, tracks progress, and coordinates code review and release.",
    tags: ["DevOps", "Productivity"],
    status: "available",
    callToAction: "Ship",
  },
  {
    id: "dance-choreographer",
    name: "Dance Choreographer",
    description:
      "Create and visualize dance routines with beat-synced move sequences and shareable notation.",
    tags: ["Art", "Music"],
    status: "available",
    callToAction: "Choreograph",
  },
  {
    id: "vacation-planner",
    name: "Vacation Planner",
    description:
      "Plans itineraries based on your interests, budget, and travel dates with booking links and local tips.",
    tags: ["Productivity", "AI"],
    status: "available",
    callToAction: "Plan",
  },
  {
    id: "recipe-creator",
    name: "Recipe Creator",
    description:
      "Generates original recipes from available ingredients, dietary restrictions, and cuisine preferences.",
    tags: ["Food", "AI"],
    status: "available",
    callToAction: "Cook",
  },
  {
    id: "fitness-coach",
    name: "Fitness Coach",
    description:
      "Builds personalized workout plans, tracks progress, and adjusts intensity based on recovery and goals.",
    tags: ["Health", "AI"],
    status: "available",
    callToAction: "Train",
  },
  {
    id: "meditation-guide",
    name: "Meditation Guide",
    description:
      "Guided meditation sessions with breathing exercises, body scans, and mindfulness techniques for all levels.",
    tags: ["Health", "Education"],
    status: "available",
    callToAction: "Breathe",
  },
  {
    id: "resume-builder",
    name: "Resume Builder",
    description:
      "Crafts ATS-optimized resumes from your experience, tailored to specific job descriptions and industries.",
    tags: ["Productivity", "AI"],
    status: "available",
    callToAction: "Build",
  },
  {
    id: "legal-doc-drafter",
    name: "Legal Document Drafter",
    description:
      "Generates contracts, NDAs, and terms of service from plain-language descriptions with clause libraries.",
    tags: ["Productivity", "AI"],
    status: "available",
    callToAction: "Draft",
  },
  {
    id: "music-producer",
    name: "Music Producer",
    description:
      "Mix and master tracks with AI-assisted EQ, compression, and spatial audio processing tools.",
    tags: ["Music", "AI"],
    status: "available",
    callToAction: "Produce",
  },
  {
    id: "accessibility-checker",
    name: "Accessibility Checker",
    description:
      "Scans web pages for WCAG violations, suggests fixes, and generates compliance reports with screenshots.",
    tags: ["Design", "DevOps"],
    status: "available",
    callToAction: "Check",
  },
  {
    id: "email-copilot",
    name: "Email Copilot",
    description:
      "Drafts, summarizes, and prioritizes emails with tone adjustment and follow-up scheduling.",
    tags: ["Productivity", "AI"],
    status: "available",
    callToAction: "Draft",
  },
  {
    id: "presentation-maker",
    name: "Presentation Maker",
    description:
      "Turns outlines into polished slide decks with AI-generated visuals, speaker notes, and animations.",
    tags: ["Productivity", "Design"],
    status: "available",
    callToAction: "Present",
  },
  {
    id: "habit-tracker",
    name: "Habit Tracker",
    description:
      "Build and maintain daily habits with streaks, reminders, accountability partners, and progress analytics.",
    tags: ["Health", "Productivity"],
    status: "available",
    callToAction: "Track",
  },
  {
    id: "astronomy-planner",
    name: "Astronomy Planner",
    description:
      "Plans stargazing sessions with sky maps, planet visibility, ISS passes, and weather-aware scheduling.",
    tags: ["Space", "Science"],
    status: "available",
    callToAction: "Observe",
  },
  {
    id: "mural-painter",
    name: "Mural Painter",
    description:
      "Projects digital designs onto walls, scales artwork to any surface, and generates supply lists for large-scale murals.",
    tags: ["Art", "Design"],
    status: "available",
    callToAction: "Paint",
  },
  {
    id: "pottery-designer",
    name: "Pottery Designer",
    description:
      "Design pottery forms in 3D, simulate glaze effects, and generate kiln firing schedules for your pieces.",
    tags: ["Art", "Simulation"],
    status: "available",
    callToAction: "Design",
  },
  {
    id: "bookbinder",
    name: "Bookbinder",
    description:
      "Plan binding projects with signature calculators, spine width estimators, and step-by-step technique guides.",
    tags: ["Art", "Education"],
    status: "available",
    callToAction: "Bind",
  },
  {
    id: "glass-blower",
    name: "Glass Blower Sim",
    description:
      "Simulate glass-blowing techniques, experiment with colors and shapes, and learn from master artisan tutorials.",
    tags: ["Art", "Simulation"],
    status: "available",
    callToAction: "Blow",
  },
  {
    id: "sailing-nav",
    name: "Sailing Navigator",
    description:
      "Plot sailing routes with wind, current, and tide data, plus collision avoidance and harbor approach planning.",
    tags: ["Simulation", "Science"],
    status: "available",
    callToAction: "Navigate",
  },
  {
    id: "mountain-planner",
    name: "Mountain Climb Planner",
    description:
      "Plan expeditions with route difficulty ratings, gear checklists, weather windows, and acclimatization schedules.",
    tags: ["Health", "Productivity"],
    status: "available",
    callToAction: "Climb",
  },
];
