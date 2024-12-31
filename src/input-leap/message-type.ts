import { encodeUtf8 } from "@yume-chan/struct";

export const MessageType = {
  Hello: encodeUtf8("Barrier"),
  KeepAlive: encodeUtf8("CALV"),
  InfoQuery: encodeUtf8("QINF"),
  Info: encodeUtf8("DINF"),
  InfoAck: encodeUtf8("CIAK"),
  MouseMove: encodeUtf8("DMMV"),
  MouseDown: encodeUtf8("DMDN"),
  MouseUp: encodeUtf8("DMUP"),
  Enter: encodeUtf8("CINN"),
  Leave: encodeUtf8("COUT"),
  Clipboard: encodeUtf8("DCLP"),
} as const;
