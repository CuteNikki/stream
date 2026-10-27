// Twitch's limits, the tightest of the platforms
export const MAX_TITLE_LENGTH = 140;

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 25;

/**
 * The languages Twitch lets a stream be in, by their ISO 639-1 code, as its own dashboard lists them. A channel
 * set to one that isn't here keeps it, shown by its code.
 */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'Arabic' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'zh', name: 'Chinese' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ms', name: 'Malay' },
  { code: 'no', name: 'Norwegian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'es', name: 'Spanish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'other', name: 'Other' },
] as const;

/**
 * Twitch's content classification labels that a streamer sets. The seventh, MatureGame, comes from the category
 * and can't be set by hand.
 */
export const CONTENT_LABELS = [
  { id: 'DebatedSocialIssuesAndPolitics', name: 'Politics and Sensitive Social Issues' },
  { id: 'DrugsIntoxication', name: 'Drugs, Intoxication, or Excessive Tobacco Use' },
  { id: 'Gambling', name: 'Gambling' },
  { id: 'ProfanityVulgarity', name: 'Significant Profanity or Vulgarity' },
  { id: 'SexualThemes', name: 'Sexual Themes' },
  { id: 'ViolentGraphic', name: 'Violent and Graphic Depictions' },
] as const;

export type ContentLabel = (typeof CONTENT_LABELS)[number]['id'];

/** What Twitch counts as each label. */
export const CONTENT_LABELS_GUIDE = 'https://safety.twitch.tv/s/article/Content-Classification-Guidelines';
