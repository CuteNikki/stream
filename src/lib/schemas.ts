import { z } from 'zod';

import { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, MAX_PASSWORD_LENGTH, MIN_EMAIL_LENGTH, MIN_NAME_LENGTH, MIN_PASSWORD_LENGTH } from '@/constants/auth';
import { CONTENT_LABELS, MAX_TAG_LENGTH, MAX_TAGS, MAX_TITLE_LENGTH, YOUTUBE_CATEGORIES } from '@/constants/stream';

/** The same rule Better Auth applies, so an address it would turn away is caught here first. */
export const emailSchema = z
  .email(`Email is invalid!`)
  .min(MIN_EMAIL_LENGTH, `Email must be at least ${MIN_EMAIL_LENGTH} characters.`)
  .max(MAX_EMAIL_LENGTH, `Email must be at most ${MAX_EMAIL_LENGTH} characters.`);

const passwordSchema = z
  .string()
  .nonempty(`Password is required!`)
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);

export const nameSchema = z
  .string()
  .trim()
  .min(MIN_NAME_LENGTH, 'Name is required!')
  .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters.`);

export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`),
});

/** The one account, made on the first visit (see lib/setup.ts). */
export const setupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const updateNameSchema = z.object({
  name: nameSchema,
});

/** Letters and numbers only, in any language: Twitch turns away anything else, spaces included. */
export const tagSchema = z
  .string()
  .trim()
  .min(1, 'A tag needs at least one character.')
  .max(MAX_TAG_LENGTH, `Tags must be at most ${MAX_TAG_LENGTH} characters.`)
  .regex(/^[\p{L}\p{N}]+$/u, 'Tags can only have letters and numbers.');

/** What a stream is set to, on every platform at once. */
export const streamSchema = z.object({
  title: z.string().trim().min(1, 'Title is required!').max(MAX_TITLE_LENGTH, `Title must be at most ${MAX_TITLE_LENGTH} characters.`),
  category: z.object({ id: z.string(), name: z.string(), boxArt: z.string() }).nullable(),
  tags: z
    .array(tagSchema)
    .max(MAX_TAGS, `At most ${MAX_TAGS} tags.`)
    .refine((tags) => new Set(tags.map((tag) => tag.toLowerCase())).size === tags.length, 'Each tag only once.'),
  // An ISO 639-1 code, Twitch's own variants like zh-hk, or "other"
  language: z.string().regex(/^([a-z]{2,3}(-[a-z]{2})?|other)$/, 'Pick a language.'),
  labels: z.array(z.enum(CONTENT_LABELS.map((label) => label.id))),
  brandedContent: z.boolean(),
  // Its own category, as YouTube's are broad and don't follow Twitch's games
  youtubeCategory: z.enum(YOUTUBE_CATEGORIES.map((category) => category.id)),
});

export type StreamDetails = z.infer<typeof streamSchema>;
export type Category = NonNullable<StreamDetails['category']>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().nonempty('Reset token is missing!'),
    password: passwordSchema,
    confirmPassword: z.string().nonempty('Please confirm your password!'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match!',
    path: ['confirmPassword'],
  });
