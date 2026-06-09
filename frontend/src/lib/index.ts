// Reexport shared types for convenient `$lib` imports.
export type { ChatMessageView, SendMessageResponse, HistoryResponse, ChatEntry } from './types';

// Reexport the ChatClient API module.
export { sendMessage, fetchHistory, ChatClientError } from './api/chatClient';
