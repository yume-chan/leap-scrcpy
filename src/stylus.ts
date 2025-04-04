import { setUint16LittleEndian } from "@yume-chan/no-data-view";

export class HidStylus {
  // prettier-ignore
  static readonly Descriptor = new Uint8Array([
    0x05, 0x0d,       // USAGE_PAGE (Digitizers)
    0x09, 0x02,       // USAGE (Pen)
    0xa1, 0x01,       // COLLECTION (Application)
    0x09, 0x20,       //   USAGE (Stylus)
    0xa1, 0x00,       //   COLLECTION (Physical)
    0x15, 0x00,       //     LOGICAL_MINIMUM (0)
    0x25, 0x01,       //     LOGICAL_MAXIMUM (1)
    0x75, 0x01,       //     REPORT_SIZE (1)
    0x95, 0x01,       //     REPORT_COUNT (1)
    0x09, 0x42,       //     USAGE (Tip Switch)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x09, 0x44,       //     USAGE (Barrel Switch)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x09, 0x3c,       //     USAGE (Invert)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x09, 0x45,       //     USAGE (Eraser Switch)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x81, 0x03,       //     INPUT (Cnst,Var,Abs)
    0x09, 0x32,       //     USAGE (In Range)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x95, 0x02,       //     REPORT_COUNT (2)
    0x81, 0x03,       //     INPUT (Cnst,Var,Abs)
    0x05, 0x01,       //     USAGE_PAGE (Generic Desktop)
    0x09, 0x30,       //     USAGE (X)
    0x75, 0x10,       //     REPORT_SIZE (16)
    0x95, 0x01,       //     REPORT_COUNT (1)
    0x26, 0xFF, 0x7F, //     LOGICAL_MAXIMUM (32767)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0x09, 0x31,       //     USAGE (Y)
    0x81, 0x02,       //     INPUT (Data,Var,Abs)
    0xC0,             //   END_COLLECTION
    0xc0,             // END_COLLECTION
  ]);

  #report = new Uint8Array(5);
  get report() {
    return this.#report;
  }

  #in = false;
  #buttons = 0;

  #width = 0;
  #height = 0;

  setSize(width: number, height: number) {
    this.#width = width;
    this.#height = height;
  }

  move(x: number, y: number) {
    // console.log("[stylus]", "move", x, y);
    setUint16LittleEndian(this.#report, 1, (x / this.#width) * 0x7fff);
    setUint16LittleEndian(this.#report, 3, (y / this.#height) * 0x7fff);
  }

  buttonDown(button: number) {
    this.#buttons |= 1 << button;
    this.#report[0] = this.#buttons | ((this.#in ? 1 : 0) << 5);
  }

  buttonUp(button: number) {
    this.#buttons &= ~(1 << button);
    this.#report[0] = this.#buttons | ((this.#in ? 1 : 0) << 5);
  }

  enter() {
    this.#in = true;
    this.#report[0] = this.#buttons | ((this.#in ? 1 : 0) << 5);
  }

  leave() {
    this.#in = false;
    this.#report[0] = this.#buttons | ((this.#in ? 1 : 0) << 5);
  }
}
