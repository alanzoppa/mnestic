#!/usr/bin/env python3
"""Auto-tag notes with content-specific tags based on keyword/title/folder patterns.

Adds content-specific tags to notes that currently only have structural tags.
Preserves all existing tags. Uses --dry-run by default.

Usage:
    python auto_tag.py              # Dry run (preview only)
    python auto_tag.py --write      # Write changes to files
"""
from __future__ import annotations
import re
import sys
from pathlib import Path
from collections import Counter
import frontmatter

NOTES_DIR = Path(__file__).resolve().parent.parent / "notes"

STRUCTURAL_TAGS = frozenset({
    'evernote', 'personal', 'work', 'notes', 'journal', 'stories',
    'alanzoppas-notebook', 'zendesk', 'enova', 'werk', 'reference',
    'skitch', 'handwritten', 'image-only', 'contentless',
    'interview-notes', 'chinese', 'hindi', '1:1', 'one-on-one',
    'family', 'household', 'personal-receipts', 'aperture',
    'raven', 'zeig', 'artificial-memory',
})

AI_CAPTION_RE = re.compile(r'\[AI caption\].*?(?=\n\n|\Z)', re.DOTALL)


def _strip_ai_captions(text: str) -> str:
    return AI_CAPTION_RE.sub('', text)


def tag_rules() -> list[tuple[str, list[str], list[str]]]:
    """Return (tag_name, body_keywords, title_patterns).
    
    Body keywords: matched case-insensitively as whole phrases (multi-word)
    or whole words (single word) in the body text (after AI captions stripped).
    Title patterns: regex matched case-insensitively against note title only.
    """
    return [
        # === Hiring / Interviews ===
        ("hiring",
         ["interview candidate", "hiring rubric", "hiring bar", "hiring panel",
          "offer letter", "candidate review", "headcount", "open position",
          "job posting", "technical screen", "reference check",
          "compensation band", "salary band", "new hire", "staffing plan",
          "requisition", "hire for", "hiring plan", "hiring manager",
          "interview debrief", "candidate score", "interview plan"],
         [r"hiring", r"hire\s", r"headcount", r"open.position",
          r"staff.(plan|org)", r"interview\s*(plan|debrief|schedule)"]),

        ("behavioral-interview",
         ["difficult person", "behavioral interview", "culture fit",
          "values interview", "leadership principles", "star method",
          "behavioral question", "soft skill interview"],
         [r"behavioral", r"culture.fit", r"difficult.person"]),

        ("technical-interview",
         ["coding interview", "technical screen", "technical interview",
          "whiteboard interview", "live coding", "take-home exercise",
          "pair programming interview", "system design interview",
          "code challenge", "code interview"],
         [r"technical.interview", r"coding.interview"]),

        ("hiring-panel",
         ["interview panel", "debrief", "hiring committee", "scorecard",
          "candidate debrief"],
         [r"debrief", r"interview.panel", r"hiring.panel", r"scorecard"]),

        ("hiring-rubric",
         ["rubric", "scoring criteria", "evaluation criteria",
          "candidate evaluation", "interview score"],
         [r"rubric", r"evaluation.criteria"]),

        # === Management / People ===
        ("management",
         ["direct report", "skip level", "people management",
          "engineering manager", "team lead", "org chart",
          "performance improvement", "pip ", "growth plan",
          "development plan", "manage up", "managing engineers",
          "managing a team"],
         [r"management", r"team.lead", r"people.manager"]),

        ("mentoring",
         ["mentoring", "mentee", "sponsor", "growth opportunity",
          "stretch assignment", "shadowing", "career development"],
         [r"\bmentor"]),

        ("promotion",
         ["promotion", "career ladder", "level up", "staff engineer",
          "senior engineer", "compensation change", "promotion case",
          "promotion packet"],
         [r"promotion", r"career.ladder"]),

        ("performance-review",
         ["performance review", "year end review", "mid-year review",
          "annual review", "self-review", "self assessment",
          "peer review", "360 review", "360 feedback",
          "performance evaluation", "calibration session",
          "calibration meeting"],
         [r"performance.review", r"year.end.review", r"calibration",
          r"annual.review", r"mid.year", r"self.review"]),

        ("feedback",
         ["constructive feedback", "radical candor", "giving feedback",
          "receiving feedback", "feedback conversation"],
         [r"radical.candor", r"feedback.conversation"]),

        ("delegation",
         ["delegate", "delegation", "autonomy and ownership"],
         [r"delegat"]),

        # === Technical / Engineering ===
        ("frontend",
         ["frontend", "front-end", "front end framework",
          "javascript framework", "ember.js", "ember cli", "ember data",
          "react component", "react hook", "redux store", "redux action",
          "vue component", "angular component", "css layout",
          "webpack config", "babel config", "typescript migration",
          "single-page app", "spa ", "ui component", "widget framework",
          "handlebars template", "glimmer component",
          "server-side rendering", "ssr "],
         [r"\bfrontend\b", r"\bember\b", r"\breact\b", r"\bredux\b",
          r"\bvue\b", r"\bangular\b", r"\btypescript\b"]),

        ("backend",
         ["backend", "back-end", "server-side", "rails app",
          "ruby on rails", "database schema", "postgresql", "mysql",
          "redis cache", "memcached", "rest api endpoint",
          "microservice architecture"],
         [r"\bbackend\b", r"\bback.end\b", r"rails", r"\bruby\b"]),

        ("api",
         ["api endpoint", "rest api", "graphql", "webhook",
          "api design", "api versioning", "swagger", "openapi spec",
          "json api", "api request"],
         [r"\bapi\b"]),

        ("architecture",
         ["architecture review", "architecture decision",
          "system design", "monolith to", "microservice",
          "service-oriented architecture", "distributed system",
          "architecture document", "tech stack"],
         [r"architecture", r"system.design"]),

        ("system-design",
         ["system design interview", "load balancing", "caching strategy",
          "database sharding", "replication strategy", "consensus algorithm",
          "cap theorem", "high availability", "fault tolerance",
          "distributed consensus", "consistent hashing"],
         [r"system.design"]),

        ("testing",
         ["unit test", "integration test", "e2e test", "end-to-end test",
          "test suite", "test coverage", "tdd ", "bdd ",
          "cypress test", "selenium test", "jest test", "rspec",
          "automated testing", "regression test", "qa automation"],
         [r"\btesting\b", r"\btest.suite\b", r"\bcypress\b",
          r"\bselenium\b", r"\bjest\b", r"\brspec\b"]),

        ("devops",
         ["devops", "infrastructure as code", "kubernetes cluster",
          "docker container", "terraform module", "ansible playbook",
          "monitoring system", "alerting system", "incident management",
          "sre team", "site reliability", "build pipeline",
          "release management", "rolling deploy", "blue-green deploy",
          "canary deploy"],
         [r"\bdevops\b", r"\bkubernetes\b", r"\bdocker\b",
          r"\bterraform\b", r"\bansible\b"]),

        ("ci-cd",
         ["ci/cd pipeline", "continuous integration", "continuous deployment",
          "github actions", "circleci", "jenkins pipeline",
          "build pipeline"],
         [r"\bci.cd\b", r"continuous.integr", r"continuous.deploy"]),

        ("ops",
         ["on-call rotation", "incident response", "production issue",
          "production outage", "service level objective", "slo ",
          "service level indicator", "sli ", "pagerduty",
          "escalation policy"],
         [r"\bops\b", r"on.call", r"\boutage\b", r"incident.response"]),

        ("migration",
         ["migration plan", "migrate to", "migration from",
          "database migration", "framework migration", "platform migration",
          "ember migration", "react migration", "tech stack migration"],
         [r"\bmigrat"]),

        ("tech-debt",
         ["tech debt", "technical debt", "refactoring plan",
          "code cleanup", "code health", "backlog cleanup",
          "tech-debt"],
         [r"tech.debt", r"technical.debt", r"\brefactor"]),

        ("engineering",
         ["engineering team", "engineering culture", "engineering org",
          "engineering practice", "software engineering"],
         [r"engineering.(team|culture|org|practice)"]),

        # === Zendesk-specific ===
        ("zendesk",
         ["zendesk app", "zaf framework", "zdt framework",
          "agent workspace", "admin workspace", "help center",
          "zendesk talk", "zendesk sell", "zendesk guide",
          "zendesk chat", "zendesk explore",
          "lotus team", "scooter framework", "polaris design",
          "moltres project", "hammr project"],
         [r"\bzendesk\b", r"\bzaf\b", r"\bzdt\b",
          r"agent.workspace", r"help.center", r"\bpolaris\b"]),

        ("support-apps",
         ["support app", "zaf app", "apps marketplace", "sidebar app",
          "zendesk app framework"],
         [r"support.app", r"zaf.app"]),

        ("agent-workspace",
         ["agent workspace", "admin workspace", "ticket interface",
          "agent experience"],
         [r"agent.workspace", r"admin.workspace"]),

        ("chat",
         ["live chat", "chat widget", "web messaging",
          "omnichannel", "channel-switching"],
         [r"omnichannel", r"channel.switch", r"chat.widget"]),

        ("upload",
         ["file upload", "image upload", "media upload",
          "brain upload", "mind upload", "consciousness upload"],
         [r"upload"]),

        # === Enova-specific ===
        ("enova",
         ["enova international", "cnu ", "loanstar", "loan party",
          "cnuapp", "collections department"],
         [r"\benova\b", r"\bcnu\b", r"loanstar"]),

        # === Product / Planning ===
        ("project-planning",
         ["project plan", "quarterly plan", "quarterly planning",
          "initiative plan", "okr planning", "objective and key result",
          "key result", "planning meeting", "planning session"],
         [r"project.plan", r"quarterly.plan", r"\bokr\b",
          r"key.result"]),

        ("roadmap",
         ["product roadmap", "engineering roadmap", "quarterly roadmap",
          "roadmap item", "roadmap planning"],
         [r"\broadmap\b"]),

        ("product",
         ["product manager", "product management", "product roadmap",
          "product vision", "product discovery", "product discovery",
          "product validation", "mvp scope"],
         [r"product.manager", r"product.management",
          r"product.validation", r"product.discovery"]),

        ("presentation",
         ["slide deck", "keynote presentation", "tech talk",
          "conference talk", "lightning talk", "demo day",
          "presentation prep"],
         [r"tech.talk", r"lightning.talk", r"demo.day",
          r"slide.deck"]),

        ("tech-talk",
         ["tech talk", "brown bag", "knowledge sharing session",
          "tech share"],
         [r"tech.talk", r"brown.bag", r"knowledge.shar"]),

        ("todo",
         ["action item", "action items", "to-do list",
          "follow-up item", "checklist for", "task list"],
         [r"\btodo\b", r"to.do.list", r"action.item"]),

        ("meeting-notes",
         ["standup notes", "retro notes", "retrospective notes",
          "weekly sync", "team meeting notes", "all-hands notes",
          "meeting summary", "meeting recap"],
         [r"meeting.(note|summary|recap)", r"standup.note",
          r"retro.spec", r"retrospective"]),

        ("sprint",
         ["sprint planning", "sprint review", "sprint goal",
          "sprint backlog", "velocity report", "story point",
          "scrum team", "kanban board"],
         [r"\bsprint\b", r"\bscrum\b", r"\bkanban\b",
          r"story.point"]),

        # === Creative / Writing ===
        ("creative",
         ["creative writing", "writing prompt", "story concept",
          "fiction idea", "story premise"],
         [r"creative.writing", r"writing.prompt"]),

        ("fiction",
         ["fiction piece", "fiction story", "short fiction",
          "flash fiction", "science fiction", "speculative fiction"],
         [r"science.fiction", r"speculative.fiction",
          r"flash.fiction"]),

        ("worldbuilding",
         ["worldbuild", "world-building", "magic system",
          "tech level", "civilization building", "society rules",
          "alien civilization", "future history"],
         [r"world.build", r"\bworldbuild"]),

        ("story-idea",
         ["story idea", "story premise", "story concept",
          "plot idea", "narrative concept", "what if "],
         [r"story.idea", r"story.premise"]),

        ("writing",
         ["writing session", "writing process", "draft revision",
          "writer's block", "prose style", "narrative structure"],
         [r"writing.(session|process|style)"]),

        ("book-notes",
         ["book notes", "book review", "reading notes",
          "key takeaway from book", "chapter summary"],
         [r"book.note", r"book.review", r"reading.note"]),

        # === Personal / Reflective ===
        ("self-reflection",
         ["self-reflection", "introspection", "personal reflection",
          "self-awareness", "i've been thinking about",
          "i've been reflecting", "personal growth journey"],
         [r"self.reflect", r"introspect"]),

        ("mental-health",
         ["mental health", "depression", "anxiety disorder",
          "therapy session", "burnout", "emotional wellbeing",
          "psychological", "mindfulness practice", "meditation practice"],
         [r"mental.health", r"\bdepress", r"\banxiety\b", r"\btherap",
          r"\bburnout\b"]),

        ("identity",
         ["identity crisis", "self-concept", "who am i",
          "gender identity", "sexual identity", "masculinity",
          "femininity", "sense of belonging"],
         [r"\bidentity\b", r"\bmasculinity\b", r"\bfemininity\b"]),

        ("relationship",
         ["personal relationship", "romantic relationship",
          "marriage", "divorce", "breakup",
          "long-distance relationship", "couples therapy",
          "relationship advice", "relationship problem"],
         [r"romantic.relationship", r"long.distance.relationship",
          r"couples.therapy", r"relationship.advice",
          r"\bmarriage\b", r"\bdivorce\b", r"\bbreakup\b"]),

        ("grief",
         ["grief", "mourning", "bereavement", "passed away",
          "funeral", "condolences"],
         [r"\bgrief\b", r"\bmourning\b", r"\bfuneral\b"]),

        ("childhood",
         ["childhood memory", "growing up", "when i was a kid",
          "as a child i", "childhood home"],
         [r"\bchildhood\b", r"growing.up"]),

        ("dreams",
         ["i dreamt", "in the dream", "dream about",
          "had a dream", "nightmare about", "lucid dream"],
         [r"lucid.dream", r"i.dreamt"]),

        ("family",
         ["family reunion", "family dinner", "family vacation",
          "family emergency", "family member"],
         [r"family.(reunion|dinner|vacation|emergency)"]),

        ("therapy",
         ["therapy session", "therapist appointment",
          "counseling session", "therapy practice"],
         [r"therapy.session", r"therapist.appointment"]),

        # === Horror / Sci-fi sub-genres ===
        ("zombies",
         ["zombie", "zombie apocalypse", "undead horde",
          "walking dead", "zombie virus"],
         [r"\bzombie"]),

        ("posthuman",
         ["posthuman", "transhuman", "technological singularity",
          "mind upload", "brain upload", "brain-computer",
          "consciousness transfer", "simulated reality",
          "simulation hypothesis", "ai takeover"],
         [r"posthuman", r"transhuman", r"singularit",
          r"mind.upload", r"brain.upload", r"simulated.real",
          r"simulation.hypothes"]),

        ("biohorror",
         ["biohorror", "body horror", "biological horror",
          "parasitic organism", "flesh mutation"],
         [r"biohorror", r"body.horror"]),

        # === Finance / Life Admin ===
        ("receipt",
         ["receipt for", "invoice number", "expense report",
          "purchase confirmation", "payment receipt"],
         [r"\breceipt\b", r"\binvoice\b"]),

        # === Language Learning ===
        ("language-learning",
         ["language learning", "language practice",
          "vocabulary list", "grammar lesson", "flashcard deck",
          "language study", "rosette stone"],
         [r"language.learn", r"vocabulary.list", r"flashcard.deck",
          r"language.practice"]),

        # === Misc Content Tags ===
        ("accessibility",
         ["accessibility audit", "a11y compliance", "wcag guideline",
          "aria attribute", "screen reader", "keyboard navigation",
          "accessible design"],
         [r"\baccessibility\b", r"\ba11y\b", r"\bwcag\b",
          r"\baria\b"]),

        ("transcription",
         ["transcription of", "transcribed from",
          "automated transcription", "speech to text",
          "voice transcription"],
         [r"transcription.of", r"transcribed.from"]),

        ("rosetta-stone",
         ["rosetta stone lesson", "rosetta stone course"],
         [r"rosetta.stone"]),

        ("documentation",
         ["readme file", "api documentation", "runbook",
          "how-to guide", "technical documentation"],
         [r"\breadme\b", r"\brunbook\b", r"api.documentation"]),
    ]


def get_existing_tags(filepath: Path) -> list[str]:
    raw = filepath.read_text(encoding="utf-8")
    lines = raw.split("\n")
    tags = []
    in_tags = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("tags:"):
            in_tags = True
            m = re.match(r'tags:\s*\[(.+)\]', stripped)
            if m:
                for t in m.group(1).split(","):
                    tag = t.strip().strip("'\"")
                    if tag:
                        tags.append(tag)
                in_tags = False
            continue
        if in_tags:
            if stripped.startswith("- "):
                tag = stripped[2:].strip().strip("'\"")
                if tag:
                    tags.append(tag)
            elif not stripped or not line.startswith(" "):
                in_tags = False
    return tags


def broad_content_rules(title: str, clean_body: str, folder: str, text: str) -> set[str]:
    """Second-pass rules using broader keywords for notes the first pass missed.
    
    These use single-word matches with folder context to reduce false positives.
    Only applied when a note has no content tags yet.
    """
    suggested = set()
    
    WORK_FOLDERS = {"Zendesk", "Enova", "Work", "1:1 Notes", "Interview Notes"}
    is_work = folder in WORK_FOLDERS or (folder == "Journal" and ("work" in text or "enova" in text or "zendesk" in text))
    
    if is_work:
        if re.search(r'\bember\b', text): suggested.add("ember")
        if re.search(r'\breact\b', text): suggested.add("react")
        if "ember" in suggested or "react" in suggested: suggested.add("frontend")
        if re.search(r'\bapi\b', text) and len(text) > 200: suggested.add("api")
        if re.search(r'\bdeploy\b', text): suggested.add("devops")
        if re.search(r'\btest', text) and re.search(r'(suite|coverage|unit|integration|e2e|automated|cypress|selenium|jest|rspec)', text): suggested.add("testing")
        if re.search(r'\bcustomer\b', text) and folder in {"Zendesk", "Work"}: suggested.add("zendesk")
        if re.search(r'\bsprint\b', text): suggested.add("sprint")
        if re.search(r'\bbug\b', text) and len(text) > 100: suggested.add("todo")
        if re.search(r'\bfeedback\b', text): suggested.add("feedback")
        if re.search(r'\b1:1\b', text) or re.search(r'\bone.on.one\b', text): suggested.add("meeting-notes")
        if re.search(r'\breview\b', text) and re.search(r'(performance|year.end|annual|mid.year)', text): suggested.add("performance-review")
        if re.search(r'\brefactor\b', text): suggested.add("tech-debt")
        if re.search(r'\bproduction\b', text) and re.search(r'(issue|incident|outage|emergency)', text): suggested.add("ops")
        if re.search(r'\bcomponent\b', text) and len(text) > 200: suggested.add("frontend")
        # Catch common work patterns that indicate meeting/1:1 context
        if re.search(r'mischief managed', text): suggested.add("zendesk")
        if re.search(r'\baperture\b', text) or re.search(r'\bcnu\b', text): suggested.add("enova")
        if re.search(r'\broadmap\b', text) or re.search(r'\bquarter\b', text): suggested.add("project-planning")
        if re.search(r'\broll out\b', text) or re.search(r'\brollout\b', text): suggested.add("devops")
        if re.search(r'\bon.board\b', text) or re.search(r'\bonboarding\b', text): suggested.add("hiring")
        # People + work context = likely 1:1 or interview
        if folder == "Journal" and (re.search(r'debugging|javascript|ruby|python|code|script|app|feature', text)):
            suggested.add("engineering")
    
    CREATIVE_FOLDERS = {"Stories", "Raven"}
    if folder in CREATIVE_FOLDERS:
        if re.search(r'\bstor', text) or re.search(r'\bcharacter\b', text): suggested.add("creative")
        if re.search(r'\bworld\b', text) and re.search(r'(build|creat|imagin|design)', text): suggested.add("worldbuilding")
        if re.search(r'\bcharacter\b', text): suggested.add("fiction")
        if re.search(r'\bai\b', text) or re.search(r'\brobot\b', text) or re.search(r'\bsimulat', text): suggested.add("posthuman")
        if re.search(r'\bzombie\b', text): suggested.add("zombies")
        if re.search(r'\bdream', text) and re.search(r'(nightmare|lucid|sleep)', text): suggested.add("dreams")
        if re.search(r'\bflesh\b', text) or re.search(r'\bmutation\b', text): suggested.add("biohorror")
        if re.search(r'\bcolony\b', text) or re.search(r'\bplanet\b', text) or re.search(r'\bspace\b', text): suggested.add("creative")
        # Short story ideas
        if len(text) < 300 and not suggested: suggested.add("story-idea")
    
    if folder == "alanzoppa's notebook":
        if re.search(r'\bdepress', text) or re.search(r'\banxiety', text) or re.search(r'\btherapy\b', text): suggested.add("mental-health")
        if re.search(r'\bchildhood\b', text) or re.search(r'\bgrowing.up\b', text): suggested.add("childhood")
        if re.search(r'\bdeath\b', text) or re.search(r'\bgrief\b', text) or re.search(r'\bfuneral\b', text): suggested.add("grief")
        if re.search(r'\bidentity\b', text) or re.search(r'\bmasculinity\b', text): suggested.add("identity")
        if re.search(r'\bdream\b', text) and re.search(r'(had|last|nightmare|sleep)', text): suggested.add("dreams")
        if re.search(r'\brelationship\b', text) and re.search(r'(personal|romantic|marriage|dating)', text): suggested.add("relationship")
        if re.search(r'\binterview\b', text) and re.search(r'(candidate|panel|screen|hiring|question)', text): suggested.add("hiring")
    
    if folder == "Artificial Memory":
        suggested.add("self-reflection")
        if re.search(r'\bbook\b', text) or re.search(r'\bauthor\b', text) or re.search(r'\bpoem\b', text) or re.search(r'\bquote\b', text):
            suggested.add("book-notes")
        if re.search(r'\bdeath\b', text) or re.search(r'\bgrief\b', text): suggested.add("grief")
        if re.search(r'\brelig', text): suggested.add("identity")
    
    if folder == "Chinese":
        suggested.add("language-learning")
    
    if folder == "Hindi":
        suggested.add("language-learning")
    
    # Werk folder - job search / career
    if folder == "Werk":
        if re.search(r'\binterview\b', text): suggested.add("hiring")
        if re.search(r'\bapply\b', text) or re.search(r'\bposition\b', text): suggested.add("career")
        if re.search(r'\blinkedin\b', text): suggested.add("linkedin")
        if re.search(r'\brecommend', text): suggested.add("linkedin")
        if not suggested: suggested.add("career")
    
    return suggested


def suggest_tags(title: str, body: str, folder: str, existing_tags: list[str]) -> list[str]:
    clean_body = _strip_ai_captions(body)
    text = (title + " " + clean_body).lower()
    suggested = set()

    for tag_name, keywords, title_patterns in tag_rules():
        matched = False
        for kw in keywords:
            if re.search(re.escape(kw), text, re.IGNORECASE):
                suggested.add(tag_name)
                matched = True
                break
        if not matched:
            for pat in title_patterns:
                if re.search(pat, title, re.IGNORECASE):
                    suggested.add(tag_name)
                    break

    content_tags = [t for t in existing_tags if t not in STRUCTURAL_TAGS]
    folder_tag_map = {
        "Interview Notes": ["interview"],
        "1:1 Notes": ["meeting-notes"],
        "Chinese": ["language-learning"],
    }
    if folder in folder_tag_map:
        for ft in folder_tag_map[folder]:
            suggested.add(ft)
    
    if not content_tags:
        # Second-pass: broad content rules only for notes with no content tags
        suggested |= broad_content_rules(title, clean_body, folder, text)

    suggested -= set(existing_tags)

    # Context gating: work-only tags shouldn't apply to fiction-only notes
    WORK_ONLY_TAGS = {
        "hiring", "hiring-panel", "hiring-rubric", "behavioral-interview",
        "technical-interview", "performance-review", "promotion",
        "project-planning", "sprint", "roadmap",
        "zendesk", "support-apps", "agent-workspace", "enova",
    }
    WORK_CONTEXT_WORDS = {"team", "sprint", "quarter", "manager", "engineer",
                          "direct report", "roadmap", "okr", "1:1", "one-on-one"}
    FICTION_FOLDERS = {"Stories", "Raven"}
    if folder in FICTION_FOLDERS:
        has_work_context = any(w in text for w in WORK_CONTEXT_WORDS)
        if not has_work_context:
            suggested -= WORK_ONLY_TAGS
    if len(suggested) > 8:
        priority = [
            "technical-interview", "behavioral-interview", "hiring-panel",
            "hiring-rubric", "system-design", "project-planning",
            "performance-review", "worldbuilding", "story-idea",
            "mental-health", "self-reflection", "language-learning",
            "meeting-notes", "frontend", "backend", "api",
            "architecture", "testing", "devops", "ci-cd",
            "migration", "tech-debt", "ember", "react", "typescript",
            "zendesk", "support-apps", "agent-workspace", "chat",
            "enova", "creative", "fiction", "writing",
            "book-notes", "hiring", "management", "mentoring",
            "feedback", "delegation", "promotion",
            "presentation", "tech-talk",
            "todo", "sprint", "product", "roadmap",
            "ops", "upload", "receipt",
            "zombies", "posthuman", "biohorror",
            "grief", "childhood", "dreams", "family", "therapy",
            "identity", "relationship", "accessibility",
            "documentation", "rosetta-stone", "transcription",
            "engineering", "interview",
        ]
        ranked = sorted(suggested, key=lambda t: priority.index(t) if t in priority else 999)
        suggested = set(ranked[:8])

    return sorted(suggested)


def add_tags_to_file(filepath: Path, new_tags: list[str]) -> None:
    raw = filepath.read_text(encoding="utf-8")
    lines = raw.split("\n")
    in_tags = False
    last_tag_idx = None
    tag_start_idx = None

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("tags:"):
            in_tags = True
            tag_start_idx = i
            m = re.match(r'tags:\s*\[(.+)\]', stripped)
            if m:
                existing = [t.strip().strip("'\"") for t in m.group(1).split(",") if t.strip()]
                all_tags = existing + new_tags
                new_lines = ["tags:"]
                for t in all_tags:
                    new_lines.append(f"- {t}")
                lines[i:i + 1] = new_lines
                filepath.write_text("\n".join(lines), encoding="utf-8")
                return
            continue
        if in_tags:
            if stripped.startswith("- "):
                last_tag_idx = i
            elif not stripped or not line.startswith(" "):
                in_tags = False

    if last_tag_idx is not None:
        for j, tag in enumerate(new_tags):
            lines.insert(last_tag_idx + 1 + j, f"- {tag}")
    elif tag_start_idx is not None:
        new_lines = []
        for tag in new_tags:
            new_lines.append(f"- {tag}")
        lines = lines[:tag_start_idx + 1] + new_lines + lines[tag_start_idx + 1:]

    filepath.write_text("\n".join(lines), encoding="utf-8")


def main():
    write_mode = "--write" in sys.argv

    stats = {
        "total": 0,
        "only_structural": 0,
        "has_content": 0,
        "no_tags": 0,
        "would_add": 0,
        "actually_added": 0,
        "tags_added": Counter(),
    }

    for fpath in sorted(NOTES_DIR.glob("*.md")):
        if fpath.name == ".ingest_state.json":
            continue

        raw = fpath.read_text(encoding="utf-8")
        post = frontmatter.loads(raw)
        fm = post.metadata
        body = post.content

        title = str(fm.get("title", fpath.stem))
        folder = str(fm.get("folder", ""))
        existing_tags = get_existing_tags(fpath)

        stats["total"] += 1

        content_tags = [t for t in existing_tags if t not in STRUCTURAL_TAGS]
        if not existing_tags:
            stats["no_tags"] += 1
        elif not content_tags:
            stats["only_structural"] += 1
        else:
            stats["has_content"] += 1

        if "image-only" in existing_tags and "contentless" in existing_tags:
            continue

        if len(body.strip()) < 30:
            continue

        suggested = suggest_tags(title, body, folder, existing_tags)
        if not suggested:
            continue

        stats["would_add"] += 1
        for t in suggested:
            stats["tags_added"][t] += 1

        if write_mode:
            add_tags_to_file(fpath, suggested)
            stats["actually_added"] += 1
        else:
            content_tag_str = ", ".join(content_tags) if content_tags else "(none)"
            print(f"\n{fpath.name}")
            print(f"  Existing: {content_tag_str}")
            print(f"  +Add: {', '.join(suggested)}")

    print(f"\n{'='*60}")
    print(f"Total notes:       {stats['total']}")
    print(f"No tags:           {stats['no_tags']}")
    print(f"Only structural:   {stats['only_structural']}")
    print(f"Has content tags:  {stats['has_content']}")
    print(f"Would add tags to: {stats['would_add']}")
    print(f"Actually added:    {stats['actually_added']}")
    print(f"\nTop tags to be added:")
    for tag, count in stats["tags_added"].most_common(30):
        print(f"  {count:4d}  {tag}")

    if not write_mode:
        print(f"\nDRY RUN - no changes made. Use --write to apply.")


if __name__ == "__main__":
    main()