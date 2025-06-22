class Room {
    constructor(x, y, width, height, color = 'rgba(100, 100, 255, 0.2)') {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.color = color;
    }
  
    // Method to draw the room on the canvas
    draw() {
      // Set the fill style to the room's color
      c.fillStyle = this.color;
      // Draw the rectangle using the room's properties
      c.fillRect(this.x, this.y, this.width, this.height);
    }
  }