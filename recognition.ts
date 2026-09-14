// Short copy for the Rankings "recognition board" — celebratory lines for
// the Top 5 and supportive, coaching-toned lines for the Bottom 5. Picked
// deterministically by position (not randomly) so the page shows the same
// message on every load rather than shuffling each time someone refreshes.
export const CELEBRATION_TAGLINES: string[] = [
  "Absolute rockstar this period! 🌟",
  "Crushing it — keep that momentum going!",
  "Outstanding work, take a bow! 👏",
  "Setting the bar for the whole team!",
  "Incredible consistency — well earned!",
];

export const MOTIVATIONAL_MESSAGES: string[] = [
  "Every step forward counts — keep pushing, we believe in you!",
  "Progress over perfection. You've got this!",
  "Small improvements add up to big wins — stay focused.",
  "Tough stretch, brighter days ahead. Your team is rooting for you!",
  "Growth takes time — trust the process and keep going.",
  "You're capable of more than you know. One day at a time!",
  "A rough period doesn't define you — bounce back stronger!",
  "Keep showing up. That's how every turnaround starts.",
];

export function celebrationFor(index: number): string {
  return CELEBRATION_TAGLINES[index % CELEBRATION_TAGLINES.length]!;
}

export function motivationFor(index: number): string {
  return MOTIVATIONAL_MESSAGES[index % MOTIVATIONAL_MESSAGES.length]!;
}
