export class RotationMapper {
  rotation: number = 0;

  width: number = 0;
  height: number = 0;

  logicalWidth: number = 0;
  logicalHeight: number = 0;

  x: number = 0;
  y: number = 0;

  logicalX: number = 0;
  logicalY: number = 0;

  setSize(width: number, height: number) {
    this.x = (this.x / this.width) * width;
    this.y = (this.y / this.height) * height;

    this.width = width;
    this.height = height;

    switch (this.rotation) {
      case 0:
        this.logicalWidth = this.width;
        this.logicalHeight = this.height;
        this.logicalX = this.x;
        this.logicalY = this.y;
        break;
      case 1:
        this.logicalWidth = this.height;
        this.logicalHeight = this.width;
        this.logicalX = this.height - this.y;
        this.logicalY = this.x;
        break;
      case 2:
        this.logicalWidth = this.width;
        this.logicalHeight = this.height;
        this.logicalX = this.width - this.x;
        this.logicalY = this.height - this.y;
        break;
      case 3:
        this.logicalWidth = this.height;
        this.logicalHeight = this.width;
        this.logicalX = this.y;
        this.logicalY = this.width - this.x;
        break;
    }
  }

  setRotation(rotation: number) {
    this.rotation = rotation;

    switch (rotation) {
      case 0:
        this.logicalWidth = this.width;
        this.logicalHeight = this.height;
        this.logicalX = this.x;
        this.logicalY = this.y;
        break;
      case 1:
        this.logicalWidth = this.height;
        this.logicalHeight = this.width;
        this.logicalX = this.y;
        this.logicalY = this.width - this.x;
        break;
      case 2:
        this.logicalWidth = this.width;
        this.logicalHeight = this.height;
        this.logicalX = this.width - this.x;
        this.logicalY = this.height - this.y;
        break;
      case 3:
        this.logicalWidth = this.height;
        this.logicalHeight = this.width;
        this.logicalX = this.height - this.y;
        this.logicalY = this.x;
        break;
    }
  }

  setLogicalPosition(x: number, y: number) {
    // console.log("[rotation]", "logical position", x, y, this.rotation);

    this.logicalX = x;
    this.logicalY = y;

    switch (this.rotation) {
      case 0:
        this.x = x;
        this.y = y;
        break;
      case 1:
        this.x = this.width - y;
        this.y = x;
        break;
      case 2:
        this.x = this.width - x;
        this.y = this.height - y;
        break;
      case 3:
        this.x = y;
        this.y = this.height - x;
        break;
    }
  }
}
