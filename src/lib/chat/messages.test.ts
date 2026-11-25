/// <reference types="bun" />

import { describe, expect, test } from 'bun:test';

import { kickMessage, twitchMessage, youtubeItem, youtubeSource } from '@/lib/chat/messages';

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
      platform: 'twitch',
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
        platform: 'google',
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

describe('kickMessage', () => {
  test('splits emotes out of the text, with roles from badges', () => {
    const message = kickMessage({
      message_id: 'k1',
      sender: {
        username: 'Viewer',
        identity: { username_color: '#FF5733', badges: [{ type: 'moderator' }, { type: 'sub_gifter' }, { type: 'subscriber' }, { type: 'founder' }] },
      },
      content: 'Hello [emote:4148074:HYPERCLAP] [emote:37226:KEKW]',
      created_at: '2026-11-25T18:00:00Z',
    });
    expect(message).toEqual({
      id: 'kick:k1',
      source: 'kick',
      platform: 'kick',
      author: { name: 'Viewer', color: '#FF5733', roles: ['moderator', 'subscriber'] },
      parts: [
        { type: 'text', text: 'Hello ' },
        { type: 'emote', name: 'HYPERCLAP', url: 'https://files.kick.com/emotes/4148074/fullsize' },
        { type: 'text', text: ' ' },
        { type: 'emote', name: 'KEKW', url: 'https://files.kick.com/emotes/37226/fullsize' },
      ],
      paid: null,
      time: '2026-11-25T18:00:00Z',
    });
  });

  test('keeps plain text whole, with no colour or badges', () => {
    const message = kickMessage({ message_id: 'k2', sender: { username: 'Quiet', identity: null }, content: 'just text', created_at: '2026-11-25T18:00:00Z' });
    expect(message.parts).toEqual([{ type: 'text', text: 'just text' }]);
    expect(message.author).toEqual({ name: 'Quiet', color: null, roles: [] });
  });
});
