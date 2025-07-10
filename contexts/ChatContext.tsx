import React, { useState, createContext, useContext } from "react";
import { Channel as ChannelType } from "stream-chat";

interface ChatContextType {
  channel: ChannelType | null;
  setChannel: (channel: ChannelType | null) => void;
  thread: any;
  setThread: (thread: any) => void;
}

export const ChatContext = createContext<ChatContextType>({
  channel: null,
  setChannel: () => {},
  thread: null,
  setThread: () => {},
});

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [channel, setChannel] = useState<ChannelType | null>(null);
  const [thread, setThread] = useState<any>(null);

  return (
    <ChatContext.Provider value={{ channel, setChannel, thread, setThread }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);
