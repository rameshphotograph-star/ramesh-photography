export const ASSISTANT_TASKS = Object.freeze({
  instagram_caption: "Create a distinctive Instagram caption with a strong opening, concise story, clear booking call-to-action and relevant hashtags. Avoid generic filler.",
  story_campaign: "Create a polished Instagram Story campaign sequence that turns profile visitors into genuine photography enquiries. Give frame-by-frame copy, visual direction and CTA.",
  booking_reply: "Write a warm, professional reply to a prospective photography client. Clarify the service, event date, deliverables and next step without inventing prices or availability.",
  quotation_copy: "Create premium, easy-to-understand quotation wording from the supplied details. Clearly separate confirmed inclusions from details that still need confirmation. Never invent prices.",
  marketing_plan: "Create a practical, creative 7-day marketing plan for a regional wedding photography studio, with specific daily actions, post concepts and measurable outcomes."
});

const LANGUAGES = new Set(["English", "Telugu", "English + Telugu"]);
const TONES = new Set(["Premium and elegant", "Warm and emotional", "Modern and creative", "Direct and conversion-focused"]);

export function normalizeAssistantInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid request.");
  const task = typeof input.task === "string" ? input.task : "";
  const language = LANGUAGES.has(input.language) ? input.language : "English";
  const tone = TONES.has(input.tone) ? input.tone : "Premium and elegant";
  const brief = typeof input.brief === "string" ? input.brief.trim() : "";
  const context = typeof input.context === "string" ? input.context.trim() : "";
  if (!Object.hasOwn(ASSISTANT_TASKS, task)) throw new Error("Choose a supported creative task.");
  if (!brief || brief.length > 1800) throw new Error("Enter a brief between 1 and 1,800 characters.");
  if (context.length > 800) throw new Error("Additional details must be 800 characters or fewer.");
  return { task, language, tone, brief, context };
}

export function buildAssistantPrompt(input) {
  const details = input.context ? "\nAdditional confirmed details:\n" + input.context : "";
  return [
    "Brand: Ramesh Photography, a wedding and event photography studio in Andhra Pradesh, India.",
    "Task: " + ASSISTANT_TASKS[input.task],
    "Language: " + input.language + ".",
    "Creative direction: " + input.tone + ".",
    "Client brief:\n" + input.brief + details,
    "Quality rules: Be specific, original and commercially useful. Do not invent testimonials, client names, prices, dates, awards, guarantees or availability. Use placeholders where a fact is missing. Keep the output ready to use, with clear headings where useful."
  ].join("\n\n");
}
