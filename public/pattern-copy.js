// Pure presentation rules. Statistical thresholds live in insights.js.
// Only describe observed associations; do not turn the direction into advice.
const MESSAGES = {
  exercise: [
    'You slept longer after days with less exercise.',
    'You slept longer after days with more exercise.',
  ],
  caffeine: [
    'You slept longer after days with less caffeine.',
    'You slept longer after days with more caffeine.',
  ],
  screen: [
    'You slept longer after days with less screen time.',
    'You slept longer after days with more screen time.',
  ],
  water: [
    'You slept longer after days with less water.',
    'You slept longer after days with more water.',
  ],
  mood: [
    'Your mood was lower after longer sleep.',
    'Your mood was better after longer sleep.',
  ],
};

export function describePattern(result) {
  const empty = message => ({ message, goal: null });
  if (!result || result.state === 'insufficient') {
    return empty('Keep recording. We need a few more days.');
  }
  if (result.state === 'limited-variation') {
    return empty('Your days look similar. Keep recording.');
  }
  if (result.state === 'no-clear-difference') {
    return empty('Your sleep stayed about the same.');
  }
  if (result.state !== 'association' || !MESSAGES[result.key] || !Number.isFinite(result.difference)) {
    return empty('Keep recording. We need a few more days.');
  }

  const higher = result.difference > 0;
  let goal = null;
  if (result.key === 'exercise' && higher) goal = 'Try a 10-minute walk each day.';
  if (result.key === 'screen' && !higher) goal = 'Try putting screens away before bed.';
  if (result.key === 'caffeine' && !higher) goal = 'Try a smaller serving of caffeine.';
  if (result.key === 'water') goal = 'Track water and sleep for 7 days.';
  return { message: MESSAGES[result.key][Number(higher)], goal };
}
