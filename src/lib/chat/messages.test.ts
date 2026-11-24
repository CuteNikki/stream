/// <reference types="bun" />

import { describe, expect, test } from 'bun:test';

import { twitchMessage, youtubeItem, youtubeSource } from '@/lib/chat/messages';

describe('twitchMessage', () => {
  test('keeps text and emotes in order, with roles from badges', () => {
    const message = twitchMessage(
      {
        message_id: 'm1',
        chatter_user_name: 'Viewer',
        color: '#FF0000',
        badges: [{ set_id: 'moderator' }, { set_id: 'subscriber' }, { set_id: 'founder' }, { set_id: 'premium' }],
        message: {
          text: 'hi Kappa there',
          fragments: [
            { type: 'text', text: 'hi ', emote: null },
            { type: 'emote', text: 'Kappa', emote: { id: '25', format: ['static'] } },
            { type: 'text', text: ' there', emote: null },
          ],
        },
        cheer: null,
      },
      '2026-11-24T18:00:00Z',
    );
    expect(message).toEqual({
      id: 'twitch:m1',
      source: 'twitch',
      author: { name: 'Viewer', color: '#FF0000', roles: ['moderator', 'subscriber'] },
      parts: [
        { type: 'text', text: 'hi ' },
        { type: 'emote', name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/static/dark/2.0' },
        { type: 'text', text: ' there' },
      ],
      paid: null,
      time: '2026-11-24T18:00:00Z',
    });
  });

  test('uses the animated emote where there is one, and says what was cheered', () => {
    const message = twitchMessage(
      {
        message_id: 'm2',
        chatter_user_name: 'Cheerer',
        color: '',
        badges: [],
        message: { text: 'Cheer100 dance', fragments: [{ type: 'emote', text: 'dance', emote: { id: 'emotesv2_x', format: ['static', 'animated'] } }] },
        cheer: { bits: 100 },
      },
      '2026-11-24T18:00:00Z',
    );
    expect(message.author.color).toBeNull();
    expect(message.parts[0]).toEqual({ type: 'emote', name: 'dance', url: 'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_x/animated/dark/2.0' });
    expect(message.paid).toBe('100 bits');
  });
});

describe('youtubeItem', () => {
  const source = youtubeSource('b1');
  const author = { displayName: 'Viewer', isChatOwner: false, isChatModerator: true, isChatSponsor: true };

  test('shows a text message with its roles', () => {
    expect(
      youtubeItem(source, {
        id: 'y1',
        snippet: { type: 'textMessageEvent', publishedAt: '2026-11-24T18:00:00Z', displayMessage: 'hello' },
        authorDetails: author,
      }),
    ).toEqual({
      message: {
        id: 'youtube:b1:y1',
        source: 'youtube:b1',
        author: { name: 'Viewer', color: null, roles: ['moderator', 'member'] },
        parts: [{ type: 'text', text: 'hello' }],
        paid: null,
        time: '2026-11-24T18:00:00Z',
      },
    });
  });

  test('shows a Super Chat with its amount and comment', () => {
    const item = youtubeItem(source, {
      id: 'y2',
      snippet: {
        type: 'superChatEvent',
        publishedAt: '2026-11-24T18:00:00Z',
        displayMessage: '€5.00 from Viewer: thanks!',
        superChatDetails: { amountDisplayString: '€5.00', userComment: 'thanks!' },
      },
      authorDetails: author,
    });
    expect(item && 'message' in item && item.message.paid).toBe('€5.00');
    expect(item && 'message' in item && item.message.parts).toEqual([{ type: 'text', text: 'thanks!' }]);
  });

  test('turns a deletion into the deleted message id', () => {
    expect(
      youtubeItem(source, {
        id: 'y3',
        snippet: { type: 'messageDeletedEvent', publishedAt: '2026-11-24T18:00:00Z', deletedMessageDetails: { deletedMessageId: 'y1' } },
      }),
    ).toEqual({ deleted: 'youtube:b1:y1' });
  });

  test('skips what the chat has nothing to show for', () => {
    expect(youtubeItem(source, { id: 'y4', snippet: { type: 'chatEndedEvent', publishedAt: '2026-11-24T18:00:00Z' } })).toBeNull();
  });
});
