import { ContractError } from '../../errors.js';
import { parseContent } from './content.js';
import { parseEvent } from './event.js';
import { parseFeed } from './feed.js';
import { parseGroup } from './group.js';
import { parseProfile } from './profile.js';

export const PARSERS = Object.freeze({
  content: parseContent,
  event: parseEvent,
  feed: parseFeed,
  group: parseGroup,
  profile: parseProfile,
});

export function parseCandidate(kind, element, context) {
  const parser = PARSERS[kind];
  if (!parser) throw new ContractError('No parser for candidate kind', { kind });
  return parser(element, context);
}
