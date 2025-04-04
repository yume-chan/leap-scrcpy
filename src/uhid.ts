import { struct, u16, u32, u8, string, buffer } from "@yume-chan/struct";

export enum UHidBus {
  Usb = 3,
  Bluetooth = 5,
  Virtual = 6,
}

export enum UHidEventType {
  Create,
  Destroy,
  Start,
  Stop,
  Open,
  Close,
  Output,
  OutputEv,
  Input,
  GetReport,
  GetReportReply,
  Create2,
  Input2,
  SetReport,
  SetReportReply,
}

export const UHidOutput = struct(
  { data: buffer(4096), size: u16, rType: u16 },
  { littleEndian: true },
);

export const UHidGetReport = struct(
  { id: u32, rNum: u8, rType: u8 },
  { littleEndian: true },
);

export const UHidGetReportReply = struct(
  {
    type: u32(UHidEventType.GetReportReply as const),
    id: u32,
    err: u16,
    data: buffer(u16),
  },
  { littleEndian: true },
);

export const UHidCreate2 = struct(
  {
    type: u32(UHidEventType.Create2 as const),
    name: string(128),
    phys: string(64),
    uniq: buffer(64),
    rd_size: u16,
    bus: u16<UHidBus>(),
    vendor: u32,
    product: u32,
    version: u32,
    country: u32,
    rd_data: buffer("rd_size"),
  },
  { littleEndian: true },
);

export const UHidInput2 = struct(
  { type: u32(UHidEventType.Input2 as const), data: buffer(u16) },
  { littleEndian: true },
);

export const UHidSetReport = struct(
  { id: u32, rNum: u8, rType: u8, size: u16, data: buffer(4096) },
  { littleEndian: true },
);

export const UHidDestroy = struct(
  { type: u32(UHidEventType.Destroy as const) },
  { littleEndian: true },
);
