import type { SlackCommandMiddlewareArgs } from '@slack/bolt'

/** Minimal subset of Bolt's command middleware args that read-only command handlers need. */
export type CommandArgs = Pick<SlackCommandMiddlewareArgs, 'command' | 'ack' | 'respond'>
